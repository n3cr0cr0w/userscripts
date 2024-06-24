// ==UserScript==
// @name		Crunchy Roll Skips
// @namespace		https://github.com/N3Cr0Cr0W/userscripts
// @version		0.5
// @description		Plays next episode, Skips Intro, Preview and Recap
// @author		N3Cr0Cr0W
// @downloadURL  	https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.Skips.user.js
// @updateURL    	https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.Skips.user.js
// @match		https://static.crunchyroll.com/vilos-v2/*
// @grant		GM_log
// ==/UserScript==
(function(){
	'use strict';
	let urlPathName="";
	let videoPlayer="";
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
	const appMountPoint=document.getElementById("vilos");
	const mutObserver=new MutationObserver(mutations=>{
		mutations.forEach(mutation=>{
			if(mutation.nextSibling&&mutation.addedNodes.length){
				Array.from(mutation.addedNodes).filter(node=>{
					if(node.className==="end-card-container"){
						setTimeout(()=>{document.querySelector(".end-card__metadata-area-play-button").click();},200);
						GM_log('Next Ep');
					}
				});
			}else if(!mutation.nextSibling&&mutation.addedNodes.length==1){
				Array.from(mutation.addedNodes).filter(node=>{
					if(node.innerText==="SKIP INTRO"){
						setTimeout(()=>{node.children[0].click();},200);
						GM_log('Skip Intro');
					}else if(node.innerText==="SKIP CREDITS"){
						setTimeout(()=>{node.children[0].click();},200);
						GM_log('Skip Credits');
					}else if(node.innerText==="SKIP RECAP"){
						setTimeout(()=>{node.children[0].click();},200);
						GM_log('Skip Recap');
					}else if(node.innerText==="SKIP PREVIEW"){
						setTimeout(()=>{node.children[0].click();},200);
						GM_log('Skip Preview');
					}
				});
			}
		});
	});
	const inteWatch=setInterval(tEvent,3000);
})();
