// ==UserScript==
// @name         Amazon Skips
// @namespace    https://github.com/N3Cr0Cr0W/userscripts
// @version      0.3
// @description  Skips Recap, Intro and Ads. Allows Saved PlaybackRate.
// @author       N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Amazon.Skips.user.js
// @license      GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.en.html
// @match        https://www.amazon.com/*autoplay=1*
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
		var recap=document.evaluate('//div[text()="Skip Recap"]',document,null,9,null).singleNodeValue;
		var intro=document.evaluate('//div[text()="Skip Intro"]',document,null,9,null).singleNodeValue;
		var next=document.querySelector("div#dv-web-player>div>div:nth-child(1)>div>div>div.webPlayerSDKPlayerContainer>div>div>div>div>div>div>div>div>div>div>div>div>svg>circle");
		var ad=document.evaluate('//div[text()="Skip"]',document,null,9,null).singleNodeValue;
		var video=document.evaluate('//video',document,null,9,null).singleNodeValue;
		if(recap&&!recap.clicked){
			recap.click();
			recap.clicked=1;
			GM_log("Skipped Recap.");
		}
		if(intro&&!intro.clicked){
			intro.click();
			intro.clicked=1;
			GM_log("Skipped Intro.");
		}
		if(next&&!next.clicked){
			next.parentNode.parentNode.parentNode.click();
			next.clicked=1;
			GM_log("Next Episode.");
		}
		if(ad&&!ad.clicked){
			ad.click();
			ad.clicked=1;
			GM_log("Skipped Ad.");
		}
		if(video&&video.playbackRate!=playbackRate){
			video.playbackRate=playbackRate;
			GM_log("Set Playback Rate to "+playbackRate+"X.");
			GM_registerMenuCommand('Faster',increasePlaybackRate,'F');
			GM_registerMenuCommand('Slower',decreasePlaybackRate,'S');
		}
	}
	var timerID=setInterval(skipsAndStuff,800);
})();
