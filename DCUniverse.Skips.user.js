// ==UserScript==
// @name         DC Universe Skips
// @namespace    https://github.com/N3Cr0Cr0W/userscripts
// @version      0.1
// @description  Skips Recap and Intros. Allows Saved PlaybackRate.
// @author       N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/DCUniverse.Skips.user.js
// @license      GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.en.html
// @match        https://www.dcuniverse.com/videos/watch/*
// @grant        GM_log
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
(function(){
	'use strict';
	function increasePlaybackRate(){
		var playbackRate=GM_getValue('playbackRate',1);
		GM_setValue('playbackRate',playbackRate+.25);
	}
	function decreasePlaybackRate(){
		var playbackRate=GM_getValue('playbackRate',1);
		GM_setValue('playbackRate',playbackRate-.25);
	}
	function skipsAndStuff(){
		var playbackRate=GM_getValue('playbackRate',1);
		var recap=document.querySelector('.vjs-overlay.vjs-overlay-bottom-right.recap.vjs-overlay-background:not(.vjs-hidden)>div#skiprecao.skiprecap');
		var intro=document.querySelector('.vjs-overlay.vjs-overlay-bottom-right.intro.vjs-overlay-background:not(.vjs-hidden)>div#skipintro.skipintro');
		var next=document.querySelector('div.vjs-overlay.vjs-overlay-bottom.credits.vjs-overlay-background:not(.vjs-hidden)>div.nextcontent>div.inner>div.thumbnail>div.thumbnail-image>a>div.image-overlay>div.image-button');
		var video=document.evaluate('//video',document,null,9,null).singleNodeValue;
		if(recap){
			handleButtons(recap);
			GM_log("Skipped Recap.");
		}
		if(intro){
			handleButtons(intro);
			GM_log("Skipped Intro.");
		}
		if(next){
			handleButtons(next);
			GM_log("Next Episode.");
		}
		if(video&&video.playbackRate!=playbackRate){
			video.playbackRate=playbackRate;
			GM_log("Set Playback Rate to "+playbackRate+"X.");
		}
	}
	function handleButtons(button){
		if(button&&!button.clicked){
			button.clicked=2;
			button.click();
		}else if(button&&button.clicked){
			button.clicked-=1;
		}else if(button){
			button.clicked=0;
		}
	}
	var timerID=setInterval(skipsAndStuff,800);
	GM_registerMenuCommand('Faster',increasePlaybackRate,'F');
	GM_registerMenuCommand('Slower',decreasePlaybackRate,'S');
})();
