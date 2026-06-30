// ==UserScript==
// @name         Streaming Skips
// @namespace    https://github.com/N3Cr0Cr0W/userscripts
// @version      0.26.06.30.01
// @description  Skips intros, recaps, credits, next episode prompts, and common ads across major streaming sites.
// @author       N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Streaming.Skips.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/Streaming.Skips.user.js
// @match        https://www.amazon.com/gp/video/*
// @match        https://www.primevideo.com/*
// @match        https://www.crunchyroll.com/watch/*
// @match        https://static.crunchyroll.com/vilos-v2/*
// @match        https://www.disneyplus.com/video*
// @match        *://*.hbomax.com/*
// @match        *://hbomax.com/*
// @match        https://www.hulu.com/*
// @match        https://www.imdb.com/tv/watch/*
// @match        https://www.max.com/*
// @match        https://www.netflix.com/watch/*
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
	const clickedElements=new WeakSet();
	let lastAmazonAdTime=0;
	let lastParamountAdTime=0;
	const runIntervalMs=400;
	const settingsKey='streaming-skips-settings';
	const defaultSettings={enabled:true,intro:true,recap:true,outro:true,ads:true};
	const settings=loadSettings();
	const menuCommandIds={};
	const log=(...args)=>{if(typeof GM_log==='function')GM_log(args.join(' '));else console.log(...args);};
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
	function clickOnce(element,label){
		if(!element||clickedElements.has(element)||!isVisible(element))return false;
		clickedElements.add(element);
		try{element.click();}catch{ return false; }
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
	function clickByText(texts,root=document){
		const normalizedTargets=texts.map(normalizeText);
		const elements=root.querySelectorAll('button, [role="button"], a, div, span');
		for(const element of elements){
			const text=normalizeText((element.textContent||'')+' '+(element.getAttribute('aria-label')||''));
			if(!text)continue;
			if(normalizedTargets.some(target=>text===target||text.includes(target))){
				if(clickOnce(element,texts[0]))return true;
			}
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
		if(isEnabled('recap'))clickByXPath('//button[normalize-space()="Skip Recap"]','Amazon recap');
		if(isEnabled('intro'))clickByXPath('//button[normalize-space()="Skip Intro"]','Amazon intro');
		if(isEnabled('ads'))clickByXPath('//div[normalize-space()="Skip"]','Amazon ad');
		if(isEnabled('outro')&&!querySelectorAllVisible(['[class*="nextupcard-button"]','[class*="nextupcardhide-button"]','button[aria-label*="Next Episode"]','button[aria-label*="Next"]'])){
			const circle=document.querySelector('div#dv-web-player>div>div:nth-child(1)>div>div>div.webPlayerSDKPlayerContainer>div>div>div>div>div>div>div>div>div>div>div>div>svg>circle');
			if(circle&&!clickedElements.has(circle)){
				clickedElements.add(circle);
				circle.parentElement?.parentElement?.parentElement?.click();
				log('Amazon next episode');
			}
		}
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
		if(isEnabled('intro'))clickByText(['SKIP INTRO','SKIP PREVIEW']);
		if(isEnabled('recap'))clickByText(['SKIP RECAP']);
		if(isEnabled('outro'))clickByText(['SKIP CREDITS']);
		if(isEnabled('outro'))querySelectorAllVisible(['.end-card__metadata-area-play-button']);
		const playerButtons=document.querySelectorAll('button');
		for(const button of playerButtons){
			const label=normalizeText((button.textContent||'')+' '+(button.getAttribute('aria-label')||''));
			if(isEnabled('intro')&&(label.includes('skip intro')||label.includes('skip preview'))&&clickOnce(button,'Crunchyroll intro'))return;
			if(isEnabled('recap')&&label.includes('skip recap')&&clickOnce(button,'Crunchyroll recap'))return;
			if(isEnabled('outro')&&label.includes('skip credits')&&clickOnce(button,'Crunchyroll outro'))return;
		}
	}
	function handleDisney(){
		const skipOverlay=document.querySelector('skip-overlay')?.shadowRoot;
		const skipButton=skipOverlay?.querySelector('skip-button')?.shadowRoot?.querySelector('button');
		if((isEnabled('intro')||isEnabled('recap'))&&clickOnce(skipButton,'Disney intro/recap'))return;
		if(isEnabled('intro')&&clickByText(['Skip Intro']))return;
		if(isEnabled('recap')&&clickByText(['Skip Recap']))return;
		const creditsButton=document.querySelector('[data-testid="icon-restart"]')?.parentElement || document.querySelector('.overlay_upnextlite_button-container')?.firstElementChild;
		if(isEnabled('outro')&&clickOnce(creditsButton,'Disney outro'))return;
		if(isEnabled('ads'))querySelectorAllVisible(['.overlay_interstitials__promo_skip_button']);
	}
	function handleMax(){
		const episodeText=document.querySelector('[data-testid="player-ux-season-episode"]')?.textContent || '';
		const episodeNumber=getLastNumber(episodeText);
		if(episodeNumber!==1){
			if(isEnabled('intro')||isEnabled('recap')){
				if(querySelectorAllVisible(['button[class*="SkipButton-"]']))return;
				if(isEnabled('intro')&&clickByText(['Skip Intro']))return;
				if(isEnabled('recap')&&clickByText(['Skip Recap']))return;
			}
		}
		if(isEnabled('outro')&&querySelectorAllVisible(['button[class*="UpNextButton-"]','button[class*="DismissButton-"]']))return;
	}
	function handleNetflix(){
		const titleText=document.querySelector('[data-uia="video-title"]')?.textContent || '';
		const episodeNumber=getLastNumber(titleText);
		if(episodeNumber!==1){
			if(isEnabled('intro')&&querySelectorAllVisible(['[data-uia="player-skip-intro"]','button.watch-video--skip-content-button','.watch-video--skip-content-button']))return;
		}
		if(isEnabled('recap')&&querySelectorAllVisible(['[data-uia="player-skip-recap"]','[data-uia="player-skip-preplay"]']))return;
		if(isEnabled('outro'))querySelectorAllVisible(['[data-uia="next-episode-seamless-button-draining"]','[data-uia="watch-credits-seamless-button"]','[data-uia="interrupt-autoplay-continue"]']);
	}
	function handleParamount(){
		if(isEnabled('intro')&&querySelectorAllVisible(['button.skip-button']))return;
		const episodePanel=document.querySelector('div[class*="end-card-panel-"]');
		if(episodePanel){
			const playButton=episodePanel.querySelector('button.play-button');
			if(isEnabled('outro')&&clickOnce(playButton,'Paramount outro'))return;
			const closeButton=episodePanel.querySelector('button#close-btn');
			if(isEnabled('outro')&&clickOnce(closeButton,'Paramount outro close'))return;
		}
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
		if(isEnabled('intro')&&querySelectorAllVisible(['.ControlsContainer__transition .SkipButton button','.ControlsContainer__transition .SkipButton']))return;
		if(isEnabled('outro'))querySelectorAllVisible(['.end-card__metadata-area-play-button']);
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
	}
	const observer=new MutationObserver(()=>runHandlers());
	if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true});
	refreshMenuCommands();
	runHandlers();
	setInterval(runHandlers,runIntervalMs);
})();