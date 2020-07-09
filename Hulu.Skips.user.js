// ==UserScript==
// @name		 Hulu Skips
// @namespace	 https://github.com/N3Cr0Cr0W/userscripts
// @version		 0.1
// @description  Plays next episode, exits if random show. Allows Saved PlaybackRate.
// @author		 N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Hulu.Skips.user.js
// @match		 https://www.hulu.com/*
// @grant		 GM_log
// @grant		 GM_setValue
// @grant		 GM_getValue
// @grant		 GM_registerMenuCommand
// ==/UserScript==
(function(){
	'use strict';
	let playbackRate=GM_getValue('playbackRate',2);
	let playback="";
	let urlPathName="";
	let videoPlayer="";
	let appMountPoint="";
	function tEvent(){
		const newVideoPlayer=document.querySelector('video');
		const newUrlPathName=window.location.pathname;
		if(newUrlPathName!==urlPathName||videoPlayer!=newVideoPlayer){
			var checkExistEndCard = setInterval(function(){
				const newAppMountPoint=document.getElementsByClassName("end-card-container")[0];
				appMountPoint=newAppMountPoint;
				if (appMountPoint){
					mutObserver.disconnect();
					mutObserver.observe(appMountPoint,{childList:true,subtree:true,attributes:true});
					var checkExist = setInterval(function(){
						const newVideoPlayer=document.querySelector('video');
						videoPlayer=newVideoPlayer;
						if (videoPlayer){
							if(!playback){
								playback=document.createElement("div");
								playback.id="playback";
								playback.className="keep-mouse-active";
								playback.innerHTML="<div style=\"font-size:20px;\">"+videoPlayer.playbackRate+"</div>";
								let controls=document.getElementsByClassName("controls__menus-center")[0];
								controls.insertBefore(playback,null);
							}
							document.querySelector('img.network-bug').removeAttribute('src');
							clearInterval(checkExist);
						}
					}, 100);
					clearInterval(checkExistEndCard);
				}
			}, 100);
			urlPathName=newUrlPathName;
		}
		changePlaybackRate(0);
	}
	function changePlaybackRate(change){
		playbackRate=GM_getValue('playbackRate',2);
		if(change){
			GM_setValue('playbackRate',playbackRate+change);
			playbackRate=playbackRate+change;
		}
		if(videoPlayer&&videoPlayer.playbackRate!=playbackRate){
			videoPlayer.playbackRate=playbackRate;
			playback.innerHTML="<div style=\"font-size:20px;\">"+videoPlayer.playbackRate+"</div>";
			GM_log("Set Playback Rate to "+playbackRate+"X.");
		}
	}
	function changePlaybackRateFaster(){
		changePlaybackRate(.25);
	}
	function changePlaybackRateSlower(){
		changePlaybackRate(-.25);
	}
	const mutObserver=new MutationObserver(mutations=>{
		mutations.forEach(mutation=>{
			GM_log(mutation);
			if(mutation.attributeName=="class"&&mutation.target.classList[1]=="end-card-container--show"){
						setTimeout(()=>{document.querySelector(".end-card__metadata-area-play-button").click();},200);
						GM_log('Next Ep');
			}
		});
	});
	const inteWatch=setInterval(tEvent,3000);
	GM_registerMenuCommand('Faster',changePlaybackRateFaster,'F');
	GM_registerMenuCommand('Slower',changePlaybackRateSlower,'S');
})();
