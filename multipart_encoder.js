/**
 * Copyright 2017 Bart Butenaers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    
    function cleanupResponse(node, response) {
        //  Remove the response object from the array, since streaming is not required anymore
        if (node.responses.has(response)) {
            node.responses.delete(response);
        }
        
        // Remove the 'streaming ..' status text when no responses are left to stream to
        if (node.responses.size == 0) {
            node.status({});
            
            if (node.outputIfAll == true) {
                // Create an empty output message, since we have no clue which previous connections have been closed in the past.
                node.send({payload:""});
            }
        }
        
        // Create an output message containing the closed response object (in the msg.res field), if required by the user
        if (node.outputIfSingle == true) {
            node.send({res: response});
        }
    }

    function MultiPartEncoder(n) {
        RED.nodes.createNode(this,n);
        this.globalHeaders  = n.globalHeaders || {};
        this.partHeaders    = n.partHeaders || {};
        this.statusCode     = n.statusCode || 200;
        this.destination    = n.destination;
        this.ignoreHeaders  = n.ignoreHeaders;
        this.ignoreMessages = n.ignoreMessages;
        this.outputIfSingle = n.outputIfSingle;
        this.outputIfAll    = n.outputIfAll;
        this.responses      = new Map();
        this.nodeProgress   = '';
        this.timestamp      = 0;
        
        var node = this;
        
        this.on("input",function(msg) {   
            // Check the response object in the input message
            switch (node.destination) {
                case 'single':
                    if (!msg.res) {
                        node.warn("For 'single client' streaming, a response object is required in every message (msg.res)");
                        return; 
                    }
                    break;
                case 'all':
                    if (msg.res && node.responses.has(msg.res)) {
                        node.warn("For 'all clients' streaming, every response object is allowed only in the first message (msg.res)");
                        return;
                    }
                    break;
            }       
                    
            // ----------------------------------------------------------------------------------------------------------------------
            // SETUP NEW STREAM TO EVERY NEW RESPONSE OBJECT
            // ----------------------------------------------------------------------------------------------------------------------
            // When a new response object is being registered (the first time), we will setup the GLOBAL http headers and cookies.
            // Once the stream is started, changing the global headers would result in an error: Can't set headers after they are sent.
            if (msg.res && !node.responses.has(msg.res)) { 
                // Start with the global headers specified in the config screen
                var globalHeaders = RED.util.cloneMessage(node.globalHeaders);
                
                // Headers specified in the msg.headers will be used, but cannot override headers from the config screen
                if (msg.headers && node.ignoreHeaders == false) {
                    for (var headerName in msg.headers) {
                        if (msg.headers.hasOwnProperty(headerName) && !globalHeaders.hasOwnProperty(headerName)) {
                            globalHeaders[headerName] = msg.headers[headerName];
                        }
                    }
                }
                
                if (Object.keys(globalHeaders).length > 0) {
                    msg.res._res.set(globalHeaders);
                }
                
                // The cookies can only be set at the start of the stream
                if (msg.cookies) {
                    for (var name in msg.cookies) {
                        if (msg.cookies.hasOwnProperty(name)) {
                            if (msg.cookies[name] === null || msg.cookies[name].value === null) {
                                if (msg.cookies[name]!==null) {
                                    msg.res._res.clearCookie(name,msg.cookies[name]);
                                } else {
                                    msg.res._res.clearCookie(name);
                                }
                            } else if (typeof msg.cookies[name] === 'object') {
                                msg.res._res.cookie(name,msg.cookies[name].value,msg.cookies[name]);
                            } else {
                                msg.res._res.cookie(name,msg.cookies[name]);
                            }
                        }
                    }
                }

                // Store the response object in an array, for use later one.
                // The value (second paramater) specifies whether the stream is active (i.e. if we are allowed to proceed writing data to the stream)
                node.responses.set(msg.res, true);
                
                node.debug('Stream has been started for new request (' + node.responses.size + ' streams active)');
                
                // When the connection is closed afterwards ...
                // This happens e.g. when the browser page is closed, when the browser page is manually refreshed, ...
                // We don't handle the 'end' (= closed normally) event, because afterwards the 'close' (= close unexpectly) event seems also to be triggered.
                // Remark: these 'close' and 'end' events are NOT triggered when we call msg.res._res.end()
                // Remark: it might be useful in the future to call emitter.setMaxListeners() to increase limit of 11 listeners??
                msg.res._res.on('close', function() { 
                    // Find the ServerResponse object that is wrapping 'this' response object
                    for (var [response, active] of node.responses.entries()) {
                        if (response._res == this) {
                            cleanupResponse(node, this);
                            node.debug('Stream has been closed by the client (' + node.responses.size + ' streams active');
                            break;
                        }
                    }    
                });
                
                // When the stream has signalled us previously that we shouldn't proceed (due to its buffer running full), it will raise a 'drain' event
                // afterwards.  This means that the stream buffer is empty enough to accept new data.  So we can resume writing data to the stream ...
                msg.res._res.on('drain', function(){
                    // Find the ServerResponse object that is wrapping 'this' response object
                    for (var [response, active] of node.responses.entries()) {
                        if (response._res == this) {
                            node.responses.set(response, true);
                            node.debug('Stream has been resumed (since it can handle extra data again');
                        }
                    }
                });
       
                msg.res._res.status(node.statusCode);
            }
            
            // ----------------------------------------------------------------------------------------------------------------------
            // STREAM THE PAYLOAD DATA TO THE REQUIRED RESPONSE OBJECT(S)
            // ----------------------------------------------------------------------------------------------------------------------
            // In 'single' mode, every message contains a response object: so we can stream to that response object anyway.
            // In 'all' mode, the first message contains the response object and irrelevant payload data.  The messages afterwards contain no
            // response object but relevant payload data.  So we can stream only payload data for messages that don't contain a response object.
            if (node.destination == 'single' || !msg.res) {
                var relevantResponses = null;
                
                // Determine which clients (responses) should receive the msg.payload data
                switch (node.destination) {
                    case 'single':
                        // For 'single client' streaming, the data should only be sended to the response object from the message.
                        // At this point there will always be exactly 1 stream available.
                        relevantResponses = new Map();
                        
                        var active = node.responses.get(msg.res);
                        relevantResponses.set(msg.res, active);
                        break;
                    case 'all':
                        // For 'all clients' streaming, the data should be sended to all response objects in the array.
                        relevantResponses = node.responses;
                        
                        if (relevantResponses.size == 0) {
                            node.trace('The input message (payload) will be ignored, since there are no streams available');
                            return;
                        }               
                        break;
                }
                
                // When msg.res = true (in case of a single destination), the specified response will be ended.
                // The disconnection handler below will make sure that everything is cleaned up ...
                if (msg.hasOwnProperty('stop') && msg.stop == true) {
                    for (var [relevantResponse, active] of relevantResponses.entries()) {  
                        relevantResponse._res.end();                              
                        cleanupResponse(node, relevantResponse);   
                    }
                    
                    node.debug('Stream has been ended by "stop = true" in input message (' + node.responses.size + ' streams active)');
                    return;
                }
                
                if (!msg.payload) {
                    node.trace('Message payload has been ignored, since it contains no data');
                    return; 
                }
                
                if (!msg.payload instanceof String && !Buffer.isBuffer(msg.payload)) {  
                    node.warn('Only strings and buffers can be streamed, not payload type ' + typeof(msg.payload));  
                    return;
                }
                
                // Start with the part headers specified in the config screen
                var partHeaders = RED.util.cloneMessage(node.partHeaders);
                
                // Headers specified in the msg.headers will be used, but cannot override headers from the config screen
                if (msg.headers && node.ignoreHeaders == false) {
                    for (var headerName in msg.headers) {
                        if (msg.headers.hasOwnProperty(headerName) && !partHeaders.hasOwnProperty(headerName)) {
                            partHeaders[headerName] = msg.headers[headerName];
                        }
                    }
                }   
                    
                // Send data (from the payload) to the stream.  
                if (relevantResponses.size > 0) {
                    // Write the msg.payload to all relevant responses/clients
                    for (var [relevantResponse, active] of relevantResponses.entries()) {
                        // When the buffer of the current response is running full (i.e. its 'active' value = false), then don't write data
                        // to that stream when specified by the user.
                        if (active || !node.ignoreMessages) {
                            node.trace('Message payload has been send to stream');

                            relevantResponse._res.write('--myboundary');  
                            relevantResponse._res.write('\r\n');    
                            
                            for (var partHeaderName in partHeaders) {
                                // Set all the specified part headers, except for the content-lenth (which we will determine ourselves anyway ...
                                if (partHeaderName.toLowerCase() != "content-length") {
                                    var partHeaderValue = partHeaders[partHeaderName];
                                    relevantResponse._res.write(partHeaderName + ': ' + partHeaderValue);
                                    relevantResponse._res.write('\r\n'); 
                                }                          
                            }   
                            
                            relevantResponse._res.write('Content-length: ' + msg.payload.length); 
                            relevantResponse._res.write('\r\n'); 
                            relevantResponse._res.write('\r\n'); 
                            
                            // After writing the entire payload, check whether we can proceed or not.  The write() return false if it has received enough
                            // data to keep it busy for a while (i.e. the stream has exceeded his highWaterMark).  If we should continue sending data to 
                            // the stream, this won't be a problem immediately: the stream would continue accepting our chunks, but its backlog would grow 
                            // (and it would consuming more and more memory).  Eventually it might even cause our program to run out of address space, and 
                            // crash or get stuck.  Remark: we do this check only when we write the payload, because that will contain the most data ...
                            if (relevantResponse._res.write(msg.payload) == false) {
                                // It could be that the client has closed the socket, which means the response has already been removed from our map.
                                // In that case we will certainly avoid that the response is being added here again to the map ...
                                if (node.responses.has(relevantResponse)) {
                                    // Set 'active' value to 'false' for the current response
                                    node.responses.set(relevantResponse, false);
                                    node.debug('Stream has been pauzed (since it is receiving too much data)');
                                    // Dont't add a 'return' statement here, because the next two 'write' statements should be executed anyway.  Otherwise
                                    // the stream would be incomplete, which would cause troubles as soon as the stream is resumed afterwards.
                                }
                            }

                            relevantResponse._res.write('\r\n');
                            relevantResponse._res.write('\r\n');
                            //relevantResponse._res.flush();
                        }
                        else {
                            node.trace('Message payload has been ignored, since the stream is pauzed');
                        }
                    }
                    
                    // Update the status text maximum every 500 mseconds
                    if (Date.now() - node.timestamp > 500 ) {
                        node.timestamp = Date.now();
                        
                        // Simulate a progress bar in the status text ...
                        node.progress += '.';
                        if (node.progress.length > 5) {
                            node.progress = '';
                        }
                    
                        var displayText = "Streaming " + node.progress;
                        node.status({fill:"green",shape:"dot",text: displayText});
                    }
                }
            }
        });
        
        node.on("close", function() { 
            // After a (re)deploy, this node will start again with an empty 'responses' array.  We should end all connections,
            // because otherwise the clients would keep waiting/hanging infinitly for a response.
            for (var [response, active] of node.responses.entries()) {
                response._res.end();
            }
            
            // Remove all the responses from the array
            node.responses.clear();
            
            // Don't show 'streaming' status anymore
            node.status({});
        });
    }
    RED.nodes.registerType("multipart-encoder", MultiPartEncoder);
}
