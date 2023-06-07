// ==UserScript==
// @name		 Netflix Skips
// @namespace	 https://github.com/N3Cr0Cr0W/userscripts
// @version		 0.5
// @description  Skips Recap and Intro.
// @author		 N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Netflix.Skips.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Netflix.Skips.user.js
// @match		 https://www.netflix.com/watch/*
// @grant		 GM_log
// ==/UserScript==
(function(){
	'use strict';
	let playback="";
	let urlPathName="";
	let videoPlayer="";
	let skipIntro='';
	function tEvent(){
		const newVideoPlayer=document.querySelector('video');
		const newUrlPathName=window.location.pathname;
		if(newUrlPathName!==urlPathName||videoPlayer!=newVideoPlayer){
			mutObserver.disconnect();
			mutObserver.observe(appMountPoint,{childList:true,subtree:true});
			var checkExist = setInterval(function(){
				const newVideoPlayer=document.querySelector('video');
				videoPlayer=newVideoPlayer;
				if (videoPlayer){
					clearInterval(checkExist);
				}
			}, 100);
			urlPathName=newUrlPathName;
		}
	}
	const appMountPoint=document.getElementById("appMountPoint");
	const mutObserver=new MutationObserver(mutations=>{
		mutations.forEach(mutation=>{
			Array.from(mutation.addedNodes).filter(node=>{
				recuriveClick(node);
			});
		});
	});
	const recuriveClick=(node)=>{
		if(node.childNodes){
			[...node.childNodes].forEach(recuriveClick);
		}
		if(node?.classList&&node?.classList.contains("watch-video--skip-content-button")){
			node.click();
			GM_log('Recap Skipped');
		}
		if(node?.classList&&node?.classList.contains("main-hitzone-element-container")&&typeof node.firstChild.firstChild.firstChild!=='undefined'){
			node.firstChild.firstChild.firstChild.firstChild.click();
			GM_log('Continue Playing');// Span text=Continue Playing -> parent -> click
		}
		if(node?.classList&&node?.classList.contains("watch-video--skip-content-button")){
			node.click();
			GM_log('Intro Skipped');
		}
		if(node?.className==="main-hitzone-element-container"&&document.querySelectorAll("button").length===12){
			setTimeout(()=>{document.querySelector(".button-nfplayerNextEpisode").click();},200);
			GM_log('Next Ep');
		}

	};
	const inteWatch=setInterval(tEvent,3000);
})();
