/*
	Copyright 2020
	Logon.q@gmail.com
*/

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global localStorage, window, $, webkitNotifications, chrome */

//check text status, when there is a timeout, add additional delay

(function () {

  "use strict";

  let carina_module;
  let DATA_URL = "https://mixer.com/api/v1/users/{0}/follows"
  let CHANNEL_DATA_URL = "https://mixer.com/api/v1/channels/{0}"
  let CLIENT_ID = "91d6366e093540c7bfdc0414da3af5a803f1414e868ca493";
  
  const USER_ID_KEY = "mixerUserId";

  let userId;

  let channels = {};

  
  let onLoadAccountInfo = function(rawData) {
    console.log(rawData);
    channels = {};

    let follows = rawData;

    if(follows.length == 0)
    {
      console.log("Something went wrong! Data:", follows);
      return;
    }
    
    for (let index in follows){
      let channel_data = follows[index];
      let channelid = channel_data.id;
      carina_module.subscribe('channel:'+channel_data.id+':update',(data) => {channelUpdate(channelid, data)});
      console.log('SUBSCRIBE: channel:'+channel_data.id+':update');
      channels[channel_data.id] = channel_data;
    }
    console.log(channels);
    updateView();
  }

  let convertMixerFormat = function(channel){
    let stream = {};
    stream._id = channel.id;
    stream.game = channel.type.name;
    stream.viewers = channel.viewersCurrent;
    stream.name = channel.token;
    stream.type = "mixer";
    stream.channel = {}
    stream.channel.name = channel.token;
    stream.channel.status = channel.name;
    stream.channel.url = "https://mixer.com/"+channel.token;
    return stream;
  }

  let getStreams = function(){
    let streams = []
    for (let channel_id in channels){
      if(channels[channel_id].online){
        streams.push(convertMixerFormat(channels[channel_id]));
      }
    }
    console.log("Mixer getStreams: ", channels, " Streams: ", streams);
    return streams;
  }

  let onlineStatusChanged = function(channel_id){
    console.log("Online status changed to: ", channels[channel_id].online);
    let len = background.getStreams().length;
    let str = [];
    str.push(convertMixerFormat(channel_id));
    background.notify(str);
    updateView();
  }

  let updateView = function(){
    let len = background.getStreams().length;
    let badgeColor = [0, 0, 255, 255];
    let badgeText = String(len);
    
    background.updateBadge(badgeText, badgeColor);
    
    if (background.popup) {
      background.popup.updateView();
    }
  }

  let channelUpdate = function(channel_id, data){
    //console.log('channelUpdate', channel_id, data);
    if(channels[channel_id]){
      for(let key in data){
        console.log("ID: ", channel_id, key+" was: ", channels[channel_id][key], " Set to: ", data[key])
        channels[channel_id][key] = data[key];
        if(key == "online"){
          onlineStatusChanged(channel_id);
        }
      }
    }
    //console.log(channels);
  }

  let onStorageUpdate = function(e) {
    console.log("Storage update:", e)
    //is update call before this?
    if (e.key === USER_ID_KEY) {     
        console.log("MIXER: New user!")     
        userId = e.newValue;
        setupMixer();
    }
  }

  //503 : unavailable
  //408 : timeout
  let onUserStreamInfoError = function(XMLHttpRequest, textStatus, errorThrown) {
      console.log("------------------------Error Loading Data-------------------------------------");
      console.log("onUserStreamInfoError : " + XMLHttpRequest.responseText);
      console.log("Time : " + new Date().toString());
      console.log("XMLHttpRequest :", XMLHttpRequest);
      console.log("textStatus :", textStatus);
      console.log("errorThrown :", errorThrown);
      console.log("------------------------------End Error----------------------------------------");
  }
  
  let onUserDataError = function(XMLHttpRequest, textStatus, errorThrown) {
      console.log("------------------------Error Loading Data-------------------------------------");
      console.log("Error : onUserDataError");
      console.log("Time : " + new Date().toString());
      console.log("XMLHttpRequest :", XMLHttpRequest);
      console.log("textStatus :", textStatus);
      console.log("errorThrown :", errorThrown);
      console.log("------------------------------End Error----------------------------------------");
  }

  let setupMixer = function(){
    if(carina_module != undefined){
      console.log("Closing carina module!");
      carina_module.close();
    }
    
    let url = DATA_URL.replace("{0}", encodeURI(userId));
    background.callApi(url, onLoadAccountInfo, onUserDataError, CLIENT_ID);

    console.log("Opening new module");
    carina_module = new background.carina.Carina({ 
      queryString: {
      'Client-ID': '91d6366e093540c7bfdc0414da3af5a803f1414e868ca493',
      },
      isBot: true
    }).open();
    //Subscribe to current users followfeed
    carina_module.subscribe('user:'+userId+':followed', function (data) {
      console.log('EVENT: user:'+userId+':followed', channels)
      //We are following / unfollowing something new
      if(data.following){
        console.log("Following user: ", data);
        //Get channel data for the new channel
        let url = CHANNEL_DATA_URL.replace("{0}", encodeURI(data.channel.id));
        background.callApi(url, function(data){
          console.log("Get Channel data:", data);
          if(data.id){
            channels[data.id] = data;
            let channelId = data.id;
            //Subscribe on response
            carina_module.subscribe('channel:'+data.id+':update',(data) => {channelUpdate(channelId, data)});
            updateView();
          }
        }, onUserDataError, CLIENT_ID);
      }
      else
      {
        console.log("Unfollowing user: ", data);
        carina_module.unsubscribe('channel:'+data.channel.id+':update', function (data) {
          console.log("Unfollowed user: ", data);
        });
        delete channels[data.channel.id];
        updateView();
      }
      console.log('END_EVENT: user:'+userId+':followed', channels)
    });
  }

  let background;
  let init = function() {
    console.log("Mixer.js loaded")
    background = chrome.extension.getBackgroundPage();

    userId = localStorage[USER_ID_KEY];

    if(userId == undefined) {
        localStorage.removeItem("mixerAccountName");
    }

    window.addEventListener("storage", onStorageUpdate);

    if(userId){
      setupMixer();
    }

    background.setMixer(window);
  }

  window.getMixerStreams = getStreams;

  init();
}());