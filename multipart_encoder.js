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
        
        // Remove the 'streaming' status text when no responses are left to stream to
        if (node.responses.size == 0) {
            node.status({fill:"yellow",shape:"ring",text: "streaming (0x)"});
            
            if (node.outputAllClosed == true) {
                // Create an empty output message, since we have no clue which previous connections have been closed in the past.
                node.send({payload:node.responses.size});
            }
        }
        
        // Create an output message containing the closed response object (in the msg.res field), if required by the user
        if (node.outputOneClosed == true) {
            node.send({payload:node.responses.size, res: response});
        }
    }

    // Syntax from RFC 2046 (https://stackoverflow.com/questions/33619914/http-range-request-multipart-byteranges-is-there-a-crlf-at-the-end) :
    // ...
    // EOL (considered as part of the boundary): if there are two EOL's, the first one is part of the body (and must be send in output msg)
    // boundary + optional whitespaces (added by a gateway, which must be deleted)
    // EOL (end of the boundary)
    // header1:value1 (optional)
    // EOL (end of the first part header key/value pair)
    // ...
    // headerN:valueN (optional)
    // EOL (end of the N-the part header key/value pair)
    // EOL (end of the part headers area, and start of the part body)    
    // part body
    // ...
    function MultiPartEncoder(n) {
        RED.nodes.createNode(this,n);
        this.globalHeaders   = n.globalHeaders || {};
        this.partHeaders     = n.partHeaders || {};
        this.statusCode      = n.statusCode || 200;
        this.destination     = n.destination;
        this.ignoreMessages  = n.ignoreMessages;
        this.outputOneNew    = n.outputOneNew;
        this.outputOneClosed = n.outputOneClosed;
        this.outputAllClosed = n.outputAllClosed;
        this.responses       = new Map();
        this.currentStatus   = {};
        this.timestamp       = 0;
        this.firstMsg        = true;
        
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
                // Set the global headers from the config screen.  We cannot override these with msg.headers because we have no way
                // to determine which are global headers or part headers.
                if (Object.keys(node.globalHeaders).length > 0) {
                    msg.res._res.set(node.globalHeaders);
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
                
                // Create an output message containing the closed response object (in the msg.res field), if required by the user
                if (node.outputOneNew == true) {
                    node.send({payload:node.responses.size, res: msg.res});
                }
                
                // When the connection is closed afterwards ...
                // This happens e.g. when the browser page is closed, when the browser page is manually refreshed, ...
                // We don't handle the 'end' (= closed normally) event, because afterwards the 'close' (= close unexpectly) event seems also to be triggered.
                // Remark: these 'close' and 'end' events are NOT triggered when we call msg.res._res.end()
                // Remark: it might be useful in the future to call emitter.setMaxListeners() to increase limit of 11 listeners??
                msg.res._res.on('close', function() { 
                    // Find the ServerResponse object that is wrapping 'this' response object
                    for (var [response, active] of node.responses.entries()) {
                        if (response._res == this) {
                            cleanupResponse(node, response);
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
                
                if (!relevantResponses || relevantResponses.size === 0) {
                    // As soon as the firt message arrives, show in the status if no clients are available yet (to stream to)
                    if (node.firstMsg) {
                        node.status({fill:"yellow",shape:"ring",text: "streaming (0x)"});
                        node.firstMsg = false;
                    }
                }
                
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
                    
                // Send data (from the payload) to the stream.  
                if (relevantResponses.size > 0) {
                    // Create a string containing all non-body data (boundary, eol's, part headers, ...) to make sure NodeJs
                    // combines all this data in 1 single chunk.  Otherwise NodeJs creates a chunk for every relevantResponse._res.write
                    // statement.  We cannot change that behaviour, because the response object is constructed in the Node-Red HttpIn node.
                    // Indeed, the highWaterMark level cannot be changed afterwards ...
                    var headersText = "";
                    
                    headersText += '\r\n'; // end of the part body                 
                    headersText += '--myboundary'; 
                    headersText += '\r\n'; // end of the boundary
                    
                    // Set the part headers from the config screen.  We cannot override these with msg.headers because we have no way
                    // to determine which are global headers or part headers.
                    for (var partHeaderName in node.partHeaders) {
                        // Set all the specified part headers, except for the content-lenth (which we will determine ourselves anyway ...
                        if (partHeaderName.toLowerCase() != "content-length") {
                            var partHeaderValue = node.partHeaders[partHeaderName];
                            headersText += partHeaderName + ': ' + partHeaderValue;
                            headersText += '\r\n'; // end of the header variable (key/value pair)
                        }                          
                    }   
                    
                    headersText += 'Content-length: ' + msg.payload.length;
                    headersText += '\r\n'; // end of the content-length header variable (key/value pair)
                    headersText += '\r\n'; // end of the header section
                    
                    // Write the msg.payload to all relevant responses/clients
                    for (var [relevantResponse, active] of relevantResponses.entries()) {
                        // When the buffer of the current response is running full (i.e. its 'active' value = false), then don't write data
                        // to that stream when specified by the user. 
                        if (active || !node.ignoreMessages) {
                            node.trace('Message payload has been send to stream');

                            // Write all header text with a single 'write' statement, because NodeJs creates a data chunk for every 'write'
                            // statement.  We cannot change that behaviour here (e.g. by setting other highWaterMark level via the options),
                            // because Node-Red's HttpIn node creates the response object ...
                            relevantResponse._res.write(headersText);                           
                            
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
                        }
                        else {
                            node.trace('Message payload has been ignored, since the stream is pauzed');
                        }
                    }
                    
                    // Update the status text maximum every 500 mseconds
                    if (Date.now() - node.timestamp > 500 ) {
                        node.timestamp = Date.now();
                        
                        // Let the status 'Streaming' flash ...
                        if (Object.keys(node.currentStatus).length === 0) {
                            node.currentStatus = {fill:"blue",shape:"dot",text: "streaming (" + relevantResponses.size + "x)"};
                        }
                        else {
                            node.currentStatus = {};
                        }
                    
                        node.status(node.currentStatus);
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
