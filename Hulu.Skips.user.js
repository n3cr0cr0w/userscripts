// ==UserScript==
// @name		 Hulu Skips
// @namespace	 https://github.com/N3Cr0Cr0W/userscripts
// @version		 0.3
// @description  Plays next episode, exits if random show.
// @author		 N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Hulu.Skips.user.js
// @updateURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Hulu.Skips.user.js
// @match		 https://www.hulu.com/*
// @grant		 GM_log
// @grant		 GM_setValue
// @grant		 GM_getValue
// @grant		 GM_registerMenuCommand
// ==/UserScript==
(function(){
	'use strict';
	let playback="";
	let urlPathName="";
	let videoPlayer="";
	let appMountPoint="";
	let controlsMountPoint="";
	function tEvent(){
		const newVideoPlayer=document.querySelector('video');
		const newUrlPathName=window.location.pathname;
		if(newUrlPathName!==urlPathName||videoPlayer!=newVideoPlayer){
			var checkExistEndCard = setInterval(function(){
				const newAppMountPoint=document.querySelector('div#web-player-app');
				appMountPoint=newAppMountPoint;
				if(appMountPoint){
					GM_log(appMountPoint);
					mutObserver.disconnect();
					mutObserver.observe(appMountPoint,{childList:true,subtree:true,attributes:true});
					var checkForControls = setInterval(function(){
						const newControlsMountPoint=document.querySelector('div#ControlsContainer');
						controlsMountPoint=newControlsMountPoint;
						if(controlsMountPoint){
							mutObserver.observe(controlsMountPoint,{childList:true,subtree:true,attributes:true});
							clearInterval(checkForControls);
						}
					}, 100);

					clearInterval(checkExistEndCard);
				}
			}, 100);
			urlPathName=newUrlPathName;
		}
	}
	const mutObserver=new MutationObserver(mutations=>{
		mutations.forEach(mutation=>{
			if(
				mutation.type==='attributes'&&
				mutation.target.className==='ControlsContainer__transition'&&
				mutation.attributeName==='style'&&
				mutation.target.children.length===1&&
				mutation.target.children[0].className==='SkipButton'&&
				mutation.target.style.opacity==="1"
			){
				GM_log('Skip Intro');
				mutation.target.children[0].children[0].click();
			}
			if(mutation.attributeName=="class"&&mutation.target.classList[1]=="end-card-container--show"){
				setTimeout(()=>{document.querySelector(".end-card__metadata-area-play-button").click();},200);
				GM_log('Next Ep');
			}
			if(mutation.attributeName=="class"&&mutation.target.classList[1]=="NetworkBug"){
				document.querySelector('img.NetworkBug').removeAttribute('src');
				document.querySelector('img.NetworkBug').style.display='hidden';
				GM_log('Remove Network Logo');
			}
		});
	});
	const inteWatch=setInterval(tEvent,3000);
})();
