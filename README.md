# node-red-contrib-multipart-stream-encoder
Node-Red node for encoding multipart streams over http

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-multipart-stream-encoder
```

## Usage
This node works closely together with the http-in node.  

The goal is to setup a stream over http, to create a continous sequence of data elements.  These elements can create any kind of data (text, images, ...). One of the most known examples is an **MJPEG stream**, to receive continously JPEG images (like a video stream).  

***The encoder converts (payloads from) separate messages into a continuous stream.***  For example converting (payload) images into a continous MJPEG stream:

![Stream encoder](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_encoder.png)

By showing multiple of those MJPEG streams simultaneously in the Node-Red dashboard, we can start building a video surveillance application: see below an example flow to accomplish this kind of behaviour.

### Comparison with the http-response node
In a lot of other use cases **no streaming** is required.  When a question (= http request) arrives at the http-in node, a simple answer (= http response) by the http-response node will be sufficient.  For example somebody asks a single snapshot image (from a camera, stored on disc, ...), and the Node-Red flow will return that image:

![Request response](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/request_response.png)

Following steps will be executed, to have a http request result in a single (finite) http response:
1. An URL is entered, pointing to our Node-Red installation.
1. An http request arrives in ExpressJs (web application framework of NodeJs).
1. Since the request maps to the URL path in our http-in node, the request will be passed to that node.
1. The http-in node will create an output message, containing the request object in the `msg.payload` field and the response object in the `msg.res` field.
1. In the template node e.g. some extra html content could be provided.
1. The http-response node sends the content to the response object
1. The http response is returned to the browser where it will be rendered for the user

### Stream encoder explained
Now we are going to use the http-in node together with the node-red-contrib-multipart-stream-encoder node.

In some cases we want very fast a lot of data.  For example we want to get N camera images per second from our Node-Red flow, to make sure we can display fluent video.  *That is not possible with the above mechanism*, since we would have to wait all the time:
1. Ask image 1
1. Wait for image 1
1. Ask image 2
1. Wait for image 2
1. ...

In those latter cases it is much better to use http streaming.  We get a ***single*** http request from the http-in node, and then the we return an (in)finite stream of images.  

![Request stream](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/request_stream.png)

Following steps will be executed, to have a http request result in a (in)finite http stream.  I.e. once the the encoder node has received a response object, it will start streaming all data (that is receives via messages on it's input port) to that response object:
1. A (stream) URL is entered, pointing to our Node-Red installation.
1. An http request arrives in ExpressJs (web application framework of NodeJs).
1. Since the request maps to the URL path in our http-in node, the request will be passed to that node.
1. The http-in node will create an output message, containing the request object in the `msg.payload` field and the response object in the `msg.res` field.
1. The encoder node is going to remember the response object - from `msg.res` - for using it later on.  
1. Other nodes in the flow can send images to the encoder node.
1. The encoder node will send those images to the response objects that it has remembered
1. The mjpeg camera stream is returned to the browser, where it will be rendered to the user.

This way the response has become endless (with a *boundary* string as separator between images):
```
   global headers
   part headers 
   image
   boundary
   part headers
   image
   boundary
   part headers
   image
   boundary 
   ...
