// ==UserScript==
// @name		 Crunchy Roll Skips
// @namespace	 https://github.com/N3Cr0Cr0W/userscripts
// @version		 0.2
// @description  Plays next episode
// @author		 N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.Skips.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.Skips.user.js
// @match		 https://static.crunchyroll.com/vilos-v2/*
// @grant		 GM_log
// ==/UserScript==
(function(){
	'use strict';
	let playbackRate=GM_getValue('playbackRate',2);
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
//		GM_log(mutations);
		mutations.forEach(mutation=>{
			if(mutation.nextSibling&&mutation.addedNodes.length){
				Array.from(mutation.addedNodes).filter(node=>{
					GM_log(node);
					if(node.className==="end-card-container"){
						setTimeout(()=>{document.querySelector(".end-card__metadata-area-play-button").click();},200);
						GM_log('Next Ep');
					}
				});
			}
		});
	});
	const inteWatch=setInterval(tEvent,3000);
})();
