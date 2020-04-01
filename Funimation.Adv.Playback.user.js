// @typescript:strictNullChecks
// ==UserScript==
// @name          Funimation Custom Playback
// @namespace     https://github.com/N3Cr0Cr0W/userscripts
// @version       0.2
// @description   Add functions to funimation.com. Thanks to: https://github.com/kishansundar/funimationfix for inital codebase, and https://github.com/alexschumaker/FunimationFeatures for updates.
// @author        N3Cr0Cr0W
// @downloadURL   https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Funimation.Adv.Playback.user.js
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @match         *://www.funimation.com/*
// @grant         GM_log
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @run-at        document-end
// ==/UserScript==
(function(){
	var playbackRate=GM_getValue('playbackRate',2);
	var playerFocus=false;
	var videoPlayer;
	var playerDoc;
	if (window.location.href.indexOf("player")>0){;
		playerFocus=true;
		videoPlayer=document.getElementsByTagName("video")[0];
		playerDoc=document;
	}
	else{
		videoPlayer=document.getElementById('player').contentDocument.getElementsByTagName('video')[0];
		playerDoc=document.getElementById('player').contentDocument;
	}
	console.log("Injected FunimationFeatures into "+(playerFocus?"player.":"page."));
	window.BlockAdBlock = function(data){
		function onDetected(){}
		function onNotDetected(){}
		function check(){}
	};
	if (playerFocus) {
		initUI();
	}
	function initUI(){
		if(document.getElementsByClassName("funimation-controls-right").length>0){
			var playback=document.createElement("div");
			playback.id="playback";
			playback.className="funimation-control funifix-control";
			playback.style.width="20px";
			playback.innerHTML="<span>"+videoPlayer.playbackRate+"</span>";
			var currentTime=document.createElement("div");
			currentTime.id="currentTime";
			currentTime.className="funimation-control funifix-control";
			currentTime.style.width="160px";
			currentTime.innerHTML="<span>0:00 / 0:00</span>";
			var controls=document.getElementsByClassName("funimation-controls-right")[0];
			controls.insertBefore(playback,controls.firstChild);
			controls.insertBefore(currentTime controls.firstChild);
			videoPlayer.playbackDisplay = playback;
			videoPlayer.currentTimeDisplay = currentTime;
			initListener();
		}else setTimeout(initUI, 100);
	}
	function initListener(){
		videoPlayer.addEventListener("timeupdate",timeUpdate);
		$(document).keydown(function(e){
			switch(e.which){
				case 37:// left arrow
					if(!(e.metaKey||e.ctrlKey)){
						videoPlayer.currentTime=videoPlayer.currentTime-5;
					}
					break;
				case 38:// ctrl/meta + up arrow
					if(e.ctrlKey||e.metaKey){
						changePlaybackRate(.25);
					}else if(videoPlayer.volume<1){
						e.preventDefault();
						videoPlayer.volume=videoPlayer.volume+.1;
					}
					break;
				case 39:// right arrow
					if(!(e.metaKey||e.ctrlKey)){
						videoPlayer.currentTime=videoPlayer.currentTime+5;
					}
					break;
				case 40:// ctrl/meta + down arrow
					if(e.ctrlKey||e.metaKey){
						changePlaybackRate(-.25);
					}else if(videoPlayer.volume>0){
						e.preventDefault();
						videoPlayer.volume=videoPlayer.volume-.1;
					}
					break;
				case 32:// spacebar
					if(!playerFocus&&(!e.metaKey||e.ctrlKey)){
						e.preventDefault();
						playerDoc.getElementById('funimation-control-playback').click()
					}
					break;
				case 48:// ctrl/meta + 0
					if(e.ctrlKey||e.metaKey){
						GM_setValue('playbackRate',1);
						GM_log("FuniFix Rate Reset",videoPlayer.playbackRate);
					}
					break;
				case 70:// F
					playerDoc.getElementById('funimation-control-fullscreen').click();
					break;
				default:
					break;
			}
		});
		$("#funimation-gradient,video").on("click",function(){
			$('#funimation-control-playback').click();
		});
	}
	function timeUpdate(e){
		videoPlayer.currentTimeDisplay.innerHTML="<span>"+getDisplayTime(e.target.currentTime)+" / "+getDisplayTime(e.target.duration)+"</span>";
		changePlaybackRate(0);
	}
	function getDisplayTime(time){
		if(isNaN(time))return "0:00";
		var seconds=parseInt(time%60);
		var minutes=parseInt((time/60)%60);
		return minutes+":"+(seconds<10?"0":"")+seconds;
	}
	function changePlaybackRate(change){
		playbackRate=GM_getValue('playbackRate',2);
		if(change){
			GM_setValue('playbackRate',playbackRate+change);
			playbackRate=playbackRate+change;
		}
		if(videoPlayer&&videoPlayer.playbackRate!=playbackRate){
			videoPlayer.playbackRate=playbackRate;
			GM_log("Set Playback Rate to "+playbackRate+"X.");
		}
		videoPlayer.playbackDisplay.innerHTML="<span>"+videoPlayer.playbackRate+"</span>";
	}
})();
