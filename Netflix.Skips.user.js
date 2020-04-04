// ==UserScript==
// @name		 Netflix Skips
// @namespace	 https://github.com/N3Cr0Cr0W/userscripts
// @version		 0.1
// @description  Skips Recap and Intro. Allows Saved PlaybackRate.
// @author		 N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Netflix.Skips.user.js
// @match		 https://www.netflix.com/watch/*
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
	function tEvent(){
		const newUrlPathName=window.location.pathname;
		if(newUrlPathName!==urlPathName){
			mutObserver.disconnect();
			mutObserver.observe(appMountPoint,{childList:true,subtree:true});
			var checkExist = setInterval(function() {
				videoPlayer=document.querySelector('video')
				if (videoPlayer) {
					playback=document.createElement("div");
					playback.id="playback";
					playback.className="nfp-popup-control";
					playback.innerHTML="<span class=\"nfp-button-control\">"+videoPlayer.playbackRate+"</span>";
					let controls=document.getElementsByClassName("PlayerControlsNeo__button-control-row")[0];
					controls.insertBefore(playback,document.getElementsByClassName("ReportAProblemPopupContainer")[0]);
					clearInterval(checkExist);
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
			playback.innerHTML="<span class=\"nfp-button-control\">"+videoPlayer.playbackRate+"</span>";
			GM_log("Set Playback Rate to "+playbackRate+"X.");
		}
	}
	function changePlaybackRateFaster(){
		changePlaybackRate(.25);
	}
	function changePlaybackRateSlower(){
		changePlaybackRate(-.25);
	}
	const appMountPoint=document.getElementById("appMountPoint");
	const mutObserver=new MutationObserver(mutations=>{
		mutations.forEach(mutation=>{
			if(mutation.nextSibling&&mutation.addedNodes.length){
				Array.from(mutation.addedNodes).filter(node=>{
					if(node.classList&&node.classList.contains("interrupter-action")){
						node.firstChild.click();
						GM_log('Recap Skipped');
					}
					if(node.classList&&node.classList.contains("skip-credits")){
						setTimeout(()=>{node.querySelector("a").click();},200);
						GM_log('Intro Skipped');
					}
					if(node.className==="main-hitzone-element-container"&&document.querySelectorAll("button").length===12){
						setTimeout(()=>{document.querySelector(".button-nfplayerNextEpisode").click();},200);
						GM_log('Next Ep');
					}
				});
			}
		});
	});
	const inteWatch=setInterval(tEvent,3000);
	GM_registerMenuCommand('Faster',changePlaybackRateFaster,'F');
	GM_registerMenuCommand('Slower',changePlaybackRateSlower,'S');
})();
