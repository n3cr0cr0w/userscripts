// @typescript:strictNullChecks
// ==UserScript==
// @name          Funimation Custom Playback
// @namespace     https://github.com/N3Cr0Cr0W/userscripts
// @version       0.3
// @description   Add functions to funimation.com. Thanks to: https://github.com/kishansundar/funimationfix for inital codebase, and https://github.com/alexschumaker/FunimationFeatures for some updates. I also install "Funimation Fullscreen" https://chrome.google.com/webstore/detail/funimation-fullscreen/hceoiabnmkpihamfhnmlallgefglfppf for persistent fullscreen during bingeing sessions.
// @author        N3Cr0Cr0W
// @downloadURL   https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Funimation.Adv.Playback.user.js
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @match         https://www.funimation.com/*
// @grant         GM_log
// @grant         GM_setValue
// @grant         GM_getValue
// @grant         GM_registerMenuCommand
// @run-at        document-end
// ==/UserScript==
(function(){
	let playbackRate=GM_getValue('playbackRate',1);
	var playerFocus=false;
	let videoPlayer;
	let playerDoc;
	let checkExist=setInterval(function(){
		if (window.location.href.indexOf("player")>0){
			if(videoPlayer=document.getElementsByTagName("video")[0]){
				playerFocus=true;
				playerDoc=document;
				document.querySelector("#funimation-gradient,video").addEventListener("click",function(){
					playerDoc.getElementById('funimation-control-playback').click();
				});
				initUI();
				clearInterval(checkExist);
			}
		}else{
			if(videoPlayer=document.getElementById('player').contentDocument.getElementsByTagName('video')[0]){
				playerDoc=document.getElementById('player').contentDocument;
				initListener();
				clearInterval(checkExist);
			}
		}
	}, 100);
	console.log("Injected FunimationFeatures into "+(playerFocus?"player.":"page."));
	window.BlockAdBlock = function(data){
		function onDetected(){}
		function onNotDetected(){}
		function check(){}
	};
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
			controls.insertBefore(currentTime,controls.firstChild);
			videoPlayer.playbackDisplay = playback;
			videoPlayer.currentTimeDisplay = currentTime;
			GM_registerMenuCommand('Faster',changePlaybackRateFaster,'F');
			GM_registerMenuCommand('Slower',changePlaybackRateSlower,'S');
			videoPlayer.addEventListener("timeupdate",timeUpdate);
			initListener();
			const appMountPoint=document.getElementById("brightcove-player");
			const mutObserver=new MutationObserver(mutations=>{
				mutations.forEach(mutation=>{
					if(mutation.nextSibling===null&&mutation.addedNodes.length===1){
						Array.from(mutation.addedNodes).filter(node=>{
							if(node.id&&node.id=='funimation-end-screen'){
								document.getElementById("funimation-play-next").click();
								GM_log('Next Ep');
							}
						});
					}
				});
			});
			mutObserver.observe(appMountPoint,{childList:true,subtree:true});
		}else setTimeout(initUI, 100);
	}
	function changePlaybackRateFaster(){
		changePlaybackRate(.25);
	}
	function changePlaybackRateSlower(){
		changePlaybackRate(-.25);
	}
	function initListener(){
		document.addEventListener('keydown',function(e){
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
		playbackRate=GM_getValue('playbackRate',1);
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
