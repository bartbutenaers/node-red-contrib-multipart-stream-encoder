# node-red-contrib-multipart-stream
Node-Red nodes for encoding and decoding multipart streams over http

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-multipart-stream
```

## Usage
This node works closely together with the http-in node.  

### Comparison with the http-response node
Normally the http-in node is being used together with the http-response node:

![Request response](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/request_response.png)

In such a flow, a http request results in a single (finite) http response. 
1. An url is entered, pointing to our Node-Red installation
1. An http request arrives in ExpressJs 
1. Since it maps to the URL path in our httpin node, the request is passed to that node
1. The httpin node will add the request object in the `msg.payload` field, and add the response object in the `msg.res` fields
1. In the template node e.g. some html can be provided
1. The httpresponse node sends the content to the response object
1. The http response is returned to the browser where it will be rendered for the user

### Streaming explained
Now let's see the difference when the http-in node is being used together with the node-red-contrib-multipart-stream encoder node:

![Request response](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/request_response.png)

In this flow, a http request results in a infinite or finite http stream.  I.e. once the the encoder node has received a response object, it will start streaming all data (that is receives on it's input port) to that response object:
1. An (stream) url is entered, pointing to our Node-Red installation
1. An http request arrives in ExpressJs 
1. Since it maps to the URL path in our httpin node, it is passed to that node
1. The httpin node will add the (wrapped) request object in the `msg.payload` field, and add the response object in the `msg.res` fields
1. The encoder node is going to remember the response (wrapper) - from `msg.res` - for using it later on.  
1. Another part of the flow is sending images to the encoder node.
1. The encoder node will send the images to the response objects that it has remembered
1. The mjpeg camera stream is returned to the browser, where it will be rendered to the user.

This way the response has become endless:
<global headers> 
<part headers> 
<image> 
<boundary> 
<part headers> 
<image> 
<boundary> 
<part headers> 
<image> 
<boundary> 
...

### Stopping a stream
A stream (i.e. a response to some client) can be stopped in different ways:
+ The flow can send a message to the encoder node, containg a `msg.stop` with value *true*.
+ By the client (e.g. browser) that disconnects from our Node-Red flow.

Once a stream has been ended, a message will be generated on the encoder's output port containing the (closed) response object in the 'msg.res' field.

### Stream to all clients or not
In the config screen, the encoder *destination* can be specified
+ All clients
+ Single client (thanks to [Nick O'Leary](https://github.com/knolleary) who provided me the basic idea for this option !)

The screenshot above is a nice example of **all clients**: an infinite stream of camera images is running through our flow.  ALL clients hook in to the existing stream, and they receive the data FROM THAT MOMENT ON.  Indeed for e.g. a camera stream, you only need to see the current new images (not the old ones).  The flow can pass data (e.g. images) to the encoder node, even when no clients are listening: the data will simply be ignored.

![Stream all](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all.png)
```
[{"id":"7f2b6b5c.691b64","type":"http in","z":"15244fe6.9ae87","name":"","url":"/infinite","method":"get","upload":false,"swaggerDoc":"","x":590,"y":60,"wires":[["5b3e4039.df33b"]]},{"id":"5b3e4039.df33b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","x":782,"y":60,"wires":[[]]},{"id":"fb72a642.df0eb8","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":580,"y":120,"wires":[["5b3e4039.df33b"]]},{"id":"f8b8895a.77a838","type":"interval","z":"15244fe6.9ae87","name":"Every second","interval":"1","onstart":false,"msg":"ping","showstatus":false,"unit":"seconds","statusformat":"YYYY-MM-D HH:mm:ss","x":150,"y":120,"wires":[["59a9f54a.322d2c"]]},{"id":"59a9f54a.322d2c","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":360,"y":120,"wires":[["fb72a642.df0eb8"]]},{"id":"3ffa9ebc.86a872","type":"comment","z":"15244fe6.9ae87","name":"Infinite stream to all clients","info":"","x":191.83334350585938,"y":58.333351135253906,"wires":[]}]
```
So this is the result when clients are connecting at different times:

![Stream all result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all_result.png)

However in some cases not all clients need to get the same stream: that is what the **single client** option is designed for.  E.g. when camera images have been stored, EACH client wants to see the ENTIRE STREAM FROM THE BEGINNING.  In this case a part of the flow should be started (to capture data) for every client that connects.  And *all* messages should contain the response object in the `msg.res` field, so the encoder node knows which data needs to be send to which client.

![Stream single](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single.png)

```
[{"id":"bc87df5c.bc323","type":"http in","z":"15244fe6.9ae87","name":"","url":"/finite","method":"get","upload":false,"swaggerDoc":"","x":142,"y":260,"wires":[["218fb2a5.4ba8ae"]]},{"id":"bff8aa99.c07c98","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":500,"y":260,"wires":[["4dc14794.f344e8"]]},{"id":"422deea9.f5539","type":"comment","z":"15244fe6.9ae87","name":"Finite stream per client","info":"1. Ignore the msg.headers (arriving from the http request node)","x":181.83334350585938,"y":198.3333511352539,"wires":[]},{"id":"4dc14794.f344e8","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":true,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"single","x":698,"y":260,"wires":[["2216a759.8dc718"]]},{"id":"2216a759.8dc718","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"true","x":881,"y":260,"wires":[]},{"id":"218fb2a5.4ba8ae","type":"function","z":"15244fe6.9ae87","name":"Msg factory","func":"// Repeat the msg every second\nvar repeatInterval = 1000;\n\ncontext.set('counter', 0);\n\nvar interval = setInterval(function() {\n    var counter = context.get('counter') || 0;\n    counter = counter + 1;\n    context.set('counter', counter);\n    \n    msg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n    \n    if(counter >= 5) {\n        msg.stop = true;\n        clearInterval(interval);\n    }\n    \n\tnode.send(msg);\n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":310,"y":260,"wires":[["bff8aa99.c07c98"]]}]
```

So this is the result when clients are connecting at different times:

![Stream single result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single_result.png)

Keep in mind that - when having a separate stream for each client - it might be necessary that the flow keeps track of the responses that are being closed.  When client A connects, the flow will start a stream A' for that client.  Some time later another client B connects, so the flow will start a new stream B'.  However when one of these clients disconnects from our flow, it has become useless to keep on sending data to the encoder node (for that specific client): it is just a waste of resources...  This can be solved by reacting to messages on the encoder node's output port: as soon as a client disconnects, an output message will be generated (with the response object in the `msg.res` field).

Moreover in case of a finite stream (e.g. playing recorded video footage), it might be usefull to send a message with `msg.stop` = true to the encoder node.  In that case, the encoder will stop the http response (which is specified in the `msg.res` field).  Otherwise the client keeps waiting for data, while the stream has already ended (since all data has been streamed already).  E.g. in Chrome the tabsheet will have contain a spinning wheel as long as the response is not yet complete:

![Stream tabsheets](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_tabsheets.png)
