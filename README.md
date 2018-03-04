# node-red-contrib-multipart-stream-encoder
Node-Red node for encoding multipart streams over http

Note about version ***0.0.2***: [Simon Hailes](https://github.com/btsimonh) has been testing version 0.0.1 thoroughly.  A number of new features have been added to make this node more controllable.

## Install
Run the following npm command in your Node-RED user directory (typically ~/.node-red):
```
npm install node-red-contrib-multipart-stream-encoder
```

## Usage
This node works closely together with the HttpIn node.  The goal is to setup a stream over http, to create a continous high-speed sequence of data elements.  These elements can create any kind of data (text, images, ...). 

One of the most known examples is an **MJPEG stream**, to send continously JPEG images as a video stream.  We will use MJPEG streams as an example in the remainder of this page, however other data types are possible.

### Streaming basics
Sometimes data need to be received at high rates.  For example get N camera images per second, to be able to display fluent video.  

Such high data rates cannot be reached by sending a request for every image:
1. Request image 1
1. Wait for response image 1
1. Request image 2
1. Wait for response image 2
1. ...

Indeed this would result in too much overhead: we would have to wait all the time, some devices cannot handle the overflow of http requests, ...

In this case (http) streaming is preferred.  We send a ***single*** (http) request, and the response will be an (in)finite stream of images.  A *boundary* string will be used as a separator between the images:

   global headers  
   part headers  
   *image*  
   boundary  
   part headers  
   *image*  
   boundary  
   part headers  
   *image*  
   boundary   
   ...
   
Remark: this has nothing to do with *mp4 streaming*.  In a MJPEG stream each image is compressed (as jpeg), but an mp4 stream also compresses the entire stream (by only sending differences between the images). 

### Compare alternatives
To explain why this encoder node might be handy, let's go through all the available solutions to display video streams in your dashboard:

1. The dashboard can ***get an MJPEG stream directly from an IP camera***, which means the images don't pass through the Node-Red flow.  This can be implemented easily with a simple flow that only contains a single Template node, which puts an image element on the dashboard (with the camera URL as source):

    ![Stream directly flow](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_directly_flow.png)
    ```
    [{"id":"4e44e10.85d262","type":"ui_template","z":"47b91ceb.38a754","group":"16a1f12d.07c69f","name":"Display image","order":1,"width":"6","height":"6","format":"<img width=\"16\" height=\"16\" src=\"http://200.36.58.250/mjpg/video.mjpg?resolution=640x480\" />\n","storeOutMessages":true,"fwdInMessages":true,"templateScope":"local","x":920,"y":1360,"wires":[[]]},{"id":"16a1f12d.07c69f","type":"ui_group","z":"","name":"Default","tab":"f136a522.adc2a8","order":1,"disp":true,"width":"6"},{"id":"f136a522.adc2a8","type":"ui_tab","z":"","name":"Home","icon":"home","order":1}]
    ```

    As a result the dashboard html page will contain an image (img) element, which gets its images directly from the IP camera MJPEG stream:
 
     ![Stream directly dashboard](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_directly_dashboard.png)
     
      Step 1 : The image element requests an MJPEG stream from the IP camera.  
      Step 2 : The IP camera responds by sending an endless stream of images (i.e. an MJPEG stream).  
      Step 3 : The browser will render the images (i.e. the images are displayed in the dashboard).

    That is simple and works fine.  However suppose the Node-Red flow needs to receive the images directly from the camera, do some image processing and *display the manipulated images on your dashboard*.  For example a rectangle should be drawn around every human face. Then this solution won't be sufficient ...

2. The flow could get the images from the camera (using a HttpRequest or MultipartStreamDecoder node), do some image processing and afterwards ***push (via websocket) the manipulated images to the dashboard***:

     ![Stream push websocket](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_push_websocket.png)
    ```
     [{"id":"db5630e7.83cdc","type":"multipart-decoder","z":"47b91ceb.38a754","name":"","ret":"bin","url":"http://200.36.58.250/mjpg/video.mjpg?resolution=640x480","tls":"","delay":0,"maximum":"10000000","x":590,"y":1240,"wires":[["6535feb.cbf33"]]},{"id":"dfcc9a31.860948","type":"inject","z":"47b91ceb.38a754","name":"Start stream","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":"","x":389.8333435058594,"y":1240.0000381469727,"wires":[["db5630e7.83cdc"]]},{"id":"6535feb.cbf33","type":"base64","z":"47b91ceb.38a754","name":"Encode","x":780,"y":1240,"wires":[["fb64a032.e945b"]]},{"id":"fb64a032.e945b","type":"ui_template","z":"47b91ceb.38a754","group":"16a1f12d.07c69f","name":"Display image","order":1,"width":"6","height":"6","format":"<img width=\"16\" height=\"16\" src=\"data:image/jpg;base64,{{msg.payload}}\" />\n","storeOutMessages":true,"fwdInMessages":true,"templateScope":"local","x":958.2569236755371,"y":1240.4166660308838,"wires":[[]]},{"id":"16a1f12d.07c69f","type":"ui_group","z":"","name":"Default","tab":"f136a522.adc2a8","order":1,"disp":true,"width":"6"},{"id":"f136a522.adc2a8","type":"ui_tab","z":"","name":"Home","icon":"home","order":1}]
    ```     
      Step 1 : The flow requests an MJPEG stream from the IP camera.  
      Step 2 : The IP camera responds by sending an endless stream of images (i.e. an MJPEG stream).  
      Step 3 : The flow will do some image processing and send the message (image in `msg.payload`) to the template node.  
      Step 4 : The template node will push the message - via a websocket channel - to the dashboard.  
      Step 5 : The source of the image element in the html will (constantly) being updated to refer to the latest image.  
      Step 6 : The browser will render the images (i.e. the images are displayed in the dashboard).
    
    That is again simple and works fine.  However if you want to display multiple cameras (with higher frame rates) simultaneously, keep in mind that all the updated data (graphs, node statusses, debug panel messages, images ...) will be pushed through a single websocket channel to the dashboard! *When too much data is being pushed through that single websocket channel, the browser will start freezing*. Then this solution won't be sufficient ... 

3. The flow could get the images from the camera (using a HttpRequest or MultipartStreamDecoder node), do some image processing and afterwards the dashboard will ***request the manipulated images from the flow***.

   This means that the dashboard should be setup with a single template node, similar to the first alternative.  However the image needs to be requested fro the Node-Red flow (instead of from the IP camera), so the Node-Red flow IP address should be specified:
   
    ![Stream via NR dashboard](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_via_nodered_flow.png)

     *The encoder node allows us to create a Node-Red flow that behaves like an IP camera, which means you can 'request' a live video stream from your flow:*
     
    ![Stream via NR flow](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_via_nodered_dashboard.png)

      Step 1 : The flow requests an MJPEG stream from the IP camera.  
      Step 2 : The IP camera responds by sending an endless stream of images (i.e. an MJPEG stream).  
      Step 3 : The flow will do some image processing and send the message (image in `msg.payload`) to the encoder node.  
      Step 4 : The image element in the html will request an MJPEG stream from the flow. 
               The ExpressJs webserver will send the request to the HttpIn node, since the URL contains '/videostream'.
      Step 5 : The HttpIn node forwards the request (wrapped in a message) to the encoder node.  
      Step 6 : The encoder node creates an MJPEG stream from all the images, and sends that stream to the dashboard.  
      Step 7 : The browser will render the images (i.e. the images are displayed in the dashboard).

   Remark: The [node-red-contrib-multipart-stream-decoder](https://www.npmjs.com/package/node-red-contrib-multipart-stream-decoder) is used to decode the MJPEG stream from the IP camera, and convert it to separate images.  

***The encoder converts (payloads from) separate messages into a continuous stream.***  For example converting (payload) images into a continous MJPEG stream:

![Stream encoder](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_encoder.png)

In the remainder of this page, we will discuss only the last solution ...

### Request/Response objects (Advanced)
The communication between the HttpIn node and the encoder node in more detail:
1. The ExpressJs will create two related objects for each http request: a Request object and a Response object.  
1. The HttpIn node will create an output message (request in `msg.payload` and responsein `msg.res`).  
1. The encoder node stores the response object for using it later on.  
1. The encoder node will send images (that arrive on its input) to those response objects.  

This way a single request will result in an endless response, i.e. a multipart stream ...

#### Controlling a stream
The streams can be controlled in multiple ways:

+ ***Starting*** a stream is accomplished by the HttpIn node: as soon as this node sends a request message to the encoder, a stream will be started.
+ ***Pausing*** a stream is accomplished simply by not sending data to the encoder node.  But keep in mind that the requesting client might have specified a timeout, so the client might interrupt the connection afterwards.
+ ***Stopping*** a stream is accomplished by sending a control message to the encoder node, containg a `msg.stop` with value *true*.  Such a control message will not be streamed to the client.  Otherwise a stream can also be stopped by the requesting client, by disconnecting from the Node-Red flow (e.g. a dashboard that is being closed by the user).

### Keeping track of active requests
When no requests are currently active, this means that no clients are requesting data (i.e. no active client sessions).  In that case it is *adviced to stop sending data to the encoder*, to avoid performance loss.  However it is not easy to keep track of active requests from within a Node-Red flow: the HttpIn node sends a message for every new request, but under the hood ExpressJs will close the requests without you knowing it.

To solve this, the encoder node can generate following output message types (if specified in the node's config screen):
+ *Output message for every new connection* : when a new request is registered, a message is generated with `msg.res` containing the related response object.  The `msg.payload` field contains the new number of current connections.
+ *Output message for every closed connection* : when a request is closed, a message is generated with `msg.res` containing the related response object.  The `msg.payload` field contains the new number of current connections.
+ *Output message when all connections closed* : when all requests are closed, a message is created to indicate that.

## Stream to all clients or not
Based on the [feedback](https://groups.google.com/d/msg/node-red/NhzX6tN9xyI/5KieYZxwBAAJ) of Nick O’Leary, this encoder allows to stream the data to all clients or to a single client.

### Same stream for 'all clients'

Watching camera images from a Node-Red flow, is an example of an *infinite stream*.  The flow generates an endless stream of data, and all clients hook in to the same existing stream: clients are not interested in the previous old data (they only want to see the current camera images).  

![Stream all](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all.png)
```
[{"id":"7f2b6b5c.691b64","type":"http in","z":"15244fe6.9ae87","name":"","url":"/infinite","method":"get","upload":false,"swaggerDoc":"","x":570,"y":120,"wires":[["5b3e4039.df33b"]]},{"id":"5b3e4039.df33b","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":false,"ignoreMessages":true,"outputIfSingle":true,"outputIfAll":true,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"all","x":781,"y":120,"wires":[["ca54ad09.d6904"]]},{"id":"fb72a642.df0eb8","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":560,"y":180,"wires":[["5b3e4039.df33b"]]},{"id":"f8b8895a.77a838","type":"interval","z":"15244fe6.9ae87","name":"Every second","interval":"1","onstart":false,"msg":"ping","showstatus":false,"unit":"seconds","statusformat":"YYYY-MM-D HH:mm:ss","x":150,"y":180,"wires":[["59a9f54a.322d2c"]]},{"id":"59a9f54a.322d2c","type":"function","z":"15244fe6.9ae87","name":"Next image url","func":"var counter = global.get(\"image_counter\") || 0; \ncounter++;\nglobal.set(\"image_counter\",counter);\n\nmsg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n\nreturn msg;","outputs":1,"noerr":0,"x":340,"y":180,"wires":[["fb72a642.df0eb8"]]},{"id":"3ffa9ebc.86a872","type":"comment","z":"15244fe6.9ae87","name":"Stream to all clients","info":"","x":170,"y":120,"wires":[]},{"id":"ca54ad09.d6904","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"res","x":954,"y":120,"wires":[]}]
```
The clients are connecting at different times, but they all receive the same data at a particular moment in time: 

![Stream all result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single_result.png)

Note that other nodes in the flow can pass data (e.g. images) to the encoder node, even when no clients are listening: the data will simply be ignored by the encoder.  However it could be useful to stop processing data, when no clients are listening anymore.

Advanced: As soon as a the HttpIn node sends a request message, the encoder node will register the response object (from `msg.res` ).  The payload of that message will not be streamed, since it contains information from the http-in node (which would break our stream).  The payload from the next messages will be streamed, and those ***message are not allowed to have a `msg.res` field***!

### Separate stream for each 'Single client'

In some cases each client wants to have its own stream.  E.g. when camera images have been stored on disc, and that recorded video footage needs to be replayed afterwards in the dashboard.  In that case every client wants to see the entire video from the start: *each client wants to get the entire stream from the beginning*, independent of other clients.  

This means that the stream needs to be started (by the flow), as soon as a new client request arrives in the encoder.  I.e. the flow should start sending images to the encoder, as soon as a new client connects.  It is important that ***all messages should contain the response object (in the `msg.res` field)***, so the encoder node knows which data needs to be send to which client!

![Stream single](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_single.png)

```
[{"id":"bc87df5c.bc323","type":"http in","z":"15244fe6.9ae87","name":"","url":"/finite","method":"get","upload":false,"swaggerDoc":"","x":160,"y":660,"wires":[["218fb2a5.4ba8ae"]]},{"id":"bff8aa99.c07c98","type":"http request","z":"15244fe6.9ae87","name":"Get image by url","method":"GET","ret":"bin","url":"","tls":"","x":518,"y":660,"wires":[["4dc14794.f344e8"]]},{"id":"422deea9.f5539","type":"comment","z":"15244fe6.9ae87","name":"Stream per client","info":"","x":180,"y":620,"wires":[]},{"id":"4dc14794.f344e8","type":"multipart-encoder","z":"15244fe6.9ae87","name":"","statusCode":"","ignoreHeaders":true,"ignoreMessages":true,"outputIfSingle":true,"outputIfAll":false,"globalHeaders":{"Content-Type":"multipart/x-mixed-replace;boundary=--myboundary","Connection":"keep-alive","Expires":"Fri, 01 Jan 1990 00:00:00 GMT","Cache-Control":"no-cache, no-store, max-age=0, must-revalidate","Pragma":"no-cache"},"partHeaders":{"Content-Type":"image/jpeg"},"destination":"single","x":713,"y":660,"wires":[["2216a759.8dc718"]]},{"id":"2216a759.8dc718","type":"debug","z":"15244fe6.9ae87","name":"Encoder output","active":true,"console":"false","complete":"true","x":899,"y":660,"wires":[]},{"id":"218fb2a5.4ba8ae","type":"function","z":"15244fe6.9ae87","name":"Msg factory","func":"// Repeat the msg every second\nvar repeatInterval = 1000;\n\ncontext.set('counter', 0);\n\nvar interval = setInterval(function() {\n    var counter = context.get('counter') || 0;\n    counter = counter + 1;\n    context.set('counter', counter);\n    \n    msg.url = 'https://dummyimage.com/400x200/fff/000&text=PNG+' + counter;\n    \n    if(counter >= 15) {\n        msg.stop = true;\n        clearInterval(interval);\n    }\n    \n\tnode.send(msg);\n}, repeatInterval); \n\nreturn null;","outputs":1,"noerr":0,"x":328,"y":660,"wires":[["bff8aa99.c07c98"]]}]
```
Remark: the function node sends a `msg.stop` value 'true' in the last message, to make sure the clients are informed that the stream has ended.  Otherwise those clients would keep waiting for new data parts.

The clients are connecting at different times, but they all get the entire stream from the start:

![Stream single result](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_all_result.png)

Note that other nodes in the flow can pass data (e.g. images) to the encoder node, even when the client is not listening anymore: the data will simply be ignored by the encoder.  However it will be useful to stop processing data to a specific client, when that client isn't listening anymore.  Otherwise resources would be wasted. This can be solved by reacting to messages on the encoder node's output port: *as soon as a client disconnects, an output message will be generated (which can be used as a trigger to stop sending data to the encoder node)*.  

When all data has been send to the encoder, end the stream by a message with `msg.stop` = true.  As a result, the encoder will stop the http response (which is specified in the `msg.res` field).  Otherwise the client keeps waiting for data, while the stream has already ended (since all data has been streamed already).  E.g. in Chrome the tabsheet will have contain a spinning wheel as long as the response is not yet complete:

![Stream tabsheets](https://raw.githubusercontent.com/bartbutenaers/node-red-contrib-multipart-stream/master/images/stream_tabsheets.png)

## Adaptive streaming
When we are sending lots of messages to the encoder node (containing lots of data in the payloads), we would run into troubles if the stream cannot handle all that data.  For example if we have a slow network or a slow client system.  In that case the stream buffer would start growing until all memory would be consumed.  At the end our system would stop functioning correctly.

This can be solved by enabling the 'Ignore messages if stream is overloaded' checkbox on the config screen.  When the stream cannot process all messages, the encoder node will start ignoring input messages.  As soon as the stream is again ready to process new data, the encoder node will again start processing input messages.  For example for MJPEG streaming, it is better to send less images than to have a malfunctioning system...

## Http headers
At the start of the stream, ***global http headers*** will be send.  Afterwards each part of the multipart stream will contain ***part http headers***, followed by the real data (e.g. an image).

To make sure the client understands that a multipart stream has been setup, both type of headers need some minimal entries:
+ Global headers : the content-type should mention the 'multipart' type, and by disabling all kind of caching we make sure that all data is being handled (otherwise the client might incorrectly use old data from it's cache).
+ Part headers : the content-type should reflect the type of data that we are sending, so the client knows how to render that data (e.g. image/jpeg).  Remark: if a content-length is specified, it will be replaced by the content length calculated by the encoder node.

By default, all required http headers (on both levels) will be available in the config screen.  You can always replace them or add new ones, but make sure you don't remove mandatory headers (or the stream will fail)!!

***None*** of both headers can be specified via the `msg.headers` field! 
