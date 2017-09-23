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
    //var hashSum = require("hash-sum");

    function MultiPartEncoder(n) {
        RED.nodes.createNode(this,n);
        this.globalHeaders = n.globalHeaders || {};
        this.partHeaders  = n.partHeaders || {};
        this.statusCode    = n.statusCode || 200;
        this.destination   = n.destination;
        this.responses     = [];
        this.nodeProgress  = '';
        this.timestamp     = 0;
        
        var node = this;
        
        this.on("input",function(msg) {
            if (!msg.res && node.destination == 'single') {
                node.warn("A response object in msg.res is required for 'single client' streaming");
                return; 
            }
            
            // --------------------------------
            // First message of a stream
            // --------------------------------
            // When a new response object is being registered (the first time), we will setup the GLOBAL http headers and cookies.
            // Once the stream is started, changing the global headers would result in an error: Can't set headers after they are sent.
            if (msg.res && node.responses.indexOf(msg.res) < 0) { 
                // Start with the global headers specified in the config screen
                var globalHeaders = RED.util.cloneMessage(node.globalHeaders);
                
                // Headers specified in the msg.headers will be used, but cannot override headers from the config screen
                if (msg.headers) {
                    for (var headerName in msg.headers) {
                        if (msg.headers.hasOwnProperty(headerName) && !globalHeaders.hasOwnProperty(headerName)) {
                            globalHeaders[headerName] = msg.headers[heaheaderNameder];
                        }
                    }
                }
                
                if (Object.keys(globalHeaders).length > 0) {
                    msg.res._res.set(globalHeaders);
                }
                
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

                // Apply the global headers to the response object (which is specified in the message)
                node.responses.push(msg.res);
                
                // When the connection is closed afterwards ...
                // This happens e.g. when the browser page is closed, when the browser page is manually refreshed, ...
                msg.res._res.connection.on('close', function() { 
                    //  Remove the response object from the array, since streaming is not required anymore
                    var index = node.responses.indexOf(msg.res);
                    if (index > -1) {
                        node.responses.splice(index, 1);
                    }
                    
                    // Remove the 'streaming ..' status text when no responses are left to stream to
                    if (node.responses.length == 0) {
                        node.status({});
                    }
                });
                 
                msg.res._res.status(node.statusCode);
            }                        
            else {
                // --------------------------------
                // Next messages of a stream
                // --------------------------------
                // Send data (in the payload) to the stream.  Only String and Buffer data can be written to the response object.
                if (msg.payload instanceof String || Buffer.isBuffer(msg.payload)) {
                    var relevantResponses = [];
                    
                    // Determine which clients should receive the data
                    switch (node.destination) {
                        case 'single':
                            // For 'single client' streaming, the data should only be sended to the response object from the message
                            relevantResponses.push(msg.res);
                            break;
                        case 'all':
                            // For 'all clients' streaming, the data should be sended to all response objects in the array
                            relevantResponses = node.responses;
                            break;
                    }
                    
                    // TODO de part headers ophalen, ook uit de msg.headers
                        
                    if (relevantResponses.length > 0) {
                        // Write the msg.payload to all relevant responses/clients
                        for (var key in relevantResponses) {
                            var relevantResponse = relevantResponses[key];
                            
                            relevantResponse._res.write('--myboundary');  
                            relevantResponse._res.write('\r\n');    
                            
                            for (var partHeaderName in node.partHeaders) {
                                // Set all the specified part headers, except for the content-lenth (which we will determine ourselves anyway ...
                                if (partHeaderName.toLowerCase() != "content-length") {
                                    var partHeaderValue = node.partHeaders[partHeaderName];
                                    relevantResponse._res.write(partHeaderName + ': ' + partHeaderValue);
                                    relevantResponse._res.write('\r\n'); 
                                }                          
                            }
                            
                            relevantResponse._res.write('Content-length: ' + msg.payload.length); 
                            relevantResponse._res.write('\r\n'); 
                            relevantResponse._res.write('\r\n'); 
                            relevantResponse._res.write(msg.payload);
                            relevantResponse._res.write('\r\n');
                            relevantResponse._res.write('\r\n');
                            //relevantResponse._res.flush();
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
            }
        });
        
        node.on("close", function() {
            //node.responses.clear();
            node.status({});
        });
    }
    RED.nodes.registerType("multipart-encoder", MultiPartEncoder);
}
