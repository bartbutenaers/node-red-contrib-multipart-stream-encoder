# node-red-contrib-multipart-stream-encoder
Node-Red node for encoding multipart streams over http

Note about version ***0.0.2***: Thanks to [Simon Hailes](https://github.com/btsimonh), who has been testing version 0.0.1 thoroughly.  As a result, a number of new features have been added to increase the interaction between this node and the other nodes in the flow.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-multipart-stream-encoder
```

## Usage
The goal is to setup a stream over http, to create a continous sequence of data (text, images, ...).  One of the most known examples is an **MJPEG stream**, to send continously JPEG images (like a video stream).  

***The encoder converts (payloads from) separate messages into a continuous stream.***  For example to convert images into a continous MJPEG stream, so your ***Node-Red flow behaves like an IP camera that can offer live video***:

![Stream encoder](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_encoder.png)

This node will work closely together with the HttpIn node, as can be seen in the next flow:

![Basic flow](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_basic_flow.png)
```
[{"id":"561b7ff7.7caf3","type":"http in","z":"15244fe6.9ae87","name":"","url":"/xxxx","method":"get","upload":false,"swaggerDoc":"","x":1120,"y":260,"wires":[["cc1feca1.b909b"]]},{"id":"cc1feca1.b909b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreMessages":true,"outputIfSingle":true,"outputIfAll":false,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","x":1300,"y":200,"wires":[[]]},{"id":"bd955688.623878","type":"http request","z":"15244fe6.9ae87","name":"HttpRequest to get image","method":"GET","ret":"bin","url":"","tls":"","x":1070,"y":200,"wires":[["cc1feca1.b909b"]]},{"id":"da39d7.4e70f628","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":845,"y":200,"wires":[["bd955688.623878"]]},{"id":"435929ff.b35c18","type":"inject","z":"15244fe6.9ae87","name":"Every second","topic":"","payload":"","payloadType":"date","repeat":"1","crontab":"","once":false,"x":637.9999885559082,"y":199.99999904632568,"wires":[["da39d7.4e70f628"]]}]
```

The above flow captures images (e.g. from an IP camera, from disc, ...) and encodes those images into a live stream.  When a browser is used to navigate to the URL specified in the HttpIn node, the HttpIn node will pass this request to the encoder node.  As a result, the encoder node will send the video stream to your browser.  Multiple browser windows can be opened simultaneously, to display the same stream multiple times.  For this simple test Chrome is being used, because some other browsers require the stream to be called from within an \<img\> or \<video\> tag (which means it cannot simply display the stream, when a stream URL is entered).

We will use MJPEG streams in the remainder of this page, however it is also possible to stream other data types.

### Controlling a stream  

The streams can be controlled in multiple ways:

+ ***Starting*** a stream is initiated by a client, via the HttpIn node.  As soon as the HttpIn node sends a request message to the encoder, a stream will be started.
+ ***Pausing*** a stream is accomplished simply by not sending data to the encoder node.  But keep in mind that the requesting client might have specified a timeout, so the client might interrupt the connection when the stream is being paused too long.
+ ***Stopping*** a stream can be accomplished in multiple ways:
    - By sending a control message to the encoder node, containing a `msg.stop` with value *true*.  This way the active client knows that no data will be streamed anymore, to avoid that the client will keep waiting.  E.g. in Chrome the tabsheets would contain a spinning wheel as long as the response is not yet complete:

      ![Stream tabsheets](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_tabsheets.png)
    
      Such a control message will not be streamed to the client.  
    - By the client which disconnects from the stream (e.g. a dashboard that is being closed by the user).
    - By the Node-Red flow that is being (re)deployed.

The following flow offers buttons to pause/resume/stop a stream:

![Control stream](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_control.png)
```
[{"id":"561b7ff7.7caf3","type":"http in","z":"15244fe6.9ae87","name":"","url":"/xxxx","method":"get","upload":false,"swaggerDoc":"","x":1660,"y":240,"wires":[["cc1feca1.b909b"]]},{"id":"cc1feca1.b909b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreMessages":true,"outputIfSingle":true,"outputIfAll":false,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","x":1840,"y":300,"wires":[[]]},{"id":"bd955688.623878","type":"http request","z":"15244fe6.9ae87","name":"HttpRequest to get image","method":"GET","ret":"bin","url":"","tls":"","x":1610,"y":300,"wires":[["cc1feca1.b909b"]]},{"id":"da39d7.4e70f628","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":1380,"y":300,"wires":[["bd955688.623878"]]},{"id":"435929ff.b35c18","type":"inject","z":"15244fe6.9ae87","name":"Every second","topic":"","payload":"","payloadType":"date","repeat":"1","crontab":"","once":false,"x":1037.9999885559082,"y":299.9999990463257,"wires":[["58d2c398.976efc"]]},{"id":"5a5de18d.2ef8a","type":"inject","z":"15244fe6.9ae87","name":"Stop stream","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":"","x":1450,"y":360,"wires":[["bca25c2b.4079f"]]},{"id":"bca25c2b.4079f","type":"change","z":"15244fe6.9ae87","name":"","rules":[{"t":"set","p":"stop","pt":"msg","to":"true","tot":"bool"}],"action":"","property":"","from":"","to":"","reg":false,"x":1650,"y":360,"wires":[["cc1feca1.b909b"]]},{"id":"a39192ce.80e4b","type":"inject","z":"15244fe6.9ae87","name":"Pause stream","topic":"","payload":"true","payloadType":"bool","repeat":"","crontab":"","once":false,"onceDelay":"","x":1450,"y":400,"wires":[["d1bced7a.5790c"]]},{"id":"d84c646e.088fd8","type":"inject","z":"15244fe6.9ae87","name":"Resume stream","topic":"","payload":"false","payloadType":"bool","repeat":"","crontab":"","once":true,"onceDelay":"","x":1460,"y":440,"wires":[["d1bced7a.5790c"]]},{"id":"58d2c398.976efc","type":"switch","z":"15244fe6.9ae87","name":"","property":"streamPaused","propertyType":"flow","rules":[{"t":"false"}],"checkall":"true","repair":false,"outputs":1,"x":1210,"y":300,"wires":[["da39d7.4e70f628"]]},{"id":"d1bced7a.5790c","type":"change","z":"15244fe6.9ae87","name":"","rules":[{"t":"set","p":"streamPaused","pt":"flow","to":"payload","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":1680,"y":400,"wires":[[]]}]
```

### Same stream to 'all clients'

Watching camera images from a Node-Red flow, is an example of an *infinite stream*.  The flow generates an endless stream of data, and all clients hook in to the same existing stream: clients are not interested in the previous old data (they only want to see the current camera images).  

![Stream all](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all.png)
```
[{"id":"7f2b6b5c.691b64","type":"http in","z":"15244fe6.9ae87","name":"","url":"/infinite","method":"get","upload":false,"swaggerDoc":"","x":570,"y":120,"wires":[["5b3e4039.df33b"]]},{"id":"5b3e4039.df33b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":false,"ignoreMessages":true,"outputIfSingle":true,"outputIfAll":true,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","x":781,"y":120,"wires":[["ca54ad09.d6904"]]},{"id":"fb72a642.df0eb8","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":560,"y":180,"wires":[["5b3e4039.df33b"]]},{"id":"f8b8895a.77a838","type":"interval","z":"15244fe6.9ae87","name":"Every second","interval":"1","onstart":false,"msg":"ping","showstatus":false,"unit":"seconds","statusformat":"YYYY-MM-D HH:mm:ss","x":150,"y":180,"wires":[["59a9f54a.322d2c"]]},{"id":"59a9f54a.322d2c","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":340,"y":180,"wires":[["fb72a642.df0eb8"]]},{"id":"3ffa9ebc.86a872","type":"comment","z":"15244fe6.9ae87","name":"Stream to all clients","info":"","x":170,"y":120,"wires":[]},{"id":"ca54ad09.d6904","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"res","x":954,"y":120,"wires":[]}]
```
The clients are connecting at different times, but they all receive the same data at a particular moment in time: 

![Stream all result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single_result.png)

Make sure that ***messages containing data (images), don't have a `msg.res` field !***   When the message contains a `msg.res` field, the encoder assumes the message is sended by the HttpIn node.  And the `msg.payload` from those (HttpIn) messages won't be streamed, because it will contain all kind of information about the http request (instead of a real image).  Otherwise the stream would become corrupt...

### Separate stream for every 'Single client'

This option has been added, based on the [feedback](https://groups.google.com/d/msg/node-red/NhzX6tN9xyI/5KieYZxwBAAJ) of Nick O’Leary.

In some cases each client wants to have its own individual stream.  E.g. when camera images have been stored on disc, and that recorded video footage needs to be replayed afterwards in the dashboard.  In that case every client wants to see the entire video from the start: *each client wants to get the entire stream from the beginning*, independent of other clients.  

This means that the image processing needs to be started (by the flow), as soon as a new client request arrives.  

![Stream single](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single.png)

```
[{"id":"bc87df5c.bc323","type":"http in","z":"15244fe6.9ae87","name":"","url":"/finite","method":"get","upload":false,"swaggerDoc":"","x":160,"y":660,"wires":[["218fb2a5.4ba8ae"]]},{"id":"bff8aa99.c07c98","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":518,"y":660,"wires":[["4dc14794.f344e8"]]},{"id":"422deea9.f5539","type":"comment","z":"15244fe6.9ae87","name":"Stream per client","info":"","x":180,"y":620,"wires":[]},{"id":"4dc14794.f344e8","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":true,"ignoreMessages":true,"outputIfSingle":true,"outputIfAll":false,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"single","x":713,"y":660,"wires":[["2216a759.8dc718"]]},{"id":"2216a759.8dc718","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"true","x":899,"y":660,"wires":[]},{"id":"218fb2a5.4ba8ae","type":"function","z":"15244fe6.9ae87","name":"Msg factory","func":"// Repeat the msg every second\nvar repeatInterval = 1000;\n\ncontext.set('counter', 0);\n\nvar interval = setInterval(function() {\n    var counter = context.get('counter') || 0;\n    counter = counter + 1;\n    context.set('counter', counter);\n    \n    msg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n    \n    if(counter >= 15) {\n        msg.stop = true;\n        clearInterval(interval);\n    }\n    \n\tnode.send(msg);\n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":328,"y":660,"wires":[["bff8aa99.c07c98"]]}]
```

The clients are connecting at different times, but they all get the entire stream from the start:

![Stream single result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all_result.png)

Make sure that ***all messages have `msg.res` field*** (containing the HttpIn node's response)!  Reason is that the encoder should know to which client the image (in the `msg.payload`) needs to be send.  This can be accomplished by passing the response object from the HttpIn node.

### Keeping track of active connections

When no connections are currently active, this means that no clients are requesting data (i.e. no active client sessions).  In that case the encoder node will ignore all data from input messages.  However it is *adviced to stop sending message/data to the encoder*, since that data won't be used anyway.  

However it is not easy to keep track of active requests from within a Node-Red flow, since the ExpressJs webserver closes the client connections without notifying the Node-Red flow.

To solve this, the encoder node can generate following output message types (if specified in the node's config screen):
+ *Output message for every new connection* : when a new client connects, a message is generated with `msg.res` containing the related response object.  The `msg.topic` will be *'new_connection'*.
+ *Output message for every closed connection* : when a client disconnects, a message is generated with `msg.res` containing the related response object.  The `msg.topic` will be *'closed_connection'*.
+ *Output message when all connections closed* : when all clients have disconnected, a message is created to indicate that.  The `msg.topic` will be *'no_connection'*.

In all these output messages, the `msg.payload` field contains the number of current connections.  

By keeping track of the active connections, the flow can decide whether is it useful to process data (images).  Make sure you don't execute useless processing in the flow:

+ In 'all clients' mode: The count of all active clients can be used e.g. to pause the image processing automatically when no clients are listening, and resume the stream when clients become online:

    ![Throttling](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_throttling.png)
    ```
    [{"id":"7f2b6b5c.691b64","type":"http in","z":"15244fe6.9ae87","name":"","url":"/infinite","method":"get","upload":false,"swaggerDoc":"","x":816,"y":41.000000953674316,"wires":[["5b3e4039.df33b"]]},{"id":"5b3e4039.df33b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreMessages":true,"outputOneNew":true,"outputIfSingle":true,"outputIfAll":true,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","highWaterMark":16384,"x":1012.0000305175781,"y":41.00000190734863,"wires":[["110f23b9.aa0fbc"]]},{"id":"fb72a642.df0eb8","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":828.0000114440918,"y":101.00000190734863,"wires":[["5b3e4039.df33b"]]},{"id":"59a9f54a.322d2c","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":633.0000114440918,"y":101.00000190734863,"wires":[["fb72a642.df0eb8"]]},{"id":"82554055.ab38d","type":"inject","z":"15244fe6.9ae87","name":"Every second","topic":"","payload":"","payloadType":"date","repeat":"1","crontab":"","once":false,"x":196.52344131469727,"y":100.4062557220459,"wires":[[]]},{"id":"dc848d6.599127","type":"switch","z":"15244fe6.9ae87","name":"if flow.clientCount > 0","property":"clientCount","propertyType":"flow","rules":[{"t":"gt","v":"0","vt":"num"}],"checkall":"true","repair":false,"outputs":1,"x":411.5117492675781,"y":100.8398494720459,"wires":[["59a9f54a.322d2c"]]},{"id":"110f23b9.aa0fbc","type":"change","z":"15244fe6.9ae87","name":"Set flow.clientCount","rules":[{"t":"set","p":"clientCount","pt":"flow","to":"payload","tot":"msg"}],"action":"","property":"","from":"","to":"","reg":false,"x":1210,"y":40,"wires":[[]]}]
    ```

+ In 'single client' mode: As soon as a client connects, the data processsing will started for that specific client.  When the client disconnects, we need to stop processing data for that client.  This could be implemented based on the encoder's output messages:

    ![Aborted](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_aborted.png)
    ```
    [{"id":"bc87df5c.bc323","type":"http in","z":"15244fe6.9ae87","name":"","url":"/finite","method":"get","upload":false,"swaggerDoc":"","x":300,"y":560,"wires":[["218fb2a5.4ba8ae"]]},{"id":"bff8aa99.c07c98","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":658,"y":560,"wires":[["4dc14794.f344e8"]]},{"id":"4dc14794.f344e8","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreMessages":true,"outputOneNew":false,"outputIfSingle":true,"outputIfAll":false,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"single","highWaterMark":16384,"x":853,"y":560,"wires":[["9918b034.2ee21"]]},{"id":"218fb2a5.4ba8ae","type":"function","z":"15244fe6.9ae87","name":"Msg factory","func":"// Repeat the msg every second\nvar repeatInterval = 1000;\n\n// Store a map of client counters on the flow memory:\n//    response1 - counter1\n//    response2 - counter2\n//    ...       - ...\nvar clientCounters = flow.get('clientCounters');\n\nif (!clientCounters) {\n    clientCounters = new Map();\n    flow.set('clientCounters', clientCounters);\n}\n\n// Start counting from zero for the new client (i.e. response object)\nclientCounters.set(msg.res, 0);\n\n// Create a stream of 60 seconds long\nvar interval = setInterval(function() {\n    var clientCounters = flow.get('clientCounters');\n    var counter = clientCounters.get(msg.res);\n    \n    // When there is no counter anymore, this means the client has disconnected\n    if (counter === undefined || counter >= 60) {\n        msg.stop = true;\n        clearInterval(interval);\n        clientCounters.delete(msg.res);\n        return;\n    }\n    \n    // Increment the counter\n    counter = counter + 1;\n    clientCounters.set(msg.res, counter);\n    \n    msg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\n\tnode.send(msg);\n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":468,"y":560,"wires":[["bff8aa99.c07c98"]]},{"id":"9918b034.2ee21","type":"function","z":"15244fe6.9ae87","name":"Cleanup client counter","func":"node.error(\"Cleanup node bereikt\")\n\nif (msg.topic === 'closed_connection') {\n    var clientCounters = flow.get('clientCounters');\n    node.error(\"Ok juiste topic bereikt\")\n    \n    // Remove the counter of the client that has closed the connection\n    clientCounters.delete(msg.res);\n}\n\nsend(msg);","outputs":1,"noerr":0,"x":1060,"y":560,"wires":[[]]}]
    ```

    An alternative solution is to check whether the connection is closed (msg.res._res.connection.writable == false):
    ```
    [{"id":"f67cd7db.a56d38","type":"http in","z":"15244fe6.9ae87","name":"","url":"/finite","method":"get","upload":false,"swaggerDoc":"","x":680,"y":680,"wires":[["b9b4d484.d0e868"]]},{"id":"589c5e78.02ef6","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":1038,"y":680,"wires":[["9274e24b.1d927"]]},{"id":"9274e24b.1d927","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreMessages":true,"outputOneNew":false,"outputIfSingle":true,"outputIfAll":false,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"single","highWaterMark":16384,"x":1233,"y":680,"wires":[[]]},{"id":"b9b4d484.d0e868","type":"function","z":"15244fe6.9ae87","name":"Msg factory","func":"// Repeat the msg every second\nvar repeatInterval = 1000;\n\n// Store a map of client counters on the flow memory:\n//    response1 - counter1\n//    response2 - counter2\n//    ...       - ...\nvar clientCounters = flow.get('clientCounters');\n\nif (!clientCounters) {\n    clientCounters = new Map();\n    flow.set('clientCounters', clientCounters);\n}\n\n// Start counting from zero for the new client (i.e. response object)\nclientCounters.set(msg.res, 0);\n\n// Create a stream of 60 seconds long\nvar interval = setInterval(function() {\n    var clientCounters = flow.get('clientCounters');\n    var counter = clientCounters.get(msg.res);\n    \n    // When the client connection is closed, it is useless to process data\n    if (!msg.res._res.connection.writable || counter >= 60) {\n        msg.stop = true;\n        clearInterval(interval);\n        clientCounters.delete(msg.res);\n        return;\n    }\n    \n    // Increment the counter\n    counter = counter + 1;\n    clientCounters.set(msg.res, counter);\n    \n    msg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\n\tnode.send(msg);\n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":848,"y":680,"wires":[["589c5e78.02ef6"]]}]
    ```

### Adaptive streaming
When we are sending lots of messages to the encoder node (containing lots of data in the payloads), we would run into troubles if the stream cannot handle all that data.  For example if we have a slow network or a slow client system.  In that case the ***stream buffer*** would start growing until all memory would be consumed.  At the end our system would stop functioning correctly.

This can be solved by enabling the *'Ignore messages if stream is overloaded'* checkbox on the config screen.  When the stream cannot process all messages, the encoder node will start ignoring input messages.  As soon as the stream is again ready to process new data, the encoder node will again start processing input messages.  For example for MJPEG streaming, it is better to send less images than to have a malfunctioning system...  

This option can be disabled if there is a short burst of images, and all of those images should be sended.  But make sure that you don't overload your system.

By default the *stream buffer size* is 16 Kbyte in NodeJs, and is called the *high water mark*.  This default ***memory limit*** can be changed in the encoder's config screen.  E.g. when working with images, the 16 Kbyte would be exceeded all the time (since a single image will already exceed 16 Kbyte).

## Node status
The node status displays the number of active client connections:

![Stream tabsheets](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_status_count.png)

The status text can have different colors:
+ *grey*: There are currently no active clients, so no data will be streamed.
+ *blue*: Everything is fine, i.e. the data is currently being streamed to N active clients.
+ *yellow*: Data is being streamed, but some input messages have been ignored.  This warning indicates that either the flow is sending too much messages, or the client connection is too slow to handle all the data.
+ *red*: Data is being streamed, but the stream buffer has overflowed multiple times while no messages have been ignored.  This means that a single image is too big to fit into the stream buffer.  As a result the NodeJs stream is continiously being toggled between paused and resumed.  This can be solved by increasing the memory limit on the node's config screen: the buffer size should be at least the size of a single image.

## Streaming basics
Sometimes data need to be received at high rates.  For example get N camera images per second, to be able to display fluent video.  

Such high data rates cannot be reached by sending a request for every image:  
1. Request image 1
1. Wait for response image 1
1. Request image 2
1. Wait for response image 2
1. ...

Indeed this would result in too much overhead: we would have to wait all the time.  Moreover some devices cannot handle the overflow of http requests, ...

In this case (http) streaming is preferred.  We send a ***single*** (http) request, and the response will be an (in)finite stream of images.  A *boundary* string will be used as a separator between the images:
- global headers  
- part headers  
- IMAGE  
- boundary  
- part headers  
- IMAGE  
- boundary  
- part headers  
- IMAGE  
- boundary   
- ...
   
Remark: this has nothing to do with *mp4 streaming*.  In a MJPEG stream each image is compressed (as jpeg), but an mp4 stream also compresses the entire stream (by only sending differences between the images). 

## Http headers
At the start of the stream, ***global http headers*** will be send.  Afterwards each part of the multipart stream will contain ***part http headers***, followed by the real data (e.g. an image).

To make sure the client understands that a multipart stream has been setup, both type of headers need some minimal entries:
+ Global headers : the content-type should mention the 'multipart' type, and by disabling all kind of caching we make sure that all data is being handled (otherwise the client might incorrectly use old data from it's cache).
+ Part headers : the content-type should reflect the type of data that we are sending, so the client knows how to render that data (e.g. image/jpeg).  Remark: if a content-length is specified, it will be replaced by the content length calculated by the encoder node.

By default, all required http headers (on both levels) will be available in the config screen.  You can always replace them or add new ones, but make sure you don't remove mandatory headers (or the stream will fail)!!

***None*** of both headers can be specified via the `msg.headers` field! 

## Comparison to alternative solutions
To explain why this encoder node might be handy, let's go through all the available solutions to display video streams in your dashboard:

### Dashboard gets MJPEG stream directly from IP camera
In this case the images don't pass through the Node-Red flow.  This can be implemented easily with a simple flow that only contains a single Template node, which puts an \<img\> element on the dashboard (with the camera URL as source):

![Stream directly flow](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_directly_flow.png)
```
[{"id":"4e44e10.85d262","type":"ui_template","z":"47b91ceb.38a754","group":"16a1f12d.07c69f","name":"Display image","order":1,"width":"6","height":"6","format":"<img width=\"16\" height=\"16\" src=\"http://200.36.58.250/mjpg/video.mjpg?resolution=640x480\" />\n","storeOutMessages":true,"fwdInMessages":true,"templateScope":"local","x":920,"y":1360,"wires":[[]]},{"id":"16a1f12d.07c69f","type":"ui_group","z":"","name":"Default","tab":"f136a522.adc2a8","order":1,"disp":true,"width":"6"},{"id":"f136a522.adc2a8","type":"ui_tab","z":"","name":"Home","icon":"home","order":1}]
```
As a result the dashboard html page will contain an \<img\> element, which gets its images directly from the IP camera MJPEG stream:
 
![Stream directly dashboard](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_directly_dashboard.png)
     
1. The \<img\> element requests an MJPEG stream from the IP camera.  
1. The IP camera responds by sending an endless stream of images (i.e. an MJPEG stream).  
1. The browser will render the images (i.e. the images are displayed in the dashboard).

That is simple and works fine.  However suppose the Node-Red flow needs to receive the images directly from the camera, do some image processing and *display the manipulated images on your dashboard*.  For example a rectangle should be drawn around every human face. Then this solution won't be sufficient ...

### Push the images to the dashboard
The flow could get the images from the camera (using a HttpRequest or MultipartStreamDecoder node), do some image processing and afterwards push the manipulated images (via websocket) to the dashboard:

![Stream push websocket](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_push_websocket.png)
```
[{"id":"db5630e7.83cdc","type":"multipart-decoder","z":"47b91ceb.38a754","name":"","ret":"bin","url":"http://200.36.58.250/mjpg/video.mjpg?resolution=640x480","tls":"","delay":0,"maximum":"10000000","x":590,"y":1240,"wires":[["6535feb.cbf33"]]},{"id":"dfcc9a31.860948","type":"inject","z":"47b91ceb.38a754","name":"Start stream","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":"","x":389.8333435058594,"y":1240.0000381469727,"wires":[["db5630e7.83cdc"]]},{"id":"6535feb.cbf33","type":"base64","z":"47b91ceb.38a754","name":"Encode","x":780,"y":1240,"wires":[["fb64a032.e945b"]]},{"id":"fb64a032.e945b","type":"ui_template","z":"47b91ceb.38a754","group":"16a1f12d.07c69f","name":"Display image","order":1,"width":"6","height":"6","format":"<img width=\"16\" height=\"16\" src=\"data:image/jpg;base64,{{msg.payload}}\" />\n","storeOutMessages":true,"fwdInMessages":true,"templateScope":"local","x":958.2569236755371,"y":1240.4166660308838,"wires":[[]]},{"id":"16a1f12d.07c69f","type":"ui_group","z":"","name":"Default","tab":"f136a522.adc2a8","order":1,"disp":true,"width":"6"},{"id":"f136a522.adc2a8","type":"ui_tab","z":"","name":"Home","icon":"home","order":1}]
```     
1. The flow requests an MJPEG stream from the IP camera.  
1. The IP camera responds by sending an endless stream of images (i.e. an MJPEG stream).  
1. The flow will do some image processing and send the message (image in `msg.payload`) to the template node.  
1. The template node will push the message - via a websocket channel - to the dashboard.  
1. The source of the \<img\> element in the html will (constantly) being updated to refer to the latest image.  
1. The browser will render the images (i.e. the images are displayed in the dashboard).
    
That is again simple and works fine.  However if you want to display multiple cameras (with higher frame rates) simultaneously, keep in mind that all the updated data (graphs, node statusses, debug panel messages, images ...) will be pushed through a single websocket channel to the dashboard! *When too much data is being pushed through that single websocket channel, the browser will start freezing*. Then this solution won't be sufficient ... 

### Dashboard gets MJPEG stream via the Node-Red flow
The flow could get the images from the camera (using a HttpRequest or MultipartStreamDecoder node), do some image processing and afterwards the dashboard will request the manipulated images stream from the flow.

This means that the dashboard should be setup with a single template node, similar to the first alternative.  However the image needs to be requested from the Node-Red flow (instead of from the IP camera), so the Node-Red flow IP address should be specified:
   
![Stream via NR dashboard](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_via_nodered_flow.png)

The encoder node allows us to create a Node-Red flow that behaves like an IP camera, which means you can 'request' a live video stream from your flow:*
     
![Stream via NR flow](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_via_nodered_dashboard.png)

1. The flow requests an MJPEG stream from the IP camera.  
1. The IP camera responds by sending an endless stream of images (i.e. an MJPEG stream).  
1. The flow will do some image processing and send the message (image in `msg.payload`) to the encoder node.  
1. The \<img\> element in the html will request an MJPEG stream from the flow.  The ExpressJs webserver will send the request to the HttpIn node, since the URL contains '/videostream'.
1. The HttpIn node forwards the request (wrapped in a message) to the encoder node.  
1. The encoder node creates an MJPEG stream from all the images, and sends that stream to the dashboard.  
1. The browser will render the images (i.e. the images are displayed in the dashboard).

Remark: The [node-red-contrib-multipart-stream-decoder](https://www.npmjs.com/package/node-red-contrib-multipart-stream-decoder) is used to decode the MJPEG stream from the IP camera, and convert it to separate images.  

## Request/Response objects (Advanced)
As said before, the encoder node works closely together with the HttpIn node.  The communication between the HttpIn node and the encoder node will be setup in a number of steps: 
1. The ExpressJs will create two related objects for each http request: a Request object and a Response object.  
1. The HttpIn node will create an output message (request in `msg.payload` and responsein `msg.res`).  
1. The encoder node stores the response object for using it later on.  
1. The encoder node will send images (that arrive on its input) to those response objects.  

This way a single request will result in an endless response, i.e. a multipart stream ...
