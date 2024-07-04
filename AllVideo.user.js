// ==UserScript==
// @name		 Video Speed Controls
// @namespace	 https://github.com/N3Cr0Cr0W/userscripts
// @version		 0.24.7.03
// @description  Complete overhaul using 'https://github.com/igrigorik/videospeed' as a baseline (Very ruough currrently)
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/AllVideo.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/AllVideo.user.js
// @license      MIT
// @author		 N3Cr0Cr0W
// @match		 https://*/*
// @grant		 GM_log
// @grant		 GM_setValue
// @grant		 GM_getValue
// @grant		 GM_registerMenuCommand
// ==/UserScript==
(function(){
	let mediaTags=[];
	let documentAndShadowRootObserverOptions={attributeFilter:["aria-hidden","data-focus-method"],childList:true,subtree:true};
	let regStrip=/^[\r\t\f\v ]+|[\r\t\f\v ]+$/gm;
	let regEndsWithFlags=/\/(?!.*(.).*\1)[gimsuy]*$/;
	let tc={
		settings:{
			lastSpeed:GM_getValue('lastSpeed',1.0),// default 1x
			enabled:GM_getValue('enabled',true),// default enabled
			speeds:JSON.parse(GM_getValue('speeds','{}')),// empty object to hold speed for each source
			rememberSpeed:GM_getValue('rememberSpeed',true),// default: false
			forceLastSavedSpeed:GM_getValue('forceLastSavedSpeed',true),//default: false
			audioBoolean:GM_getValue('audioBoolean',false),// default: false
			startHidden:GM_getValue('startHidden',true),// default: false
			controllerOpacity:GM_getValue('controllerOpacity',0.3),// default: 0.3
			keyBindings:JSON.parse(GM_getValue('keyBindings','[]')),
			blacklist:`www.instagram.com\ntwitter.com\nvine.co\nimgur.com\nteams.microsoft.com`,
			defaultLogLevel:GM_getValue('defaultLogLevel',5),
			logLevel:GM_getValue('logLevel',5),
			version:GM_getValue('version',"0.5.3")
		},
		// Holds a reference to all of the AUDIO/VIDEO DOM elements we've attached to
		mediaElements:[]
	};
	function log(message,level){
		let verbosity=tc.settings.logLevel;
		if(typeof level==="undefined"){
			level=tc.settings.defaultLogLevel;
		}
		if(verbosity>=level){
			if(level===2){
				GM_log("ERROR:"+message);
			}else if(level===3){
				GM_log("WARNING:"+message);
			}else if(level===4){
				GM_log("INFO:"+message);
			}else if(level===5){
				GM_log("DEBUG:"+message);
			}else if(level===6){
				GM_log("DEBUG (VERBOSE):"+message);
				console.trace();
			}
		}
	}
//	tc.settings.keyBindings=JSON.parse(localStorage.getItem("keyBindings"))||[];
	let storage=tc.settings.keyBindings;
	if(tc.settings.keyBindings.length===0){
		tc.settings.keyBindings.push({
			action:"slower",
			key:Number(storage.slowerKeyCode)||83,
			value:Number(storage.speedStep)||0.1,
			force:false,
			predefined:true
		});// default S
		tc.settings.keyBindings.push({
			action:"faster",
			key:Number(storage.fasterKeyCode)||68,
			value:Number(storage.speedStep)||0.1,
			force:false,
			predefined:true
		});// default: D
		tc.settings.keyBindings.push({
			action:"rewind",
			key:Number(storage.rewindKeyCode)||90,
			value:Number(storage.rewindTime)||10,
			force:false,
			predefined:true
		});// default: Z
		tc.settings.keyBindings.push({
			action:"advance",
			key:Number(storage.advanceKeyCode)||88,
			value:Number(storage.advanceTime)||10,
			force:false,
			predefined:true
		});// default: X
		tc.settings.keyBindings.push({
			action:"reset",
			key:Number(storage.resetKeyCode)||82,
			value:1.0,
			force:false,
			predefined:true
		});// default: R
		tc.settings.keyBindings.push({
			action:"fast",
			key:Number(storage.fastKeyCode)||71,
			value:Number(storage.fastSpeed)||1.8,
			force:false,
			predefined:true
		});// default: G
		tc.settings.keyBindings.push({
			action:"display",
			key:Number(storage.fastKeyCode)||86,
			value:0,
			force:false,
			predefined:true
		});// default: V
//		localStorage.setItem("keyBindings",JSON.stringify(tc.settings.keyBindings));
		GM_setValue('keyBindings',JSON.stringify(tc.settings.keyBindings));
	}
	// ensure that there is a "display" binding (for upgrades from versions that had it as a separate binding)
	initializeWhenReady(document);
	function getKeyBindings(action,what="value"){
		try{
			return tc.settings.keyBindings.find((item)=>item.action===action)[what];
		}catch(e){
			return false;
		}
	}
	function setKeyBindings(action,value){
		tc.settings.keyBindings.find((item)=>item.action===action).value=value;
		GM_setValue('keyBindings',JSON.stringify(tc.settings.keyBindings));
	}
	function defineVideoController(){
// Data structures
// ---------------
// videoController (JS object) instances:
//   video = AUDIO/VIDEO DOM element
//   parent = A/V DOM element's parentElement OR
//            (A/V elements discovered from the Mutation Observer)
//            A/V element's parentNode OR the node whose children changed.
//   div = Controller's DOM element (which happens to be a DIV)
//   speedIndicator = DOM element in the Controller of the speed indicator
// added to AUDIO / VIDEO DOM elements
//    vsc = reference to the videoController
		tc.videoController=function(target,parent){
			if(target.vsc){
				return target.vsc;
			}
			tc.mediaElements.push(target);
			this.video=target;
			this.parent=target.parentElement||parent;
			let storedSpeed=tc.settings.speeds[target.currentSrc];
			if(!tc.settings.rememberSpeed){
				if(!storedSpeed){
					log("Overwriting stored speed to 1.0 due to rememberSpeed being disabled",5);
					storedSpeed=1.0;
				}
				setKeyBindings("reset",getKeyBindings("fast"));// resetSpeed = fastSpeed
			}else{
				log("Recalling stored speed due to rememberSpeed being enabled",5);
				storedSpeed=tc.settings.lastSpeed;
			}
			log("Explicitly setting playbackRate to: "+storedSpeed,5);
			target.playbackRate=storedSpeed;
			this.div=this.initializeControls();
			var mediaEventAction=function(event){
				storedSpeed=tc.settings.speeds[event.target.currentSrc];
				if(!tc.settings.rememberSpeed){
					if(!storedSpeed){
						log("Overwriting stored speed to 1.0 (rememberSpeed not enabled)",4);
						storedSpeed=1.0;
					}
					// resetSpeed isn't really a reset, it's a toggle
					log("Setting reset keybinding to fast",5);
					setKeyBindings("reset",getKeyBindings("fast"));// resetSpeed = fastSpeed
				}else{
					log("Storing lastSpeed into tc.settings.speeds (rememberSpeed enabled)",5);
					storedSpeed=tc.settings.lastSpeed;
				}
				// TODO: Check if explicitly setting the playback rate to 1.0 is
				// necessary when rememberSpeed is disabled (this may accidentally
				// override a website's intentional initial speed setting interfering
				// with the site's default behavior)
				log("Explicitly setting playbackRate to: "+storedSpeed,4);
				setSpeed(event.target,storedSpeed);
			};
			target.addEventListener("play",(this.handlePlay=mediaEventAction.bind(this)));
			target.addEventListener("seeked",(this.handleSeek=mediaEventAction.bind(this)));
			var targetObserver=new MutationObserver((mutations)=>{
				mutations.forEach((mutation)=>{
					if(mutation.type==="attributes"&&(mutation.attributeName==="src"||mutation.attributeName==="currentSrc")){
						log("mutation of A/V element",5);
						var controller=this.div;
						if(!mutation.target.src&&!mutation.target.currentSrc){
							controller.classList.add("vsc-nosource");
						}else{
							controller.classList.remove("vsc-nosource");
						}
					}
				});
			});
			targetObserver.observe(target,{attributeFilter:["src","currentSrc"]});
		};
		tc.videoController.prototype.remove=function(){
			this.div.remove();
			this.video.removeEventListener("play",this.handlePlay);
			this.video.removeEventListener("seek",this.handleSeek);
			delete this.video.vsc;
			let idx=tc.mediaElements.indexOf(this.video);
			if(idx!==-1){
				tc.mediaElements.splice(idx,1);
			}
		};
		tc.videoController.prototype.initializeControls=function(){
			log("initializeControls Begin",5);
			const document=this.video.ownerDocument;
			const speed=this.video.playbackRate.toFixed(2);
			const rect=this.video.getBoundingClientRect();
			// getBoundingClientRect is relative to the viewport; style coordinates
			// are relative to offsetParent, so we adjust for that here. offsetParent
			// can be null if the video has `display: none` or is not yet in the DOM.
			const offsetRect=this.video.offsetParent?.getBoundingClientRect();
			const top=Math.max(rect.top-(offsetRect?.top||0),0)+"px";
			const left=Math.max(rect.left-(offsetRect?.left||0),0)+"px";
			log("Speed variable set to: "+speed,5);
			var wrapper=document.createElement("div");
			wrapper.classList.add("vsc-controller");
			if(!this.video.currentSrc){
				wrapper.classList.add("vsc-nosource");
			}
			if(tc.settings.startHidden){
				wrapper.classList.add("vsc-hidden");
			}
			var shadow=wrapper.attachShadow({mode:"open"});
			var shadowTemplate = `<style>
* {
  line-height: 1.8em;
  font-family: sans-serif;
  font-size: 13px;
}

:host(:hover) #controls {
  display: inline;
}

#controller {
  position: absolute;
  top: 0;
  left: 0;

  background: black;
  color: white;

  border-radius: 6px;
  padding: 4px;
  margin: 10px 10px 10px 15px;

  cursor: default;
  z-index: 9999999;
}

#controller:hover {
  opacity: 0.7;
}

#controller:hover > .draggable {
  margin-right: 0.8em;
}

#controls {
  display: none;
}

#controller.dragging {
  cursor: -webkit-grabbing;
  opacity: 0.7;
}

#controller.dragging #controls {
  display: inline;
}

.draggable {
  cursor: -webkit-grab;
}

.draggable:active {
  cursor: -webkit-grabbing;
}

button {
  opacity: 1;
  cursor: pointer;
  color: black;
  background: white;
  font-weight: normal;
  border-radius: 5px;
  padding: 1px 5px 3px 5px;
  font-size: 14px;
  line-height: 14px;
  border: 0px solid white;
  font-family: "Lucida Console", Monaco, monospace;
  margin: 0px 2px 2px 2px;
  transition: background 0.2s, color 0.2s;
}

button:focus {
  outline: 0;
}

button:hover {
  opacity: 1;
  background: #2196f3;
  color: #ffffff;
}

button:active {
  background: #2196f3;
  color: #ffffff;
  font-weight: bold;
}

button.rw {
  opacity: 0.65;
}

button.hideButton {
  opacity: 0.65;
  margin-right: 2px;
}
</style>
<div id="controller" style="top:${top}; left:${left}; opacity:${tc.settings.controllerOpacity}">
	<span data-action="drag" class="draggable">${speed}</span>
	<span id="controls">
		<button data-action="rewind" class="rw">«</button>
		<button data-action="slower">&minus;</button>
		<button data-action="faster">&plus;</button>
		<button data-action="advance" class="rw">»</button>
		<button data-action="display" class="hideButton">&times;</button>
	</span>
</div>`;
			shadow.innerHTML=shadowTemplate;
			shadow.querySelector(".draggable").addEventListener("mousedown",(e)=>{
				runAction(e.target.dataset.action,false,e);
				e.stopPropagation();
			},true);
			shadow.querySelectorAll("button").forEach(function(button){
				button.addEventListener("click",(e)=>{
					runAction(e.target.dataset.action,getKeyBindings(e.target.dataset.action),e);
					e.stopPropagation();
				},true);
			});
			shadow
					.querySelector("#controller")
					.addEventListener("click",(e)=>e.stopPropagation(),false);
			shadow
					.querySelector("#controller")
					.addEventListener("mousedown",(e)=>e.stopPropagation(),false);
			this.speedIndicator=shadow.querySelector("span");
			var fragment=document.createDocumentFragment();
			fragment.appendChild(wrapper);
			switch(true){
				case location.hostname==="www.amazon.com":
				case location.hostname==="www.reddit.com":
				case /hbogo\./.test(location.hostname):
					// insert before parent to bypass overlay
					this.parent.parentElement.insertBefore(fragment,this.parent);
					break;
				case location.hostname==="www.facebook.com":
					// this is a monstrosity but new FB design does not have *any*
					// semantic handles for us to traverse the tree, and deep nesting
					// that we need to bubble up from to get controller to stack correctly
					this.parent.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.insertBefore(fragment,this.parent.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.firstChild);
					break;
				case location.hostname==="tv.apple.com":
					// insert before parent to bypass overlay
					this.parent.parentNode.insertBefore(fragment,this.parent.parentNode.firstChild);
					break;
				default:
					// Note: when triggered via a MutationRecord, it's possible that the
					// target is not the immediate parent. This appends the controller as
					// the first element of the target, which may not be the parent.
					this.parent.insertBefore(fragment,this.parent.firstChild);
			}
			return wrapper;
		};
	}
	function escapeStringRegExp(str){
		let matchOperatorsRe=/[|\\{}()[\]^$+*?.]/g;
		return str.replace(matchOperatorsRe,"\\$&");
	}
	function isBlacklisted(){
		let blacklisted=false;
		tc.settings.blacklist.split("\n").forEach((match)=>{
			match=match.replace(regStrip,"");
			if(match.length===0){
				return;
			}
			var regex;
			if(match.startsWith("/")){
				try{
					var parts=match.split("/");
					var flags;
					if(regEndsWithFlags.test(match)){
						flags=parts.pop();
						regex=parts.slice(1).join("/");
					}else{
						flags="";
						regex=match;
					}
					var regexp=new RegExp(regex,flags);
				}catch(err){
					return;
				}
			}else{
				regexp=new RegExp(escapeStringRegExp(match));
			}
			if(regexp.test(location.href)){
				blacklisted=true;
				return;
			}
		});
		return blacklisted;
	}
	var coolDown=false;
	function refreshCoolDown(){
		log("Begin refreshCoolDown",5);
		if(coolDown){
			clearTimeout(coolDown);
		}
		coolDown=setTimeout(function(){
			coolDown=false;
		},1000);
		log("End refreshCoolDown",5);
	}
	function setupListener(){
		function onWheelEvent(ev){
			let changeRate=0.1;
			if(ev.shiftKey){
				if(ev.altKey){
					if(ev.deltaY>0){
						ev.preventDefault();
						runAction("softer",changeRate);
					}else{
						ev.preventDefault();
						runAction("louder",changeRate);
					}
				}else{
					if(ev.deltaY>0){
						ev.preventDefault();
						runAction("rewind",changeRate*10);
					}else{
						ev.preventDefault();
						runAction("advance",changeRate*10);
					}
				}
			}else if(ev.altKey){
				if(ev.deltaY>0){
					ev.preventDefault();
					runAction("slower",changeRate);
				}else{
					ev.preventDefault();
					runAction("faster",changeRate);
				}
			}
		}
		window.addEventListener("wheel",onWheelEvent.bind(this),{
			passive:false
		});
		/**
		 * This function is run whenever a video speed rate change occurs.
		 * It is used to update the speed that shows up in the display as well as save
		 * that latest speed into the local storage.
		 *
		 * @param {*} video The video element to update the speed indicators for.
		 */
		function updateSpeedFromEvent(video){
// It's possible to get a rate change on a VIDEO/AUDIO that doesn't have
// a video controller attached to it.  If we do, ignore it.
			if(!video.vsc){
				return;
			}
			var speedIndicator=video.vsc.speedIndicator;
			var speed=Number(video.playbackRate.toFixed(2));
			log("Playback rate changed to "+speed,4);
			log("Updating controller with new speed",5);
			speedIndicator.textContent=speed.toFixed(2);
			tc.settings.speeds[location.hostname]=speed;
			log("Storing lastSpeed in settings for the rememberSpeed feature",5);
			tc.settings.lastSpeed=speed;
			log("Syncing chrome settings for lastSpeed",5);
			/*
			 chrome.storage.sync.set({ lastSpeed: speed }, function () {
			 log("Speed setting saved: " + speed, 5);
			 });
			 */
			// show the controller for 1000ms if it's hidden.
			GM_setValue('lastSpeed',speed);
			GM_setValue('speeds',JSON.stringify(tc.settings.speeds));
			runAction("blink",null,null);
		}
		document.addEventListener(
				"ratechange",
				function(event){
					if(coolDown){
						log("Speed event propagation blocked",4);
						event.stopImmediatePropagation();
					}
					var video=event.composedPath()[0];
					/**
					 * If the last speed is forced, only update the speed based on events created by
					 * video speed instead of all video speed change events.
					 */
					if(tc.settings.forceLastSavedSpeed){
						if(event.detail&&event.detail.origin==="videoSpeed"){
							video.playbackRate=event.detail.speed;
							updateSpeedFromEvent(video);
						}else{
							video.playbackRate=tc.settings.lastSpeed;
						}
						event.stopImmediatePropagation();
					}else{
						updateSpeedFromEvent(video);
					}
				},
				true
				);
	}
	function initializeWhenReady(document){
		log("Begin initializeWhenReady",5);
		if(isBlacklisted()){
			return;
		}
		window.onload=()=>{
			initializeNow(window.document);
		};
		if(document){
			if(document.readyState==="complete"){
				initializeNow(document);
			}else{
				document.onreadystatechange=()=>{
					if(document.readyState==="complete"){
						initializeNow(document);
					}
				};
			}
		}
		log("End initializeWhenReady",5);
	}
	function inIframe(){
		try{
			return window.self!==window.top;
		}catch(e){
			return true;
		}
	}
	function getShadow(parent){
		let result=[];
		function getChild(parent){
			if(parent.firstElementChild){
				var child=parent.firstElementChild;
				do{
					result.push(child);
					getChild(child);
					if(child.shadowRoot){
						result.push(getShadow(child.shadowRoot));
					}
					child=child.nextElementSibling;
				}while(child);
			}
		}
		getChild(parent);
		return result.flat(Number.POSITIVE_INFINITY);
	}
	function initializeNow(document){
		log("Begin initializeNow",5);
		if(!tc.settings.enabled){
			return;
		}
		// enforce init-once due to redundant callers
		if(!document.body||document.body.classList.contains("vsc-initialized")){
			return;
		}
		try{
			setupListener();
		}catch(error){
		}
		document.body.classList.add("vsc-initialized");
		log("initializeNow: vsc-initialized added to document body",5);
		if(document===window.document){
			defineVideoController();
		}
		var docs=Array(document);
		try{
			if(inIframe()){
				docs.push(window.top.document);
			}
		}catch(e){
		}
		docs.forEach(function(doc){
			doc.addEventListener("keydown",function(event){
				var keyCode=event.keyCode;
				log("Processing keydown event: "+keyCode,6);
				// Ignore if following modifier is active.
				if(!event.getModifierState||event.getModifierState("Alt")||event.getModifierState("Control")||event.getModifierState("Fn")||event.getModifierState("Meta")||event.getModifierState("Hyper")||event.getModifierState("OS")){
					log("Keydown event ignored due to active modifier: "+keyCode,5);
					return;
				}
				// Ignore keydown event if typing in an input box
				if(event.target.nodeName==="INPUT"||event.target.nodeName==="TEXTAREA"||event.target.isContentEditable){
					return false;
				}
				// Ignore keydown event if typing in a page without vsc
				if(!tc.mediaElements.length){
					return false;
				}
				var item=tc.settings.keyBindings.find((item)=>item.key===keyCode);
				if(item){
					runAction(item.action,item.value);
					if(item.force==="true"){
						// disable websites key bindings
						event.preventDefault();
						event.stopPropagation();
					}
				}
				return false;
			},true);
		});
		function checkForVideoAndShadowRoot(node,parent,added){
			// Only proceed with supposed removal if node is missing from DOM
			if(!added&&document.body?.contains(node)){
				return;
			}
			if(node.nodeName==="VIDEO"||(node.nodeName==="AUDIO"&&tc.settings.audioBoolean)){
				if(added){
					node.vsc=new tc.videoController(node,parent);
				}else{
					if(node.vsc){
						node.vsc.remove();
					}
				}
			}else{
				var children=[];
				if(node.shadowRoot){
					documentAndShadowRootObserver.observe(node.shadowRoot,documentAndShadowRootObserverOptions);
					children=Array.from(node.shadowRoot.children);
				}
				if(node.children){
					children=[...children,...node.children];
				}
				for(const child of children){
					checkForVideoAndShadowRoot(child,child.parentNode||parent,added);
				}
			}
		}
		var documentAndShadowRootObserver=new MutationObserver(function(mutations){
// Process the DOM nodes lazily
			requestIdleCallback((_)=>{
				mutations.forEach(function(mutation){
					switch(mutation.type){
						case "childList":
							mutation.addedNodes.forEach(function(node){
								if(typeof node==="function"){
									return;
								}
								if(node===document.documentElement){
// This happens on sites that use document.write, e.g. watch.sling.com
// When the document gets replaced, we lose all event handlers, so we need to reinitialize
									log("Document was replaced, reinitializing",5);
									initializeWhenReady(document);
									return;
								}
								checkForVideoAndShadowRoot(node,node.parentNode||mutation.target,true);
							});
							mutation.removedNodes.forEach(function(node){
								if(typeof node==="function"){
									return;
								}
								checkForVideoAndShadowRoot(node,node.parentNode||mutation.target,false);
							});
							break;
						case "attributes":
							if((mutation.target.attributes["aria-hidden"]&&mutation.target.attributes["aria-hidden"].value==="false")||mutation.target.nodeName==='APPLE-TV-PLUS-PLAYER'){
								var flattenedNodes=getShadow(document.body);
								var nodes=flattenedNodes.filter((x)=>x.tagName==="VIDEO");
								for(let node of nodes){
// only add vsc the first time for the apple-tv case (the attribute change is triggered every time you click the vsc)
									if(node.vsc&&mutation.target.nodeName==='APPLE-TV-PLUS-PLAYER'){
										continue;
									}
									if(node.vsc){
										node.vsc.remove();
									}
									checkForVideoAndShadowRoot(node,node.parentNode||mutation.target,true);
								}
							}
							break;
					}
				});
			},{timeout:1000});
		});
		documentAndShadowRootObserver.observe(document,documentAndShadowRootObserverOptions);
		const mediaTagSelector=tc.settings.audioBoolean?"video,audio":"video";
		mediaTags = Array.from(document.querySelectorAll(mediaTagSelector));
		document.querySelectorAll("*").forEach((element)=>{
			if(element.shadowRoot){
				documentAndShadowRootObserver.observe(element.shadowRoot,documentAndShadowRootObserverOptions);
				mediaTags.push(...element.shadowRoot.querySelectorAll(mediaTagSelector));
			}
		});
		mediaTags?.forEach(function(video){
			video.vsc=new tc.videoController(video);
		});
		var frameTags=document.getElementsByTagName("iframe");
		Array.prototype.forEach.call(frameTags,function(frame){
			// Ignore frames we don't have permission to access (different origin).
			try{
				var childDocument=frame.contentDocument;
			}catch(e){
				return;
			}
			initializeWhenReady(childDocument);
		});
		log("End initializeNow",5);
	}
	function setSpeed(video,speed){
		log("setSpeed started: "+speed,5);
		var speedvalue=speed.toFixed(2);
		if(tc.settings.forceLastSavedSpeed){
			video.dispatchEvent(new CustomEvent("ratechange",{bubbles: true,composed: true,detail:{origin:"videoSpeed",speed:speedvalue}}));
		}else{
			video.playbackRate=Number(speedvalue);
		}
		var speedIndicator=video.vsc.speedIndicator;
		speedIndicator.textContent=speedvalue;
		tc.settings.lastSpeed=speed;
		GM_setValue('lastSpeed',speed);
		refreshCoolDown();
		log("setSpeed finished: "+speed,5);
	}
	function runAction(action,value,e){
		log("runAction Begin",5);
		var mediaTags=tc.mediaElements;
		// Get the controller that was used if called from a button press event e
		if(e){
			var targetController=e.target.getRootNode().host;
		}
		mediaTags.forEach(function(v){
			var controller=v.vsc.div;
			// Don't change video speed if the video has a different controller
			if(e&&!(targetController===controller)){
				return;
			}
			showController(controller);
			if(!v.classList.contains("vsc-cancelled")){
				if(action==="softer"){
					v.volume-=value;
					log(`softer: ${v.volume}`,5);
				}else if(action==="louder"){
					v.volume+=value;
					log(`louder: ${v.volume}`,5);
				}else if(action==="rewind"){
					log("Rewind",5);
					v.currentTime-=value;
				}else if(action==="advance"){
					log("Fast forward",5);
					v.currentTime+=value;
				}else if(action==="faster"){
					log("Increase speed",5);
					// Maximum playback speed in Chrome is set to 16:
					// https://cs.chromium.org/chromium/src/third_party/blink/renderer/core/html/media/html_media_element.cc?gsn=kMinRate&l=166
					setSpeed(v,Math.min((v.playbackRate<0.1?0.0:v.playbackRate)+value,16));
				}else if(action==="slower"){
					log("Decrease speed",5);
					// Video min rate is 0.0625:
					// https://cs.chromium.org/chromium/src/third_party/blink/renderer/core/html/media/html_media_element.cc?gsn=kMinRate&l=165
					setSpeed(v,Math.max(v.playbackRate-value,0.07));
				}else if(action==="reset"){
					log("Reset speed",5);
					resetSpeed(v,1.0);
				}else if(action==="display"){
					log("Showing controller",5);
					controller.classList.add("vsc-manual");
					controller.classList.toggle("vsc-hidden");
				}else if(action==="blink"){
					log("Showing controller momentarily",5);
					// if vsc is hidden, show it briefly to give the use visual feedback that the action is excuted.
					if(controller.classList.contains("vsc-hidden")||controller.blinkTimeOut!==undefined){
						clearTimeout(controller.blinkTimeOut);
						controller.classList.remove("vsc-hidden");
						controller.blinkTimeOut=setTimeout(()=>{
							controller.classList.add("vsc-hidden");
							controller.blinkTimeOut=undefined;
						},value?value:1000);
					}
				}else if(action==="drag"){
					handleDrag(v,e);
				}else if(action==="fast"){
					resetSpeed(v,value);
				}else if(action==="pause"){
					pause(v);
				}else if(action==="muted"){
					muted(v);
				}else if(action==="mark"){
					setMark(v);
				}else if(action==="jump"){
					jumpToMark(v);
				}
			}
		});
		log("runAction End",5);
	}
	function pause(v){
		if(v.paused){
			log("Resuming video",5);
			v.play();
		}else{
			log("Pausing video",5);
			v.pause();
		}
	}
	function resetSpeed(v,target){
		if(v.playbackRate===target){
			if(v.playbackRate===getKeyBindings("reset")){
				if(target!==1.0){
					log("Resetting playback speed to 1.0",4);
					setSpeed(v,1.0);
				}else{
					log('Toggling playback speed to "fast" speed',4);
					setSpeed(v,getKeyBindings("fast"));
				}
			}else{
				log('Toggling playback speed to "reset" speed',4);
				setSpeed(v,getKeyBindings("reset"));
			}
		}else{
			log('Toggling playback speed to "reset" speed',4);
			setKeyBindings("reset",v.playbackRate);
			setSpeed(v,target);
		}
	}
	function muted(v){
		v.muted=v.muted!==true;
	}
	function setMark(v){
		log("Adding marker",5);
		v.vsc.mark=v.currentTime;
	}
	function jumpToMark(v){
		log("Recalling marker",5);
		if(v.vsc.mark&&typeof v.vsc.mark==="number"){
			v.currentTime=v.vsc.mark;
		}
	}
	function handleDrag(video,e){
		const controller=video.vsc.div;
		const shadowController=controller.shadowRoot.querySelector("#controller");
		// Find nearest parent of same size as video parent.
		var parentElement=controller.parentElement;
		while(parentElement.parentNode&&parentElement.parentNode.offsetHeight===parentElement.offsetHeight&&parentElement.parentNode.offsetWidth===parentElement.offsetWidth){
			parentElement=parentElement.parentNode;
		}
		video.classList.add("vcs-dragging");
		shadowController.classList.add("dragging");
		const initialMouseXY=[e.clientX,e.clientY];
		const initialControllerXY=[
			parseInt(shadowController.style.left),
			parseInt(shadowController.style.top)
		];
		const startDragging=(e)=>{
			let style=shadowController.style;
			let dx=e.clientX-initialMouseXY[0];
			let dy=e.clientY-initialMouseXY[1];
			style.left=initialControllerXY[0]+dx+"px";
			style.top=initialControllerXY[1]+dy+"px";
		};
		const stopDragging=()=>{
			parentElement.removeEventListener("mousemove",startDragging);
			parentElement.removeEventListener("mouseup",stopDragging);
			parentElement.removeEventListener("mouseleave",stopDragging);
			shadowController.classList.remove("dragging");
			video.classList.remove("vcs-dragging");
		};
		parentElement.addEventListener("mouseup",stopDragging);
		parentElement.addEventListener("mouseleave",stopDragging);
		parentElement.addEventListener("mousemove",startDragging);
	}
	var timer=null;
	function showController(controller){
		log("Showing controller",4);
		controller.classList.add("vcs-show");
		if(timer){
			clearTimeout(timer);
		}
		timer=setTimeout(function(){
			controller.classList.remove("vcs-show");
			timer=false;
			log("Hiding controller",5);
		},2000);
	}
})();
