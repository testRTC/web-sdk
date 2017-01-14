# TestRTC Web SDK
This repository contains the TestRTC Web SDK itself and examples of usage.


## Installing
To use the TestRTC Web SDK in the browser, simply add the following script tag to your
HTML pages:
```
<script src="https://resources.testrtc.com/sdk/testRTC-sdk.js"></script>
```

## Using
First you need to initialize the SDK with next options:
```javascript
TestRTC.init(options, callback);
 ```
 * ``options.apiKey`` {String} - The API key for your project. [How to generate API key](https://testrtc.freshdesk.com/support/solutions/articles/9000064726-view-our-api-documentation)
 * ``options.debug`` {Boolean} - The option for logging each state of SDK process to console.
 * ``options.inject`` {Boolean} - If true, SDK will start process of collecting data immediately after initializing. Setting value to false - can be used for uploading data manually.
 * ``callback``  {Function} - The callback which receives error as first argument.

## Upload data to TestRTC server
Upload collected data to TestRTC server for analyzing.
```javascript
TestRTC.upload(finalized, callback)
```
* ``finalized`` {Boolean} - Informs that it is the end of test.
* ``callback``  {Function} - The callback which receives error as first argument.


## Example of usage
#### Peer connection
1. Clone current repository.
2. Edit '/examples/peerconnection/js/main.js', replace 'YOUR_API_KEY' by actual key.
3. Open /examples/peerconnection/index.html in browser.
4. Open the dev console to see the progress.
5. Click "Start", then "Call" and when you are done, click "Hang Up".
6. If you see message "Uploading data is succeed." test went ok and you can see data in TestRTC panel.