```
Remark: this is **NOT** mp4 streaming.  In our case each image is compressed (as jpeg), but an mp4 stream also compresses the entire stream (by only sending differences between the images).

#### Stopping a stream
A stream (i.e. a response to some client) can be stopped in different ways:
+ The flow can send a message to the encoder node, containg a `msg.stop` with value *true*.  Remark: the payload of this message will not be streamed anymore!
+ The client (e.g. browser) can disconnect from the Node-Red flow.

For a finite stream (e.g. playing recorded video footage), it might be useful to send a message with `msg.stop` = true to the encoder node (as soon as all data has been sent).  In that case, the encoder will stop the http response (which is specified in the `msg.res` field).  Otherwise the client keeps waiting for data, while the stream has already ended (since all data has been streamed already).  E.g. in Chrome the tabsheet will have contain a spinning wheel as long as the response is not yet complete:

![Stream tabsheets](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_tabsheets.png)

#### Stream has stopped
Once a stream has been ended, you can specify on the config screen (by means of two checkboxes) which of the following messages should be send on the output port:

+ *Output message for every closed connection*: A message can be generated for *every* closed stream, with the `msg.res` field containing the (closed) response object. 
+ *Output message when all connections closed*: An empty message can be generated as soon as *all* streams have been closed.

#### Stream to all clients or not
In the config screen, the encoder ***destination*** can be specified
+ All clients
+ Single client (thanks to [Nick O'Leary](https://github.com/knolleary) who provided me the basic idea for this option !)

***1. ALL CLIENTS***

Watching camera images from our Node-Red flow, is an example of an infinite stream.  All clients hook in to the same existing stream, and ***they all receive the same data from that moment on***.  Indeed for e.g. a camera stream, you only need to see the images from now on (not the old ones).  Note that other nodes in the flow can pass data (e.g. images) to the encoder node, even when no clients are listening: the data will simply be ignored.

![Stream all](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all.png)
```
[{"id":"7f2b6b5c.691b64","type":"http in","z":"15244fe6.9ae87","name":"","url":"/infinite","method":"get","upload":false,"swaggerDoc":"","x":570,"y":120,"wires":[["5b3e4039.df33b"]]},{"id":"5b3e4039.df33b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":false,"ignoreMessages":true,"outputIfSingle":true,"outputIfAll":true,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","x":781,"y":120,"wires":[["ca54ad09.d6904"]]},{"id":"fb72a642.df0eb8","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":560,"y":180,"wires":[["5b3e4039.df33b"]]},{"id":"f8b8895a.77a838","type":"interval","z":"15244fe6.9ae87","name":"Every second","interval":"1","onstart":false,"msg":"ping","showstatus":false,"unit":"seconds","statusformat":"YYYY-MM-D HH:mm:ss","x":150,"y":180,"wires":[["59a9f54a.322d2c"]]},{"id":"59a9f54a.322d2c","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":340,"y":180,"wires":[["fb72a642.df0eb8"]]},{"id":"3ffa9ebc.86a872","type":"comment","z":"15244fe6.9ae87","name":"Stream to all clients","info":"","x":170,"y":120,"wires":[]},{"id":"ca54ad09.d6904","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"res","x":954,"y":120,"wires":[]}]
```
The result - when clients are connecting at different times - looks like this:

![Stream all result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single_result.png)

As soon as a http request arrives (via the http-in node), that message will be passed to the encoder node to register the response object (in the `msg.res` field).  The payload of that message will not be streamed, since it contains information from the http-in node (which would break our stream).  The payload from the next messages will be streamed, and those message are ***not allowed to have a `msg.res` field***!

***2. SINGLE CLIENT***

However in some cases each client wants to have its own stream: that is what the single client option is designed for.  E.g. when camera images have been stored, ***each client wants to get the entire stream from the beginning***.  Now for each http request, other nodes should be triggered to start capturing data (and send that data to the encoder node).  It is important that ***all messages should contain the response object in the `msg.res` field***, so the encoder node knows which data needs to be send to which client!

![Stream single](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single.png)

```
[{"id":"bc87df5c.bc323","type":"http in","z":"15244fe6.9ae87","name":"","url":"/finite","method":"get","upload":false,"swaggerDoc":"","x":160,"y":660,"wires":[["218fb2a5.4ba8ae"]]},{"id":"bff8aa99.c07c98","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":518,"y":660,"wires":[["4dc14794.f344e8"]]},{"id":"422deea9.f5539","type":"comment","z":"15244fe6.9ae87","name":"Stream per client","info":"","x":180,"y":620,"wires":[]},{"id":"4dc14794.f344e8","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":true,"ignoreMessages":true,"outputIfSingle":true,"outputIfAll":false,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"single","x":713,"y":660,"wires":[["2216a759.8dc718"]]},{"id":"2216a759.8dc718","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"true","x":899,"y":660,"wires":[]},{"id":"218fb2a5.4ba8ae","type":"function","z":"15244fe6.9ae87","name":"Msg factory","func":"// Repeat the msg every second\nvar repeatInterval = 1000;\n\ncontext.set('counter', 0);\n\nvar interval = setInterval(function() {\n    var counter = context.get('counter') || 0;\n    counter = counter + 1;\n    context.set('counter', counter);\n    \n    msg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n    \n    if(counter >= 15) {\n        msg.stop = true;\n        clearInterval(interval);\n    }\n    \n\tnode.send(msg);\n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":328,"y":660,"wires":[["bff8aa99.c07c98"]]}]
```
Remark: the function node sends a `msg.stop` value 'true' in the last message, to make sure the clients stop waiting for further data.

The result - when clients are connecting at different times - looks like this:

![Stream single result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all_result.png)

Keep in mind that - when having a separate stream for each client - it might be necessary that the flow keeps track of the responses that are being closed.  When client A connects, the flow will start a stream A' for that client.  Some time later another client B connects, so the flow will start a new stream B'.  However when one of these clients disconnects from our flow, it has become useless to keep on sending data to the encoder node (for that specific client): it is just a waste of resources...  This can be solved by reacting to messages on the encoder node's output port: *as soon as a client disconnects, an output message will be generated (which can be used as a trigger to stop sending data to the encoder node)*.

### Adaptive streaming
When we are sending lots of messages to the encoder node (containing lots of data in the payloads), we would run into troubles if the stream cannot handle all that data.  For example if we have a slow network or a slow client system.  In that case the stream buffer would start growing until all memory would be consumed.  At the end our system would stop functioning correctly.

This can be solved by enabling the 'Ignore messages if stream is overloaded' checkbox on the config screen.  When the stream cannot process all messages, the encoder node will start ignoring input messages.  As soon as the stream is again ready to process new data, the encoder node will again start processing input messages.  For example for MJPEG streaming, it is better to send less images than to have a malfunctioning system...

## Camera images in the dashboard
Until now we have explained how the flow can produce a continous stream of data.  Now let's explain how these streams can be displayed in the dashboard, to display fluent video.

### Push images to \<img> tag via websocket
When no streaming is available, images can be displayed by pushing (base64 encoded) images directly in a template node:

![Websocket img](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/websocket_img.png)
```
[{"id":"90451acf.31d448","type":"base64","z":"15244fe6.9ae87","name":"Encode","x":680,"y":440,"wires":[["be6e7879.a25738"]]},{"id":"851ba01f.79fab","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":500,"y":440,"wires":[["90451acf.31d448"]]},{"id":"cbb960e1.b9a11","type":"interval","z":"15244fe6.9ae87","name":"Every second","interval":"1","onstart":false,"msg":"ping","showstatus":false,"unit":"seconds","statusformat":"YYYY-MM-D HH:mm:ss","x":110,"y":440,"wires":[["60e716b5.8e0f48"]]},{"id":"60e716b5.8e0f48","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":300,"y":440,"wires":[["851ba01f.79fab"]]},{"id":"be6e7879.a25738","type":"ui_template","z":"15244fe6.9ae87","group":"16a1f12d.07c69f","name":"Display image","order":1,"width":"6","height":"6","format":"<img width=\"16\" height=\"16\" alt=\"mjpeg test...\" src=\"data:image/jpg;base64,{{msg.payload}}\" />\n","storeOutMessages":true,"fwdInMessages":true,"templateScope":"local","x":860,"y":440,"wires":[[]]},{"id":"16a1f12d.07c69f","type":"ui_group","z":"","name":"Default","tab":"f136a522.adc2a8","order":1,"disp":true,"width":"6"},{"id":"f136a522.adc2a8","type":"ui_tab","z":"","name":"Home","icon":"home","order":1}]
```
Images are pushed - via a websocket channel - to the browser, where the template node renders an \<img> HTML tag that get's the image from the payload:
```html
<img width="16" height="16" alt="mjpeg test..." src="data:image/jpg;base64,{{msg.payload}}" />
```
However *all* data that is being send by the Node-Red flow (to the dashboard), is communicated through a single websocket channel.  When multiple camera's are being displayed, the browser stops responding.  It seems like a single browser thread needs to handle all the websocket data, which becomes just too much ...

### Multipart stream as resource for \<img> tag
Let's rewrite the template node: now the \<img> tag gets all the data by itself from our Node-Red flow, by the source ('src') which connects to our http-in node (to get a multipart stream):
```html
<img width="16" height="16" alt="MJPEG STREAM" autoplay src="https:/<your_ip_address>:1880/infinite" />
```
When we add multiple of those template nodes (each of them pointing to a different http-in node), we can display multiple camera streams simultaneously in our dashboard:

![Multipart grid](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/multipart_grid.png)

Now it looks like each \<img> element gets it's own browser thread (to render it's video stream), because the browser doesn't freeze anymore.

## Http headers
At the start of the stream, ***global http headers*** will be send.  Afterwards each part of the multipart stream will contain ***part http headers***, followed by the real data (e.g. an image).

To make sure the client understands that a stream has been setup, both type of headers need some minimal entries:
+ Global headers : the content-type should mention the 'multipart' type, and by disabling all kind of caching we make sure that all data is being handled (instead of using previous data from the cache).
+ Part headers : the content-type should reflect the type of data that we are sending, so the client knows how to render that data (e.g. image/jpeg).  Remark: if a content-length is specified, it will be replaced by the content length calculated by the encoder node.

By default, all required http headers (on both levels) will be available in the config screen.  You can always replace them or add new ones, but make sure you don't remove mandatory headers (or the stream will fail)!!

***None*** of both headers can be specified via the `msg.headers` field! 
