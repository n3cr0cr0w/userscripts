// ==UserScript==
// @name         Streaming Skips
// @namespace    https://github.com/N3Cr0Cr0W/userscripts
// @version      0.26.07.02.05
// @description  Skips intros, recaps, credits, next episode prompts, and common ads across major streaming sites.
// @author       N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Streaming.Skips.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Streaming.Skips.user.js
// @match        https://www.amazon.com/gp/video/*
// @match        https://www.primevideo.com/*
// @match        https://www.crunchyroll.com/*
// @match        https://static.crunchyroll.com/vilos-v2/*
// @match        https://www.disneyplus.com/*
// @match        https://*.hbomax.com/*
// @match        https://hbomax.com/*
// @match        https://www.hulu.com/*
// @match        https://www.imdb.com/tv/watch/*
// @match        https://www.hidive.com/*
// @match        https://www.max.com/*
// @match        https://www.netflix.com/*
// @match        https://www.paramountplus.com/*
// @grant        GM_log
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==
(function(){
	'use strict';
	const host=globalThis.location.hostname.toLowerCase();
	const clickedElements=new WeakMap();
	const clickCooldownMs=10_000;
	let lastUrl=globalThis.location.href;
	let lastAmazonAdTime=0;
	let lastParamountAdTime=0;
	const runIntervalMs=400;
	const settingsKey='streaming-skips-settings';
	const defaultSettings={enabled:true,intro:true,recap:true,outro:true,ads:true};
	const settings=loadSettings();
	const menuCommandIds={};
	const log=(...args)=>{if(typeof GM_log==='function')GM_log(args.join(' '));else console.log(...args);};
	const skips={
		amazon:{
			intro:[
				{kind:'xpath',selector:'//button[normalize-space()="Skip Intro"]',name:'Amazon intro'}
			],
			recap:[
				{kind:'xpath',selector:'//button[normalize-space()="Skip Recap"]',name:'Amazon recap'}
			],
			outro:[
				{kind:'css',selector:'[class*="nextupcard-button"]',name:'Amazon next episode'},
				{kind:'css',selector:'[class*="nextupcardhide-button"]',name:'Amazon next episode hide'},
				{kind:'css',selector:'button[aria-label*="Next Episode"]',name:'Amazon next episode aria'},
				{kind:'css',selector:'button[aria-label*="Next"]',name:'Amazon next generic'},
				{
					kind:'css',
					selector:'div#dv-web-player>div>div:nth-child(1)>div>div>div.webPlayerSDKPlayerContainer>div>div>div>div>div>div>div>div>div>div>div>div>svg>circle',
					name:'Amazon next episode fallback',
					click:(element)=>{element.parentElement?.parentElement?.parentElement?.click();}
				}
			],
			ad:[
				{kind:'xpath',selector:'//div[normalize-space()="Skip"]',name:'Amazon ad button'}
			]
		},
		crunchyroll:{
			intro:[
				{kind:'text',values:['SKIP INTRO','SKIP PREVIEW','skip intro','skip preview'],name:'Crunchyroll intro/preview'}
			],
			recap:[
				{kind:'text',values:['SKIP RECAP','skip recap'],name:'Crunchyroll recap'}
			],
			outro:[
				{kind:'text',values:['SKIP CREDITS','skip credits'],name:'Crunchyroll credits'},
				{kind:'css',selector:'.end-card__metadata-area-play-button',name:'Crunchyroll next episode'}
			],
			ad:[]
		},
		disney:{
			intro:[
				{kind:'shadow',host:'skip-overlay',chain:['skip-button','button'],name:'Disney intro/recap shadow skip'},
				{kind:'text',values:['Skip Intro'],name:'Disney intro text'}
			],
			recap:[
				{kind:'shadow',host:'skip-overlay',chain:['skip-button','button'],name:'Disney intro/recap shadow skip'},
				{kind:'text',values:['Skip Recap'],name:'Disney recap text'}
			],
			outro:[
				{kind:'css',selector:'[data-testid="icon-restart"]',name:'Disney credits restart',click:(element)=>{element.parentElement?.click();}},
				{kind:'css',selector:'.overlay_upnextlite_button-container',name:'Disney up next',click:(element)=>{element.firstElementChild?.click();}}
			],
			ad:[
				{kind:'css',selector:'.overlay_interstitials__promo_skip_button',name:'Disney ad'}
			]
		},
		max:{
			intro:[
				{kind:'css',selector:'button[class*="SkipButton-"]',name:'Max intro/recap skip'},
				{kind:'text',values:['Skip Intro'],name:'Max intro text'}
			],
			recap:[
				{kind:'css',selector:'button[class*="SkipButton-"]',name:'Max intro/recap skip'},
				{kind:'text',values:['Skip Recap'],name:'Max recap text'}
			],
			outro:[
				{kind:'css',selector:'button[class*="UpNextButton-"]',name:'Max up next'},
				{kind:'css',selector:'button[class*="DismissButton-"]',name:'Max dismiss'}
			],
			ad:[]
		},
		netflix:{
			intro:[
				{kind:'css',selector:'[data-uia="player-skip-intro"]',name:'Netflix intro'},
				{kind:'css',selector:'button.watch-video--skip-content-button',name:'Netflix legacy intro'}
			],
			recap:[
				{kind:'css',selector:'[data-uia="player-skip-recap"]',name:'Netflix recap'},
				{kind:'css',selector:'[data-uia="player-skip-preplay"]',name:'Netflix preplay recap'}
			],
			outro:[
				{kind:'css',selector:'[data-uia="next-episode-seamless-button-draining"]',name:'Netflix next episode'},
				{kind:'css',selector:'[data-uia="watch-credits-seamless-button"]',name:'Netflix watch credits'},
				{kind:'css',selector:'[data-uia="interrupt-autoplay-continue"]',name:'Netflix autoplay continue'}
			],
			ad:[]
		},
		paramount:{
			intro:[
				{kind:'css',selector:'button.skip-button',name:'Paramount intro'}
			],
			recap:[],
			outro:[
				{kind:'css',selector:'div[class*="end-card-panel-"] button.play-button',name:'Paramount next episode'},
				{kind:'css',selector:'div[class*="end-card-panel-"] button#close-btn',name:'Paramount close credits'}
			],
			ad:[]
		},
		hulu:{
			intro:[
				{kind:'css',selector:'.ControlsContainer__transition .SkipButton button',name:'Hulu intro button'},
				{kind:'css',selector:'.ControlsContainer__transition .SkipButton',name:'Hulu intro container'}
			],
			recap:[],
			outro:[
				{kind:'css',selector:'.end-card__metadata-area-play-button',name:'Hulu next episode'}
			],
			ad:[]
		},
		hidive:{
			intro:[
				{kind:'text',values:['Skip Intro'],name:'HiDive intro'}
			],
			recap:[],
			outro:[
				{kind:'text',values:['Skip Credits'],name:'HiDive credits'}
			],
			ad:[]
		}
	};
	function loadSettings(){
		if(typeof GM_getValue!=='function')return {...defaultSettings};
		const saved=GM_getValue(settingsKey,null);
		if(!saved)return {...defaultSettings};
		try{return {...defaultSettings,...JSON.parse(saved)};}
		catch{return {...defaultSettings};}
	}
	function saveSettings(){
		if(typeof GM_setValue!=='function')return;
		GM_setValue(settingsKey,JSON.stringify(settings));
	}
	function isEnabled(key){
		return settings.enabled&&settings[key];
	}
	function toggleSetting(key,label){
		settings[key]=!settings[key];
		saveSettings();
		refreshMenuCommands();
		log(`${label} ${settings[key]?'enabled':'disabled'}`);
	}
	function refreshMenuCommands(){
		if(typeof GM_registerMenuCommand!=='function')return;
		const unregister=typeof GM_unregisterMenuCommand==='function';
		for(const key of Object.keys(menuCommandIds)){
			if(unregister)GM_unregisterMenuCommand(menuCommandIds[key]);
			delete menuCommandIds[key];
		}
		menuCommandIds.global=GM_registerMenuCommand(`Global skips: ${settings.enabled?'on':'off'}`,()=>toggleSetting('enabled','Global skips'));
		menuCommandIds.intro=GM_registerMenuCommand(`Intro skips: ${settings.intro?'on':'off'}`,()=>toggleSetting('intro','Intro skips'));
		menuCommandIds.recap=GM_registerMenuCommand(`Recap skips: ${settings.recap?'on':'off'}`,()=>toggleSetting('recap','Recap skips'));
		menuCommandIds.outro=GM_registerMenuCommand(`Outro skips: ${settings.outro?'on':'off'}`,()=>toggleSetting('outro','Outro skips'));
		menuCommandIds.ads=GM_registerMenuCommand(`Ad skips: ${settings.ads?'on':'off'}`,()=>toggleSetting('ads','Ad skips'));
	}
	function normalizeText(value){return (value||'').replace(/\s+/g,' ').trim().toLowerCase();}
	function isVisible(element){
		if(!element||!(element instanceof Element))return false;
		if(typeof element.checkVisibility==='function'){
			try{return element.checkVisibility({opacityProperty:true,visibilityProperty:true,contentVisibilityAuto:true});}
			catch{return element.checkVisibility();}
		}
		const rect=element.getBoundingClientRect();
		return rect.width>0&&rect.height>0;
	}
	function clickOnce(element,label,clickHandler=null){
		if(!element||!isVisible(element))return false;
		const now=Date.now();
		const lastClickedAt=clickedElements.get(element)||0;
		if(now-lastClickedAt<clickCooldownMs)return false;
		clickedElements.set(element,now);
		try{
			if(typeof clickHandler==='function')clickHandler(element);
			else element.click();
		}catch{
			clickedElements.delete(element);
			return false;
		}
		if(label)log(label);
		return true;
	}
	function querySelectorAllVisible(selectors,root=document){
		for(const selector of selectors){
			const element=root.querySelector(selector);
			if(clickOnce(element,selector))return true;
		}
		return false;
	}
	function clickByXPath(xpath,label){
		const element=document.evaluate(xpath,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
		return clickOnce(element,label);
	}
	function isPlaybackControl(element,normalizedText){
		const text=normalizedText||'';
		const aria=normalizeText(element?.getAttribute?.('aria-label')||'');
		const title=normalizeText(element?.getAttribute?.('title')||'');
		const combined=`${text} ${aria} ${title}`.trim();
		if(!combined)return false;
		if(combined.includes('skip intro')||combined.includes('skip recap')||combined.includes('skip preview')||combined.includes('skip credits'))return false;
		return /\b(play|pause|resume|replay|unmute|mute|fullscreen|miniplayer)\b/.test(combined);
	}
	function textMatchesTarget(text,target){
		if(!text||!target)return false;
		if(text===target)return true;
		if(text.startsWith(`${target} `))return true;
		if(text.endsWith(` ${target}`))return true;
		return false;
	}
	function clickByText(texts,root=document,label=''){
		const normalizedTargets=texts.map(normalizeText);
		const elements=root.querySelectorAll('button, [role="button"], a');
		for(const element of elements){
			const text=normalizeText((element.textContent||'')+' '+(element.getAttribute('aria-label')||'')+' '+(element.getAttribute('title')||''));
			if(!text)continue;
			if(text.length>80)continue;
			if(isPlaybackControl(element,text))continue;
			if(normalizedTargets.some(target=>textMatchesTarget(text,target))){
				if(clickOnce(element,label||texts[0]))return true;
			}
		}
		return false;
	}
	function resolveShadowElement(rule){
		let current=document.querySelector(rule.host);
		if(!current)return null;
		for(let i=0;i<rule.chain.length;i++){
			const part=rule.chain[i];
			if(i===rule.chain.length-1)return current.shadowRoot?.querySelector(part)||null;
			current=current.shadowRoot?.querySelector(part);
			if(!current)return null;
		}
		return null;
	}
	function executeRule(rule){
		if(!rule)return false;
		if(rule.kind==='xpath')return clickByXPath(rule.selector,rule.name);
		if(rule.kind==='text')return clickByText(rule.values||[],document,rule.name);
		if(rule.kind==='shadow'){
			const element=resolveShadowElement(rule);
			return clickOnce(element,rule.name,rule.click||null);
		}
		if(rule.kind==='css'){
			const element=document.querySelector(rule.selector);
			return clickOnce(element,rule.name,rule.click||null);
		}
		return false;
	}
	function applySkipRules(service,category){
		const rules=skips?.[service]?.[category]||[];
		for(const rule of rules){
			if(executeRule(rule))return true;
		}
		return false;
	}
	function getLastNumber(text){
		const numbers=normalizeText(text||'').match(/\d+/g);
		return numbers?Number(numbers[numbers.length-1]):null;
	}
	function getVideo(){
		return document.querySelector('video');
	}
	function parseAdTime(adTimeText){
		if(!adTimeText)return 0;
		const cleaned=adTimeText.replace(/[^\d:]/g,'').trim();
		if(!cleaned)return 0;
		if(cleaned.includes(':')){
			const parts=cleaned.split(':').filter(Boolean);
			if(parts.length===2)return Number.parseInt(parts[0],10)*60+Number.parseInt(parts[1],10);
			if(parts.length===3)return Number.parseInt(parts[0],10)*3600+Number.parseInt(parts[1],10)*60+Number.parseInt(parts[2],10);
		}
		return Number.parseInt(cleaned,10)||0;
	}
	function handleAmazonLike(){
		if(isEnabled('recap'))applySkipRules('amazon','recap');
		if(isEnabled('intro'))applySkipRules('amazon','intro');
		if(isEnabled('ads'))applySkipRules('amazon','ad');
		if(isEnabled('outro'))applySkipRules('amazon','outro');
		const video=getVideo();
		if(!video||video.paused||video.currentTime<=0)return;
		const adTimer=document.querySelector('.dv-player-fullscreen .atvwebplayersdk-ad-timer-remaining-time');
		const adTime=parseAdTime(adTimer?.textContent||'');
		if(adTime>1&&lastAmazonAdTime!==adTime){
			lastAmazonAdTime=adTime;
			video.currentTime+=Math.min(adTime-1,90);
			log('Amazon ad skipped',String(adTime));
			setTimeout(()=>{lastAmazonAdTime=0;},1500);
		}
	}
	function handleCrunchyroll(){
		if(isEnabled('intro'))applySkipRules('crunchyroll','intro');
		if(isEnabled('recap'))applySkipRules('crunchyroll','recap');
		if(isEnabled('outro'))applySkipRules('crunchyroll','outro');
	}
	function handleDisney(){
		if(isEnabled('intro'))applySkipRules('disney','intro');
		if(isEnabled('recap'))applySkipRules('disney','recap');
		if(isEnabled('outro'))applySkipRules('disney','outro');
		if(isEnabled('ads'))applySkipRules('disney','ad');
	}
	function handleMax(){
		const episodeText=document.querySelector('[data-testid="player-ux-season-episode"]')?.textContent || '';
		const episodeNumber=getLastNumber(episodeText);
		if(episodeNumber!==1){
			if(isEnabled('intro')||isEnabled('recap')){
				if(isEnabled('intro'))applySkipRules('max','intro');
				if(isEnabled('recap'))applySkipRules('max','recap');
			}
		}
		if(isEnabled('outro'))applySkipRules('max','outro');
	}
	function handleNetflix(){
		const titleText=document.querySelector('[data-uia="video-title"]')?.textContent || '';
		const episodeNumber=getLastNumber(titleText);
		if(episodeNumber!==1){
			if(isEnabled('intro'))applySkipRules('netflix','intro');
		}
		if(isEnabled('recap'))applySkipRules('netflix','recap');
		if(isEnabled('outro'))applySkipRules('netflix','outro');
	}
	function handleParamount(){
		if(isEnabled('intro'))applySkipRules('paramount','intro');
		if(isEnabled('outro'))applySkipRules('paramount','outro');
		if(isEnabled('ads')){
			const video=getVideo();
			if(!video||video.paused)return;
			const adText=document.querySelector('div.ad-info-manager-circular-loader-copy')?.textContent || '0';
			const adTime=parseAdTime(adText);
			if(adTime>0&&lastParamountAdTime!==adTime){
				lastParamountAdTime=adTime;
				video.currentTime+=adTime;
				log('Paramount ad skipped',String(adTime));
				setTimeout(()=>{lastParamountAdTime=0;},2500);
			}
		}
	}
	function handleHulu(){
		if(isEnabled('intro'))applySkipRules('hulu','intro');
		if(isEnabled('outro'))applySkipRules('hulu','outro');
	}
	function handleHiDive(){
		if(isEnabled('intro'))applySkipRules('hidive','intro');
		if(isEnabled('outro'))applySkipRules('hidive','outro');
	}
	function handleAmazonPrimeAndImdb(){
		handleAmazonLike();
	}
	function runHandlers(){
		if(host.includes('amazon.')||host.includes('primevideo.')||host.includes('imdb.com')){
			handleAmazonPrimeAndImdb();
		}
		if(host.includes('crunchyroll.com'))handleCrunchyroll();
		if(host.includes('disneyplus.com'))handleDisney();
		if(host.includes('max.com')||host.includes('hbomax.com')||host.includes('hbo.com'))handleMax();
		if(host.includes('netflix.com'))handleNetflix();
		if(host.includes('paramountplus.com'))handleParamount();
		if(host.includes('hulu.com'))handleHulu();
		if(host.includes('hidive.com'))handleHiDive();
	}
	function onUrlMaybeChanged(source){
		const currentUrl=globalThis.location.href;
		if(currentUrl===lastUrl)return;
		lastUrl=currentUrl;
		log(`URL changed (${source})`,currentUrl);
		runHandlers();
	}
	function installUrlWatchers(){
		try{
			const originalPushState=history.pushState;
			if(typeof originalPushState==='function'){
				history.pushState=function(...args){
					const result=originalPushState.apply(this,args);
					onUrlMaybeChanged('pushState');
					return result;
				};
			}
			const originalReplaceState=history.replaceState;
			if(typeof originalReplaceState==='function'){
				history.replaceState=function(...args){
					const result=originalReplaceState.apply(this,args);
					onUrlMaybeChanged('replaceState');
					return result;
				};
			}
		}catch{}
		globalThis.addEventListener('popstate',()=>onUrlMaybeChanged('popstate'));
		globalThis.addEventListener('hashchange',()=>onUrlMaybeChanged('hashchange'));
	}
	const observer=new MutationObserver(()=>runHandlers());
	if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true});
	installUrlWatchers();
	refreshMenuCommands();
	runHandlers();
	setInterval(()=>{onUrlMaybeChanged('poll');runHandlers();},runIntervalMs);
})();