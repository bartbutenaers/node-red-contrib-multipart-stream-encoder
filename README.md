# node-red-contrib-multipart-stream-encoder
Node-Red node for encoding multipart streams over http

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-multipart-stream-encoder
```

## Usage
This node works closely together with the http-in node.  

The goal is to setup a stream over http, to receive a continous sequence of data elements.  One of the most known examples is an **MJPEG stream**, to receive continously JPEG images (like a video stream).  But all kind of data could be streamed, not only images.

By showing multiple of those MJPEG streams simultaneously in the Node-Red dashboard, we can start building a video surveillance application: see below an example flow to accomplish this kind of behaviour.

### Comparison with the http-response node
In lots of use cases **no streaming** is required.  When a question (= http request) arrives at the http-in node, a simple answer (= http response) by the http-response node will be sufficient.  For example somebody asks a single snapshot image (from a camera, stored on disc, ...), and the Node-Red flow will return that image:

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

In some cases we want very fast a lot of data.  For example we want to get fast images from our IP camera, to make sure we have a fluent video.  *That is not possible with the above mechanism*, since we would have to wait all the time:
1. Ask image 1
1. Wait for image 1
1. Ask image 2
1. Wait for image 2
1. ...

In those latter cases it is much better to use http streaming.  We get a ***single*** http request from the http-in node, and then the we return an (in)finite stream of images.  

![Request response](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/request_response.png)

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

Remark: this is **NOT** mp4 streaming.  In our case each image is compressed (as jpeg), but an mp4 stream also compresses the entire stream (by only sending differences between the images).

#### Stopping a stream
A stream (i.e. a response to some client) can be stopped in different ways:
+ The flow can send a message to the encoder node, containg a `msg.stop` with value *true*.
+ The client (e.g. browser) can disconnect from the Node-Red flow.

Once a stream has been ended, a message will be generated on the encoder's output port containing the (closed) response object in the 'msg.res' field.

For a finite stream (e.g. playing recorded video footage), it might be useful to send a message with `msg.stop` = true to the encoder node (as soon as all data has been sent).  In that case, the encoder will stop the http response (which is specified in the `msg.res` field).  Otherwise the client keeps waiting for data, while the stream has already ended (since all data has been streamed already).  E.g. in Chrome the tabsheet will have contain a spinning wheel as long as the response is not yet complete:

![Stream tabsheets](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_tabsheets.png)

#### Stream to all clients or not
In the config screen, the encoder *destination* can be specified
+ All clients
+ Single client (thanks to [Nick O'Leary](https://github.com/knolleary) who provided me the basic idea for this option !)

Watching the images from an IP camera is an example of an infinite stream.  **All clients** hook in to the existing stream, and they receive the data ***from that moment on***.  Indeed for e.g. a camera stream, you only need to see the images from now on (not the old ones).  Note that the flow can pass data (e.g. images) to the encoder node, even when no clients are listening: the data will simply be ignored.

![Stream all](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all.png)
```
[{"id":"7f2b6b5c.691b64","type":"http in","z":"15244fe6.9ae87","name":"","url":"/infinite","method":"get","upload":false,"swaggerDoc":"","x":590,"y":60,"wires":[["5b3e4039.df33b"]]},{"id":"5b3e4039.df33b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","x":782,"y":60,"wires":[[]]},{"id":"fb72a642.df0eb8","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":580,"y":120,"wires":[["5b3e4039.df33b"]]},{"id":"f8b8895a.77a838","type":"interval","z":"15244fe6.9ae87","name":"Every second","interval":"1","onstart":false,"msg":"ping","showstatus":false,"unit":"seconds","statusformat":"YYYY-MM-D HH:mm:ss","x":150,"y":120,"wires":[["59a9f54a.322d2c"]]},{"id":"59a9f54a.322d2c","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":360,"y":120,"wires":[["fb72a642.df0eb8"]]},{"id":"3ffa9ebc.86a872","type":"comment","z":"15244fe6.9ae87","name":"Infinite stream to all clients","info":"","x":191.83334350585938,"y":58.333351135253906,"wires":[]}]
```
The result - when clients are connecting at different times - looks like this:

![Stream all result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single_result.png)

However in some cases not all clients need to get the same stream: that is what the **single client** option is designed for.  E.g. when camera images have been stored, EACH client wants to see the ***entire stream from the beginning***.  Now for each http request, some nodes should be triggered to start capturing data (and send that data to the encoder node).  It is important that *all messages should contain the response object* in the `msg.res` field, so the encoder node knows which data needs to be send to which client!

![Stream single](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single.png)

```
[{"id":"bc87df5c.bc323","type":"http in","z":"15244fe6.9ae87","name":"","url":"/finite","method":"get","upload":false,"swaggerDoc":"","x":142,"y":260,"wires":[["218fb2a5.4ba8ae"]]},{"id":"bff8aa99.c07c98","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":500,"y":260,"wires":[["4dc14794.f344e8"]]},{"id":"422deea9.f5539","type":"comment","z":"15244fe6.9ae87","name":"Finite stream per client","info":"1. Ignore the msg.headers (arriving from the http request node)","x":181.83334350585938,"y":198.3333511352539,"wires":[]},{"id":"4dc14794.f344e8","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":true,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"single","x":698,"y":260,"wires":[["2216a759.8dc718"]]},{"id":"2216a759.8dc718","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"true","x":881,"y":260,"wires":[]},{"id":"218fb2a5.4ba8ae","type":"function","z":"15244fe6.9ae87","name":"Msg factory","func":"// Repeat the msg every second\nvar repeatInterval = 1000;\n\ncontext.set('counter', 0);\n\nvar interval = setInterval(function() {\n    var counter = context.get('counter') || 0;\n    counter = counter + 1;\n    context.set('counter', counter);\n    \n    msg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n    \n    if(counter >= 5) {\n        msg.stop = true;\n        clearInterval(interval);\n    }\n    \n\tnode.send(msg);\n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":310,"y":260,"wires":[["bff8aa99.c07c98"]]}]
```

The result - when clients are connecting at different times - looks like this:

![Stream single result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all_result.png)

Keep in mind that - when having a separate stream for each client - it might be necessary that the flow keeps track of the responses that are being closed.  When client A connects, the flow will start a stream A' for that client.  Some time later another client B connects, so the flow will start a new stream B'.  However when one of these clients disconnects from our flow, it has become useless to keep on sending data to the encoder node (for that specific client): it is just a waste of resources...  This can be solved by reacting to messages on the encoder node's output port: *as soon as a client disconnects, an output message will be generated* (with the response object in the `msg.res` field).

## Camera images in the dashboard
### Push images to \<img> tag via websocket
The easiest way is to push (base64 encoded) images directly in a template node:

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
Let's rewrite the template node: now the \<img> tag gets all the data by itself from our Node-Red flow, by the 'src' that is referring to our http-in node (to get a multipart stream):
```html
<img width="16" height="16" alt="MJPEG STREAM" autoplay src="https:/<your_ip_address>:1880/infinite" />
```
When we add multiple of those template nodes (each of them pointing to a different http-in node), we can display multiple camera streams simultaneously in our dashboard:

![Multipart grid](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/multipart_grid.png)

Now it looks like each /<img> tag gets it's own browser thread, because the browser doesn't freeze anymore.
