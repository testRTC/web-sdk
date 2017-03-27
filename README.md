# testRTC Web SDK
This repository contains the testRTC Web SDK, along with a couple of usage examples.

The SDK is geared towards those who want to collect WebRTC related data manually from a test they are running inside a browser, log and analyze it as part of the testRTC environment.

This can be useful in situations where:
1. There are tests you wish to run manually and not automate them (too complex to script, one time, etc)
2. You want to add some real users to a session that is handled in a WebRTC stress test orchestrated by testRTC
3. You want to test unsupported browsers with testRTC
4. You want to test inside a plugin or a Chromium Electron application


## Installing
To use the testRTC Web SDK in the browser, add the following script tag to your
HTML pages, preferably at the head of the page:
```
<script src="https://resources.testrtc.com/sdk/testRTC-sdk.js"></script>
```

Now you will need to initiailze the SDK itself to connect it with the testRTC server.

## Usage
Initialize the SDK with the following parameters:
```javascript
TestRTC.init(options, callback);
 ```
 * ``options.apiKey`` {String} - The API key for your project. [How to generate API key](https://testrtc.freshdesk.com/support/solutions/articles/9000064726-view-our-api-documentation)
 * ``options.debug`` {Boolean} - The option for logging each state of SDK process to console. We suggest setting this to false by default
 * ``options.inject`` {Boolean} - If true, SDK will start the process of collecting data immediately after Initialization. Setting value to false will require you to indicate when you want to explicitly upload the collected data to testRTC
 * ``callback``  {Function} - An error callback

## Upload data to the testRTC server
If you set options.inject to false in the initialization of the SDK, then you will need to explicitiy indicate when you want to upload the data colleced to the testRTC server for further analysis. This is achieved by using this function
```javascript
TestRTC.upload(finalized, callback)
```
* ``finalized`` {Boolean} - Informs if it is the end of the test. If set to false, then the SDK will expect additional calls of this function to take place later on
* ``callback``  {Function} - An error callback


## Example of usage
#### Peer connection
1. Clone this repository
2. Edit '/examples/peerconnection/js/main.js', replace 'YOUR_API_KEY' by actual key --> make sure you don't store your API key in a public repository
3. Open /examples/peerconnection/index.html in your browser
4. Open the dev console to see the progress of the session
5. Click "Start", then "Call" and when you are done, click "Hang Up"
6. If you see the message "Uploading data is succeed." Then the test succeded and you should be able to see the data collected in the testRTC console
