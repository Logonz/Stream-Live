/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global localStorage, window, $, webkitNotifications, chrome */

//check text status, when there is a timeout, add additional delay


(function () {

    "use strict";
    
    const LIMIT_AMOUNT = 100;
    const AJAX_TIMEOUT = 1000 * 30; //30 seconds
	const CLIENT_ID = "haeyonp05j4wiphav3eppivtdsvlyoq";

    const VOD_STRING = "rerun";
    let DATA_URL = "https://api.twitch.tv/kraken/users/{0}/follows/channels?limit=" + LIMIT_AMOUNT + "&offset={1}";
   
    let lastAjaxRequest;
    
    const UPDATE_INTERVAL = 60 * 1000 * 2;//2 minutes
    
    const USER_ID_KEY = "twitchUserId";
    
    let offset = 0;
    
    let intervalId;
    
    let streams;
    let channels;
    
    let popup;
    let mixer;
    
    let errorMessage;
    let userId;
    
    let oldStreams;
    let notification = "";
    
    let updateBadge = function(text, color) {
        chrome.browserAction.setBadgeBackgroundColor({color: color});
        chrome.browserAction.setBadgeText({"text": text});
    }
    
    let onStorageUpdate = function(e) {console
        //is update call before this?
        if (e.key === USER_ID_KEY) {          
            userId = e.newValue;
            updateData();
        }
    }
    
    let getStreams = function() {
        let st = streams.concat(mixer.getMixerStreams());
        return st;
    }
    
    let getErrorMessage = function() {
        return errorMessage;
    }
    
    let setPopup = function(p) {
        popup = p;
    }

    let setMixer = function(m) {
        mixer = m
    }
    
    let getNewStreams = function() {
        if (!oldStreams) {
            return false;
        }
        
        let hash = {};
        let len = oldStreams.length;
        
        let i;
        for (i = 0; i < len; i++) {
            //todo: channel.channel?
            hash[oldStreams[i].channel.name] = true;
        }
        
        len = streams.length;
        
        let nStreams = [];
        let login;
        let stream;
        for (i = 0; i < len; i++) {
            stream = streams[i];
            login = stream.channel.name;
            if (!hash.hasOwnProperty(login)) {
                nStreams.push({name: login, game: stream.game});
            }
        }
        
        return nStreams;
    }
    
    let broadcastError = function(msg) {
        errorMessage = msg;
        if (popup) {
            popup.setErrorMessage(msg);
        }
        
        if (msg) {
            chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 255]});
            chrome.browserAction.setBadgeText({"text": "?"});
        }
    }
    
    let notificationCreationCallback = function(notificationId) {
        notification = notificationId;
    }
    
    let onUserStreamInfoLoad = function(rawData) {
        lastAjaxRequest = null;
        errorMessage = null;
            
        oldStreams = streams;
        streams = rawData;
        
        streams = streams.streams;

        //check if we need to filter out vodcasts
        if(localStorage.ignoreVodcasts === "true") {
            let sLen = streams.length;
            for(let i = sLen - 1; i > -1; i--) {
                let s = streams[i];

                if(s.stream_type == VOD_STRING) {
                    streams.splice(i, 1);
                }
            }
        }

        let nStreams = getNewStreams();
        
        //check if there are new streams
        let newStreamLen = nStreams.length;
        if (newStreamLen) {
            
            //check if notifications are enabled
            if ((localStorage.showNotifications === "true")) {
                
                let options = {
                    title : "Twitch Live",
                    priority : 0,
                    iconUrl : chrome.runtime.getURL("images/notification-64x64.png")
                };
                
                let i;
                if (newStreamLen <= 5) {
                    options.type = "list";
                    options.message = "New Twitch.tv streams online!";
                    
                    let items = [];
                    let s;
                    for (i = 0; i < newStreamLen; i++) {
                        s = nStreams[i];
                        
                        items.push({title: s.name, message: "is playing " + s.game});
                    }
                    
                    options.items = items;
                } else {
                    options.type = "basic";
                    options.message = "New Twitch.tv streams online:\n";
                    
                    for (i = 0; i < newStreamLen; i++) {
                        options.message += nStreams[i].name + ", ";
                    }
                    
                    //remove trailing comma
                    options.message = options.message.replace(/, +$/, "");
                }
                
                chrome.notifications.create("", options, notificationCreationCallback);
            }
        }
        
        let len = getStreams().length;

        
        let badgeColor = [0, 0, 255, 255];
        let badgeText = String(len);
        
        updateBadge(badgeText, badgeColor);
        
        if (popup) {
            //broadcastError(null);
            popup.updateView();
        }
        
        channels = null;
    }

    //503 : unavailable
    //408 : timeout
    let onUserStreamInfoError = function(XMLHttpRequest, textStatus, errorThrown) {
        lastAjaxRequest = null;
        //broadcastError("Error loading stream data from Twitch.tv");
        console.log("------------------------Error Loading Data-------------------------------------");
        console.log("onUserStreamInfoError : " + XMLHttpRequest.responseText);
        console.log("Time : " + new Date().toString());
        console.log("XMLHttpRequest :", XMLHttpRequest);
        console.log("textStatus :", textStatus);
        console.log("errorThrown :", errorThrown);
        console.log("------------------------------End Error----------------------------------------");
    }
    
    let onUserDataError = function(XMLHttpRequest, textStatus, errorThrown) {
        lastAjaxRequest = null;
        //broadcastError("Error loading user data from Twitch.tv");
        console.log("------------------------Error Loading Data-------------------------------------");
        console.log("Error : onUserDataError");
        console.log("Time : " + new Date().toString());
        console.log("XMLHttpRequest :", XMLHttpRequest);
        console.log("textStatus :", textStatus);
        console.log("errorThrown :", errorThrown);
        console.log("------------------------------End Error----------------------------------------");
    }
    
    let parseChannels = function() {
        let len = channels.length;
        let loginNameIds = [];
        
        let i;
        for (i = 0; i < len; i++) {
            
            let channel = channels[i];
            loginNameIds.push(channel.channel._id);
        }

        let url = "https://api.twitch.tv/kraken/streams?channel=" + encodeURI(loginNameIds.toString()) + "&limit=100";
        callApi(url, onUserStreamInfoLoad, onUserStreamInfoError);
    }
    

     let onLoadAccountInfo = function(rawData) {

        let account = rawData;
        lastAjaxRequest = null;
        
        //let tmp = JSON.parse(rawData);
        //let tmp = rawData;
        //todo: could give an error if nothing is returned
        let tmp = account.follows;
        
        if (!channels) {
            console.log("onLoadAccountInfo : channels was null");
            return;
        }

        if (!tmp.length && !channels.length) {
            return;
        }
        
        //todo: check for better way to do this
        channels = channels.concat(tmp);

        offset += LIMIT_AMOUNT;

        //if (tmp.length === 0 || account._total < LIMIT_AMOUNT) {
        if (tmp.length === 0 || account._total <= offset) {
            parseChannels();
        } else {
        
            //this is probably redundant (see above)
            /*
            if (!channels.length) {
                return;
            }
            */
            loadAccountInfo();
        }
    }
    
    let loadAccountInfo = function() {
        let url = DATA_URL.replace("{0}", encodeURI(userId)).replace("{1}", offset);
        callApi(url, onLoadAccountInfo, onUserDataError);
    };
    
    let onInterval = function() {
        updateData();
    };

    let callApi = function(url, onLoad, onError, client_id, accept) {
        let client_idResponse = CLIENT_ID;
        let acceptResponse = 'application/vnd.twitchtv.v5+json';
        if(client_id){
            client_idResponse = client_id;
        }
        if(accept){
            acc = accept;
        }
        lastAjaxRequest = $.ajax({
            type: "GET",
            timeout: AJAX_TIMEOUT,
            beforeSend: function(xhr){
                xhr.setRequestHeader('Accept', acceptResponse);
                xhr.setRequestHeader('Client-ID', client_idResponse);
                xhr.setRequestHeader('limit', 100);
            },
            dataType: "json",
            url: url,
            cache: false
        });
    
        lastAjaxRequest.done(onLoad);
        lastAjaxRequest.fail(onError);
    };
    
    let updateData = function() {

        if (!userId) {
            updateBadge("", [0, 0, 0, 0]);
            return;
        }
        
        if (intervalId) {
            window.clearTimeout(intervalId);
        }
        
        if (lastAjaxRequest) {
            lastAjaxRequest.abort();
            lastAjaxRequest = null;
        }
        
        intervalId = window.setTimeout(onInterval, UPDATE_INTERVAL);

        offset = 0;
        
        //todo: need to store old ones in case you try to open when loading
        channels = [];
        loadAccountInfo();
    };
    
    let updateUserId = function(_userId){
        userId = userId;
    }

    let init = function() {
                
        userId = localStorage[USER_ID_KEY];

        if(userId == undefined) {
            localStorage.removeItem("twitchAccountName");
        }

        updateBadge("", [0, 0, 0, 0]);
        
        window.addEventListener("storage", onStorageUpdate);
        
        chrome.contextMenus.create({"title": "About Twitch Live", "contexts":["browser_action"],
                                       "onclick": function(){
                                            chrome.tabs.create({"url": "about.html"});
                                       }});

        updateData();
    }
    
    window.setPopup = setPopup;
    window.setMixer = setMixer;
    window.getErrorMessage = getErrorMessage;
    window.getStreams = getStreams;
    window.updateData = updateData;
    window.updateBadge = updateBadge;
    window.callApi = callApi;

    init();
}());