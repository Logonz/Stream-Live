/*
	Copyright 2012
	Mike Chambers
	mikechambers@gmail.com

	http://www.mikechambers.com
*/

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global localStorage, document, chrome, setTimeout*/

(function () {

    "use strict";

    let twitchUsernameInput;
    let mixerUsernameInput; //mixer
    let saveButton;
    let notificationsCB;
    let openInPopoutCB;
    let ignoreVodcastsCB;
      

    let save = function() {



        if(twitchUsernameInput.value == localStorage.twitchAccountName && mixerUsernameInput.value == localStorage.mixerAccountName && localStorage.twitchUserId && localStorage.mixerUserId) {
            storeData();
            return;
        }

        //Twitch
        if(twitchUsernameInput.value.trim().length > 0) {
            console.log("INPUT", encodeURI(twitchUsernameInput.value))
            let twitchUrl = "https://api.twitch.tv/helix/users?login=" + encodeURI(twitchUsernameInput.value);
            background.callApi(twitchUrl, (rawData) => {onUserInfoLoad("twitch", rawData)}, onUserInfoError);
        }

        //Mixer
        if(mixerUsernameInput.value.trim().length > 0) {
            let mixerUrl = "https://mixer.com/api/v1/channels/"+encodeURI(mixerUsernameInput.value);
            background.callApi(mixerUrl, (rawData) => {onUserInfoLoad("mixer", rawData)}, onUserInfoError);
        }
    }

    let onUserInfoLoad = function(type, rawData) {
        let id;
        console.log(rawData);

        try {
            if(type == "twitch") {
                if(!rawData.data.length) {
                    showStatusMessage("Twitch account name not found.");
                    return;
                }
                id = rawData.data[0].id;
            }
            else if(type == "mixer") {
                if(rawData.statusCode && rawData.statusCode == "404") {
                    showStatusMessage("Mixer account name not found. Code:", rawData.statusCode);
                    return;
                }
                id = rawData.userId;
            }

        } catch(e) {
            console.log("Error retrieving user id");
            console.log(e);
            showStatusMessage("Error retrieving user id");
            return;
        }

        storeData(type, id);
    }

    let onUserInfoError = function(XMLHttpRequest, textStatus, errorThrown) {
        console.log("onUserInfoError");
        console.log("------------------------Error Loading User Info-------------------------------------");
        console.log("onUserInfoError : " + XMLHttpRequest.responseText);
        console.log("Time : " + new Date().toString());
        console.log("XMLHttpRequest :", XMLHttpRequest);
        console.log("textStatus :", textStatus);
        console.log("errorThrown :", errorThrown);
        console.log("------------------------------End Error----------------------------------------");
    }

    let storeData = function(type, userId) {
        console.log("StoreData:", type, userId);
         
        localStorage.twitchAccountName = twitchUsernameInput.value;
        localStorage.mixerAccountName = mixerUsernameInput.value;
        localStorage.showNotifications = notificationsCB.checked;
        localStorage.openInPopout = openInPopoutCB.checked;
        localStorage.ignoreVodcasts = ignoreVodcastsCB.checked;

        if(userId && type == "twitch") {
            localStorage.twitchUserId = userId;
        }
        else if(userId && type == "mixer"){
            localStorage.mixerUserId = userId;
        }
        
        showStatusMessage("Options Saved");
    }
    
    let showStatusMessage = function(msg) {
        let status = document.getElementById("status");
        status.innerHTML = msg;
        status.style.opacity = 1;
        
        setTimeout(function () {
            status.innerHTML = "";
            status.style.opacity = 0;
        }, 4000);
    }
    
    let background;
    let init = function() {
        
        background = chrome.extension.getBackgroundPage();

        let twitchAccountName = localStorage.twitchAccountName;
        twitchUsernameInput = document.getElementById("twitchUsername");
        
        if (twitchAccountName) {
            twitchUsernameInput.value = twitchAccountName;
        }

        //Mixer
        let mixerAccountName = localStorage.mixerAccountName;
        mixerUsernameInput = document.getElementById("mixerUsername");
        
        if (mixerAccountName) {
            mixerUsernameInput.value = mixerAccountName;
        }
        
        notificationsCB = document.getElementById("showNotificationsCheck");
        let showNotifications = (localStorage.showNotifications === "true");
        
        if (showNotifications) {
            notificationsCB.checked = true;
        }
     
        openInPopoutCB = document.getElementById("openInPopoutCheck");
        let openInPopout = (localStorage.openInPopout === "true");
        
        if (openInPopout) {
            openInPopoutCB.checked = true;
        }
        
        ignoreVodcastsCB = document.getElementById("ignoreVodcastsCheck");
        let ignoreVodcasts = (localStorage.ignoreVodcasts === "true");
        
        if (ignoreVodcasts) {
            ignoreVodcastsCB.checked = true;
        }

        saveButton = document.getElementById("save-button");
        saveButton.onclick = save;
    }

    init();
}());