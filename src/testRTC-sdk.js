/**
 * TestRTC remote API
 * Usage:
 *  - add a <script> tag pointing to this file to the <head> before any other scripts
 *  - right after it add another <script> and initialize SDK:
 *      TestRTC.init({
 *        apiKey: 'YOUR_API_KEY',
 *        debug: true,
 *        inject: true
 *      }, function (err) {
 *
 *      });
 *  - once SDK is properly initilized, callback will be called without error
 *  - since that you can call TestRTC.upload(finalize, callback) where finalize should be set to true if test has ended
 */

(function(window, TestRTC) {

    // Some constants
    var API_URL = 'https://api.testrtc.com/v1/';
    var API_TRANSPORT = 'https';
    var DEFAULT_TEST_NAME = 'Unnamed remote test';

    // Client options
    TestRTC.debug = false;
    TestRTC.apiKey = '';
    TestRTC.apiUrl = API_URL;
    TestRTC.inject = true;

    TestRTC.isFinalized = false;

    // Transport instance
    TestRTC.transportInstance = null;

    var RTCPeerConnectionNames = [],
    prefixes = ['', 'webkit'],
    defaultConstructorProperties = Object.getOwnPropertyNames(new Function());

    prefixes.forEach(function(prefix) {
      if (!window[prefix + 'RTCPeerConnection']) {
        return;
      }

      RTCPeerConnectionNames.push(prefix + 'RTCPeerConnection');
    });

    // Transport implementation
    var Transport = {
        'https': function() {
            function doPOST(path, data, cb) {
                var xhr = new XMLHttpRequest(),
                    data = data || {};

                xhr.onload = function() {
                    if (this.status !== 200) {
                        return cb && cb(new Error('Error querying API. Status: ' + this.status));
                    }

                    var response = {};
                    try {
                        response = JSON.parse(this.response);
                    } catch (e) {}
                    cb && cb(null, response);
                };
                xhr.onerror = function() {
                    cb && cb(new Error('Error querying API. Status: ' + this.status));
                };

                xhr.open('POST', TestRTC.apiUrl + path, true);
                xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                xhr.setRequestHeader("apikey", TestRTC.apiKey);
                xhr.send(JSON.stringify(data));
            }

            var testRunId;

            /**
             * Initialize transport and create a test run
             */
            this.init = function(name, cb) {
                doPOST('tests/remote/run', { name: name }, function(err, response) {
                    if (err) {
                        return cb(err);
                    }
                    testRunId = response.testRunId;
                    cb(null, response.testRunId);
                });
            };

            this.upload = function(data, isLastChunk, cb) {
                if (!testRunId) {
                    return cb(new Error('No test run ID available'));
                }
                doPOST('testruns/remote/' + testRunId + '/stats', { data: data, isLastChunk: isLastChunk }, cb);
            };
        },
        'websocket': function() {
            throw new Error('Transport "websocket" is not yet implemented');
        }
    }

    function debug() {
        if (!TestRTC.debug) {
            return;
        }

        var args = ['%cTestRTC', 'background: blue; color: yellow'].concat(Array.prototype.slice.call(arguments));
        return console.log.apply(console, args);
    }

    function inject() {
        window.___testRTCTestAgent = {
            nextChannelId: 0,
            knownChannels: {},
            stats: {},
            extra: {},
            prefixIndex: 0
        };

        function onIceConnectionStateChange() {
            var self = this;
            switch(this.iceConnectionState) {
            case 'connected':
            case 'completed':
                this.removeEventListener('iceconnectionstatechange', arguments.callee);
                this.getStats(function(response) {
                    var reports = response.result();
                    var stats = {};
                    reports.forEach(function(report) {
                        stats[report.id] = {
                            id: report.id,
                            type: report.type
                        };
                        report.names().forEach(function(name) {
                            stats[report.id][name] = report.stat(name);
                        });
                    });
                    Object.keys(stats).forEach(function(id) {
                        var report = stats[id];
                        if (report.type === 'googCandidatePair' && report.googActiveConnection === 'true') {
                            var localCand = stats[report.localCandidateId];
                            //var remoteCand = stats[report.remoteCandidateId];
                            window.___testRTCTestAgent.extra[self.___testRTCChannelId].localCand = localCand;
                            // contains information on ip addresses and more importantly priority.
                            // priority >> 24 gives TURN type (udp=2/tcp=1/tls=0)
                        }
                    });
                }, null);
            }
        }

        function getSDP() {
            switch(this.iceConnectionState) {
            case 'connected':
            case 'completed':
            case 'failed':
                this.removeEventListener('iceconnectionstatechange', arguments.callee);
                // inspect for number of candidates etc.
                window.___testRTCTestAgent.extra[this.___testRTCChannelId].localDescription = this.localDescription;
                window.___testRTCTestAgent.extra[this.___testRTCChannelId].remoteDescription = this.remoteDescription;
            }
        }

        RTCPeerConnectionNames.forEach(function(originalRTCPeerConnectionName, idx) {
          var originalRTCPeerConnection = window[originalRTCPeerConnectionName],
              originalRTCPeerConnectionClose = originalRTCPeerConnection.prototype.close;

          originalRTCPeerConnection.prototype.close = function() {
            delete window.___testRTCTestAgent.knownChannels[this.___testRTCChannelId];
            return originalRTCPeerConnectionClose.apply(this, arguments);
          };

          window[originalRTCPeerConnectionName] = function(pcConfig, pcConstraints) {
            ___testRTCTestAgent.prefixIndex = idx;

            var conn = new originalRTCPeerConnection(pcConfig, pcConstraints);
            conn.___testRTCChannelId = window.___testRTCTestAgent.nextChannelId;
            window.___testRTCTestAgent.knownChannels[conn.___testRTCChannelId] = conn; 
            window.___testRTCTestAgent.nextChannelId++;
            window.___testRTCTestAgent.extra[conn.___testRTCChannelId] = {};
            conn.addEventListener('iceconnectionstatechange', onIceConnectionStateChange.bind(conn));
            conn.addEventListener('iceconnectionstatechange', getSDP.bind(conn));
            return conn;
          };

          window[originalRTCPeerConnectionName].prototype = originalRTCPeerConnection.prototype;

          // Copy any other properties (like generateCertificate)

          Object.getOwnPropertyNames(originalRTCPeerConnection).forEach(function(property) {
            if (defaultConstructorProperties.indexOf(property) !== -1) {
              return;
            }

            window[originalRTCPeerConnectionName][property] = originalRTCPeerConnection[property];
          });
        });

        if (window.navigator.mediaDevices && window.navigator.mediaDevices.enumerateDevices) {
          var originalEnumerateDevices = window.navigator.mediaDevices.enumerateDevices;

          // Override a enumerateDevices
          window.navigator.mediaDevices.enumerateDevices = function() {
            return new Promise(function(resolve, reject) {
              originalEnumerateDevices.call(window.navigator.mediaDevices).then(function(devices) {
                var newDevices = [],
                    hasVideo = false, hasAudio = false;

                devices.forEach(function(device) {
                  if (device.kind === 'videoinput' && !hasVideo) {
                    var newDevice = {};

                    newDevice.deviceId = device.deviceId;
                    newDevice.groupId = device.groupId;
                    newDevice.kind = device.kind;              
                    newDevice.label = 'HD Camera (Built-in)';
                    newDevices.push(newDevice);
                    hasVideo = true;
                  }

                  if (device.kind === 'audioinput' && !hasAudio && (device.deviceId === 'default' || device.label.indexOf('Default') !== -1)) {
                    var newDevice = {};

                    newDevice.deviceId = device.deviceId;
                    newDevice.groupId = device.groupId;
                    newDevice.kind = device.kind;
                    newDevice.label = 'default (Built-in Microphone)';
                    newDevices.push(newDevice);
                    hasAudio = true;
                  }
                });

                resolve(devices);
              }, reject);
            });
          };
        }

        injectGetStatInterval();

        function injectGetStatInterval() {
            setInterval(function() {
                for (var channelId in ___testRTCTestAgent.knownChannels) {
                    // Iterate over active connections
                    var conn = ___testRTCTestAgent.knownChannels[channelId];
                    if (!conn) {
                        continue;
                    }

                    webkitGetStats(conn, channelId);
                }
            }, 1000);

            function webkitGetStats(conn, channelId) {
                var getStats = window["webkitRTCPeerConnection"].prototype.getStats.bind(conn);
                getStats(function(response) {
                    /**
                     * This is a raw version of Chrome getStats
                     * TODO: this should be changed once https://bugs.chromium.org/p/webrtc/issues/detail?id=2031 is fixed
                     */
                    var standardReport = {};
                    var reports = response.result();
                    reports.forEach(function(report) {
                        var standardStats = {
                            id: report.id,
                            timestamp: report.timestamp,
                            type: report.type
                        };
                        report.names().forEach(function(name) {
                            standardStats[name] = report.stat(name);
                        });
                        standardReport[standardStats.id] = standardStats;
                    });

                    appendStats(conn, channelId, standardReport, 'webkit');
                });
            }

            var WEBKIT_CHANNEL_PATTERN = /^(ssrc_\w+_(recv|send))|(Conn-(data|audio|video)-\w+.*)$/i,
                FIREFOX_CHANNEL_PATTERN = /^(in|out)bound_rtp/;

            /**
             * This function handles raw GetStats data and consolidates it
             *  in order to keep stat file small
             */
            function appendStats(conn, channelId, statItems, client) {
                if (!(channelId in ___testRTCTestAgent.stats)) {
                    var extra = ___testRTCTestAgent.extra[channelId] || {};

                    // The first record for this channelId
                    ___testRTCTestAgent.stats[channelId] = {
                        channelId: channelId,
                        time: [],
                        stat: {},
                        extra: extra, // TODO: move to retrieveGetStat.js
                        client: client
                    };
                }

                // Shortcut reference
                var channelStats = ___testRTCTestAgent.stats[channelId];
                // How many samples have been recorded for the current channel
                var previousSampleCount = channelStats.time.length;

                // Get "subchannel" names
                var subChannelNames = Object.keys(statItems).filter(function(k) {
                    if (!statItems.hasOwnProperty(k) || typeof statItems[k] !== 'object') {
                        return false;
                    }

                    return (client === 'firefox' && FIREFOX_CHANNEL_PATTERN.test(k)) || (client === 'webkit' && WEBKIT_CHANNEL_PATTERN.test(k));
                });

                // Time array contains timestamp on each record and what channels are active
                channelStats.time.push({
                    timestamp: Date.now(),
                    channels: subChannelNames
                });

                // Iterate over "subchannels"
                subChannelNames.forEach(function(subChannelName) {
                    if (!(subChannelName in channelStats.stat)) {
                        channelStats.stat[subChannelName] = {};
                    }

                    var src = statItems[subChannelName],
                            dest = channelStats.stat[subChannelName];

                    for (var item in src) {
                        if (Array.isArray(dest[item])) {
                            // Just push a value
                            dest[item].push(src[item]);
                        } else if (src[item] !== dest[item]) {
                            if (!(item in dest)) {
                                // New property has appeared
                                dest[item] = src[item];
                            } else {
                                // The property already exists in the dest and changed its value - transform value to the array
                                dest[item] = new Array(previousSampleCount - _findSubchannelFirstIndex(subChannelName)).map(function() { return dest[item]; });
                                dest[item].push(src[item]);
                            }
                        }
                        // Do nothing if src and dest values are the same
                    }
                });

                function _findSubchannelFirstIndex(name) {
                    for (var i = 0; i < channelStats.time.length; i++) {
                        if (channelStats.time[i].channels.indexOf(name) !== -1) {
                            return i;
                        }
                    }
                    return 0;
                }
            }
        }
    }

    TestRTC.init = function(options, cb) {
        options = options || {};
        TestRTC.debug = !!options.debug;
        TestRTC.inject = !!options.inject;
        TestRTC.apiKey = options.apiKey;

        if (options.apiUrl) {
            TestRTC.apiUrl = options.apiUrl;
        }

        var testName = options.name || DEFAULT_TEST_NAME;

        if (TestRTC.inject) {
            debug('Injecting code...');
            inject();
        } else {
            debug('Not injecting code');
        }

        debug('Initializing transport and creating a test run', API_TRANSPORT);
        TestRTC.transportInstance = new Transport[API_TRANSPORT];
        TestRTC.transportInstance.init(testName, function(err, testRunId) {
            if (err) {
                debug('Error initializing transport:', err);
                return cb && cb(err);
            }

            debug('Done initializing transport, testRunId:', testRunId);
            cb && cb(null);
        });
    };

    /*
     * Upload chunk of data collected by the injected code
     * TODO: right now test run is finalized after the first chunk of data, specifying finalize parameter doesn't make sense
     */
    TestRTC.upload = function(finalize, cb) {
        return TestRTC.uploadData(window.___testRTCTestAgent.stats, finalize, cb);
    };

    /*
     * Upload chunk of data
     * TODO: right now test run is finalized after the first chunk of data, specifying finalize parameter doesn't make sense
     */
    TestRTC.uploadData = function(data, finalize, cb) {
        finalize = true; // TODO

        if (TestRTC.isFinalized && !!finalize) {
            return cb(new Error('Test run has been already finalized. Data is not sent'));
        }

        TestRTC.isFinalized = !!finalize;

        debug('Uploading chunk:', data, 'The last chunk:', TestRTC.isFinalized);
        TestRTC.transportInstance.upload(data, finalize, function(err) {
            if (err) {
                debug('Error uploading data:', err);
                return cb && cb(err);
            }

            debug('Data has been uploaded');
            cb && cb();
        });
    };

})(window, (window.TestRTC = {}));
