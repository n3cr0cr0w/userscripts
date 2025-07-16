// ==UserScript==
// @name         Crunchyroll Release Calendar Filter
// @namespace    https://github.com/N3Cr0Cr0W/userscripts
// @version      0.25.07.16.02
// @description  Adds a filter to the Crunchyroll release calendar
// @author       N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.RCF.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.RCF.user.js
// @match        https://www.crunchyroll.com/simulcastcalendar*
// @grant        GM_listValues
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==
(function(){
	'use strict';
	GM_addStyle(`
		#cr-rs-filter-menu{display:flex;align-items:center;justify-content:space-around;padding:10px;background-color:#23252b;border-radius:4px;margin-bottom:15px;gap:15px;flex-wrap:wrap;}
		.cr-rs-class{color:#f4f4f4;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;}
		.cr-rs-filter-group{display:flex;align-items:center;gap:8px;position:relative;}
		.cr-rs-filter-group label{cursor:pointer;margin-right:5px;}
		.cr-rs-filter-group .group-label{font-weight:bold;margin-right:5px;}
		.cr-rs-vertical-divider{border-left:1px solid #444;height:24px;}
		.cr-rs-hide{display:none !important;}
		.cr-rs-progress-on-closed{width:100%;height:3px;position:absolute;bottom:0;left:0;-webkit-appearance:none;appearance:none;border:none;background-color:transparent;}
		.cr-rs-progress-on-closed::-webkit-progress-bar{background-color:transparent;}
		.cr-rs-progress-on-closed::-webkit-progress-value{background-color:#f47521;}
		.cr-rs-progress-on-closed::-moz-progress-bar{background-color:#f47521;}
		.cr-rs-reset-button{background-color:#f47521;color:white;border:none;border-radius:3px;padding:4px 8px;font-size:0.9em;cursor:pointer;margin-left:10px;}
		.cr-rs-reset-button:hover{background-color:#d8641c;}
		.cr-rs-hidden-count{padding:2px 6px;background-color:#f47521;color:white;border-radius:3px;font-size:0.9em;margin-left:5px;}
		#cr-rs-others-label{text-decoration:underline;cursor:pointer;}
		#cr-rs-others-panel{display:none;position:absolute;top:100%;left:0;background-color:#2d2f37;border:1px solid #444;border-radius:4px;padding:10px;z-index:100;columns:2;}
		#cr-rs-others-panel.visible{display:block;}
		#cr-rs-others-panel label{display:block;margin-bottom:5px;}
	`);
	const CRRS_CLASS='cr-rs-class';
	const CRRS_FILTER_MENU_DIV_ID='cr-rs-filter-menu';
	const CRRS_FILTER_MENU_PICK_DUBS_DIV_ID='cr-rs-filter-menu-pick-dubs';
	const CRRS_FILTER_MENU_DUBS_RADIO_GROUP_NAME='dubbed-switch';
	const CRRS_FILTER_MENU_QUEUE_RADIO_GROUP_NAME='in-queue-switch';
	const CRRS_FILTER_MENU_PERMIERE_RADIO_GROUP_NAME='premiere-switch';
	const CRRS_FILTER_MENU_LOCK_BTN_ID='cr-rs-filter-menu-lock-filters';
	const CRRS_HIDDEN_COUNT_CLASS_NAME='cr-rs-filter-hidden-count';
	const ALL_DUB_LANGUAGES=['Arabic','Castilian','Catalan','English','English-IN','European-Portuguese','French','German','Hindi','Italian','Mandarin','Polish','Portuguese','Russian','Spanish','Tamil','Thai'];
	const DEFAULT_DUB_LANGUAGES=['English','Spanish','French','German'];
	class Pref{
		static instance;
		#crrsFilter;
		static getInstance(){
			if(!this.instance)this.instance=new Pref();
			return this.instance;
		}
		set crrsFilter(filter){this.#crrsFilter=filter;}
		get crrsFilter(){return this.#crrsFilter;}
	}
	const preference=Pref.getInstance();
	class Content{
		static #regexp=/^(.*) ?(?:\(([A-Z][a-z]+(?:-(?:[A-Z]{2}))?(?: ?[A-Z][a-z]+)?) Dub\)?)$/;
		static #regexp_for_english_dub_special_case=/^(.*) ?(?:\(Dub\)?)$/;
		static #regexp_for_cr_anime_awards=/^(?!.*Japanese)(.*) (?:\(([A-Z][a-z]+(?:-(?:[A-Z]{2}))?) Audio\)?)$/;
		static #regexp_for_cr_anime_awards_english_dub=/^(The \d{4} Crunchyroll Anime Awards)$/;
		static #id_prefix='cr-rs-content-';
		constructor(content,index){
			this.element=content;
			this.#parseContent(content);
		}
		#parseContent(content){
			const releaseArticle=content.querySelector('article.js-release');
			if(!releaseArticle)return;
			const{slug,episodeNum}=releaseArticle.dataset;
			this.isPremiere=!!content.querySelector('.premiere-flag');
			this.inQueue=!!content.querySelector('.queue-flag.queued');
			const seasonCite=content.querySelector('h1.season-name cite');
			this.seasonTitle=seasonCite?seasonCite.textContent:'';
			this.isDub=false;
			let match=this.seasonTitle.match(Content.#regexp);
			if(match){
				this.isDub=true;
				this.dubLanguage=match[2].replace(' ','-');
			}else if(match=this.seasonTitle.match(Content.#regexp_for_english_dub_special_case)){
				this.isDub=true;
				this.dubLanguage='English';
			}else if(match=this.seasonTitle.match(Content.#regexp_for_cr_anime_awards)){
				this.isDub=true;
				this.dubLanguage=match[2];
			}else if(match=this.seasonTitle.match(Content.#regexp_for_cr_anime_awards_english_dub)){
				this.isDub=true;
				this.dubLanguage='English';
				this.forceShowInSubOnlyAlso=true;
			}
			const progress=content.querySelector('progress');
			if(progress&&progress.value>0)this.createProgressBar(releaseArticle,progress.value);
			content.id=`${Content.#id_prefix}${slug}-${episodeNum}-${this.isDub?this.dubLanguage.toLowerCase():'sub'}`;
			content.classList.add(this.isDub?`cr-rs-${this.dubLanguage.toLowerCase()}`:'cr-rs-no-dub');
		}
		createProgressBar(elementToAttachTo,progressAmount){
			const progressElem=document.createElement('progress');
			progressElem.classList.add(CRRS_CLASS,'cr-rs-progress-on-closed');
			progressElem.value=progressAmount;
			progressElem.max=100;
			elementToAttachTo.append(progressElem);
		}
		hide(){this.element.classList.add('cr-rs-hide');}
		show(){this.element.classList.remove('cr-rs-hide');}
	}
	class Day{
		constructor(dayElement,showHiddenCount){
			if(showHiddenCount)this.hiddenCountElement=this.createHiddenCount(dayElement.querySelector('.specific-date').parentNode);
			this.contentList=[...dayElement.querySelectorAll('li')].map((li,i)=>new Content(li,i));
			this.dubsList=this.contentList.filter(c=>c.isDub);
			this.subsList=this.contentList.filter(c=>!c.isDub);
			this.inQueueList=this.contentList.filter(c=>c.inQueue);
			this.premiereList=this.contentList.filter(c=>c.isPremiere);
		}
		createHiddenCount(elementToAttachTo){
			const hiddenCount=document.createElement('div');
			hiddenCount.classList.add(CRRS_CLASS,CRRS_HIDDEN_COUNT_CLASS_NAME);
			hiddenCount.textContent='0 Hidden';
			elementToAttachTo.append(hiddenCount);
			return hiddenCount;
		}
		applyFilter(filterState){
			let hiddenContent=new Set();
			if(filterState.hideAllSubs)this.subsList.forEach(c=>hiddenContent.add(c));
			if(filterState.hideAllDubs){
				this.dubsList.forEach(c=>{if(!c.forceShowInSubOnlyAlso)hiddenContent.add(c);});
			}else{
				const shownLangs=new Set(filterState.dubsShown);
				this.dubsList.forEach(c=>{if(!shownLangs.has(c.dubLanguage.toLowerCase()))hiddenContent.add(c);});
			}
			if(filterState.hideInQueue)this.inQueueList.forEach(c=>hiddenContent.add(c));
			if(filterState.hidePremiere)this.premiereList.forEach(c=>hiddenContent.add(c));
			let shownContent=this.contentList.filter(c=>!hiddenContent.has(c));
			if(filterState.showOnlyInQueue&&filterState.showOnlyPremiere)shownContent=shownContent.filter(c=>c.inQueue||c.isPremiere);
			else if(filterState.showOnlyInQueue)shownContent=shownContent.filter(c=>c.inQueue);
			else if(filterState.showOnlyPremiere)shownContent=shownContent.filter(c=>c.isPremiere);
			const shownSet=new Set(shownContent);
			this.contentList.forEach(c=>shownSet.has(c)?c.show():c.hide());
			if(this.hiddenCountElement){
				const hiddenCount=this.contentList.length-shownContent.length;
				this.hiddenCountElement.textContent=`${hiddenCount} Hidden`;
				this.hiddenCountElement.style.display=hiddenCount>0?'inline-block':'none';
			}
		}
	}
	class Week{
		constructor(showHiddenCount){
			this.days=[...document.querySelectorAll('.day')].map(d=>new Day(d,showHiddenCount));
		}
		applyFilter(filterState){
			this.days.forEach(day=>day.applyFilter(filterState));
		}
	}
	class Filter{
		constructor(week){
			this.week=week;
			this.state=this.defaultState();
		}
		defaultState(){
			return{
				hideAllSubs:false,
				hideAllDubs:false,
				dubsShown:DEFAULT_DUB_LANGUAGES.map(l=>l.toLowerCase()),
				mainLanguages:DEFAULT_DUB_LANGUAGES.map(l=>l.toLowerCase()),
				hideInQueue:false,
				showOnlyInQueue:false,
				hidePremiere:false,
				showOnlyPremiere:false,
			};
		}
		reset(){
			this.state=this.defaultState();
			this.apply();
		}
		restore(savedJson){
			if(savedJson&&savedJson.version===CRRS_JSON_VERSION){
				this.state={
					hideAllSubs:savedJson.hideAllSubs,
					hideAllDubs:savedJson.hideAllDub,
					dubsShown:savedJson.dubsShown||DEFAULT_DUB_LANGUAGES.map(l=>l.toLowerCase()),
					mainLanguages:savedJson.mainLanguages||DEFAULT_DUB_LANGUAGES.map(l=>l.toLowerCase()),
					hideInQueue:!savedJson.showInQueue,
					showOnlyInQueue:savedJson.showOnlyInQueue,
					hidePremiere:!savedJson.showPremiere,
					showOnlyPremiere:savedJson.showOnlyPremiere,
				};
			}else{
				this.reset();
			}
			this.apply();
		}
		createJson(){
			return{
				version:CRRS_JSON_VERSION,
				hideAllSubs:this.state.hideAllSubs,
				hideAllDub:this.state.hideAllDubs,
				dubsShown:this.state.dubsShown,
				mainLanguages:this.state.mainLanguages,
				showInQueue:!this.state.hideInQueue,
				showOnlyInQueue:this.state.showOnlyInQueue,
				showPremiere:!this.state.hidePremiere,
				showOnlyPremiere:this.state.showOnlyPremiere,
			};
		}
		apply(){this.week.applyFilter(this.state);}
		updateDubFilter(mode,list){this.state.hideAllSubs=(mode==='only');this.state.hideAllDubs=(mode==='hide');this.state.dubsShown=(mode==='hide')?[]:list;this.apply();}
		updateMainLanguages(langs){this.state.mainLanguages=langs;this.state.dubsShown=this.state.dubsShown.filter(l=>this.state.mainLanguages.includes(l));this.apply();}
		updateQueueFilter(mode){this.state.hideInQueue=(mode==='hide');this.state.showOnlyInQueue=(mode==='only');this.apply();}
		updatePremiereFilter(mode){this.state.hidePremiere=(mode==='hide');this.state.showOnlyPremiere=(mode==='only');this.apply();}
	}
	function createUI(elementToAttachTo){
		const menu=document.createElement('div');
		menu.id=CRRS_FILTER_MENU_DIV_ID;
		menu.append(createRadioGroup('Dubbed:','dubbed-toggle',CRRS_FILTER_MENU_DUBS_RADIO_GROUP_NAME,handleDubbedRadioGroup));
		menu.append(createDubPickerContainer());
		menu.append(createVerticalDivider());
		menu.append(createRadioGroup('In Queue:','in-queue-toggle',CRRS_FILTER_MENU_QUEUE_RADIO_GROUP_NAME,handleQueueRadioGroup));
		menu.append(createVerticalDivider());
		menu.append(createRadioGroup('Premiere:','premier-toggle',CRRS_FILTER_MENU_PERMIERE_RADIO_GROUP_NAME,handlePremiereRadioGroup));
		menu.append(createVerticalDivider());
		menu.append(createActionButtons());
		elementToAttachTo.prepend(menu);
		renderMainDubPicker();
		return menu;
	}
	function createRadioGroup(groupText,idPrefix,name,eventHandler){
		const group=document.createElement('div');
		group.className='cr-rs-filter-group';
		const label=document.createElement('span');
		label.className='group-label';
		label.textContent=groupText;
		group.append(label);
		['Only','Show','Hide'].forEach((value,index)=>{
			const[input,label]=createCheckbox(value,eventHandler,index===1,name,'radio');
			input.value=value.toLowerCase();
			group.append(input,label);
		});
		return group;
	}
	function createDubPickerContainer(){
		const container=document.createElement('div');
		container.className='cr-rs-filter-group';
		const picker=document.createElement('div');
		picker.id=CRRS_FILTER_MENU_PICK_DUBS_DIV_ID;
		container.append(picker,createOthersPicker());
		return container;
	}
	function renderMainDubPicker(){
		const picker=document.getElementById(CRRS_FILTER_MENU_PICK_DUBS_DIV_ID);
		picker.innerHTML='';
		const mainLangs=preference.crrsFilter.state.mainLanguages;
		const shownLangs=preference.crrsFilter.state.dubsShown;
		mainLangs.forEach(lang=>{
			const[cb,lab]=createCheckbox(lang,handleDubPickerCheckbox,shownLangs.includes(lang));
			picker.append(cb,lab);
		});
	}
	function createOthersPicker(){
		const container=document.createElement('div');
		container.style.position='relative';
		const othersLabel=document.createElement('label');
		othersLabel.id='cr-rs-others-label';
		othersLabel.textContent='Others';
		const panel=document.createElement('div');
		panel.id='cr-rs-others-panel';
		ALL_DUB_LANGUAGES.forEach(lang=>{
			const isHidden=!preference.crrsFilter.state.mainLanguages.includes(lang.toLowerCase());
			const[cb,lab]=createCheckbox(lang,handleOthersChange,isHidden);
			panel.append(cb,lab);
		});
		othersLabel.addEventListener('click',e=>{e.preventDefault();panel.classList.toggle('visible');});
		document.addEventListener('click',e=>{if(!container.contains(e.target))panel.classList.remove('visible');});
		container.append(othersLabel,panel);
		return container;
	}
	function createCheckbox(lang,eventHandler,checked=true,name='',type='checkbox'){
		const input=document.createElement('input');
		const label=document.createElement('label');
		const id=`cr-rs-filter-menu-${name}-${lang.toLowerCase()}`;
		input.type=type;
		input.id=id;
		input.name=name;
		input.dataset.lang=lang.toLowerCase();
		input.checked=checked;
		input.addEventListener('change',eventHandler);
		label.htmlFor=id;
		label.textContent=lang;
		return[input,label];
	}
	function createActionButtons(){
		const group=document.createElement('div');
		group.className='cr-rs-filter-group';
		const[lockCheckbox,lockLabel]=createCheckbox('Lock',handelLockBtn,false);
		lockCheckbox.id=CRRS_FILTER_MENU_LOCK_BTN_ID;
		lockLabel.title='Save filter settings for future visits';
		const resetBtn=document.createElement('button');
		resetBtn.textContent='Reset';
		resetBtn.title='Reset Filters';
		resetBtn.className='cr-rs-reset-button';
		resetBtn.addEventListener('click',handelResetBtn);
		group.append(lockCheckbox,lockLabel,resetBtn);
		return group;
	}
	function createVerticalDivider(){
		const divider=document.createElement('div');
		divider.className='cr-rs-vertical-divider';
		return divider;
	}
	function getDubPickerLangs(){return[...document.querySelectorAll(`#${CRRS_FILTER_MENU_PICK_DUBS_DIV_ID} input:checked`)].map(cb=>cb.dataset.lang);}
	function handleDubbedRadioGroup(event){preference.crrsFilter.updateDubFilter(event.target.value,getDubPickerLangs());}
	function handleDubPickerCheckbox(){const mode=document.querySelector(`input[name="${CRRS_FILTER_MENU_DUBS_RADIO_GROUP_NAME}"]:checked`).value;preference.crrsFilter.updateDubFilter(mode,getDubPickerLangs());}
	function handleOthersChange(event){
		const lang=event.target.dataset.lang;
		const isHidden=event.target.checked;
		let mainLangs=preference.crrsFilter.state.mainLanguages;
		if(isHidden){
			mainLangs=mainLangs.filter(l=>l!==lang);
		}else if(!mainLangs.includes(lang)){
			mainLangs.push(lang);
		}
		preference.crrsFilter.updateMainLanguages(mainLangs);
		renderMainDubPicker();
	}
	function handleQueueRadioGroup(event){preference.crrsFilter.updateQueueFilter(event.target.value);}
	function handlePremiereRadioGroup(event){preference.crrsFilter.updatePremiereFilter(event.target.value);}
	function handelLockBtn(event){
		const isLocked=event.target.checked;
		if(isLocked)saveFilter(preference.crrsFilter.createJson());
		else clearSavedFilter();
		lockFilters(isLocked);
	}
	function handelResetBtn(){
		const lockCheckbox=document.getElementById(CRRS_FILTER_MENU_LOCK_BTN_ID);
		if(lockCheckbox)lockCheckbox.checked=false;
		document.querySelectorAll('input[type="radio"]').forEach(radio=>{if(radio.value==='show')radio.checked=true;});
		preference.crrsFilter.reset();
		renderMainDubPicker();
		const othersPanel=document.getElementById('cr-rs-others-panel');
		othersPanel.querySelectorAll('input').forEach(cb=>{
			cb.checked=!DEFAULT_DUB_LANGUAGES.map(l=>l.toLowerCase()).includes(cb.dataset.lang);
		});
		clearSavedFilter();
		lockFilters(false);
	}
	function lockFilters(isLocked){
		const fields=document.querySelectorAll(`#${CRRS_FILTER_MENU_DIV_ID} input:not(#${CRRS_FILTER_MENU_LOCK_BTN_ID})`);
		fields.forEach(field=>field.disabled=isLocked);
	}
	function restoreUI(savedFilter){
		if(!savedFilter)return;
		const dubMode=savedFilter.hideAllDub?'hide':(savedFilter.hideAllSubs?'only':'show');
		document.querySelector(`input[name="${CRRS_FILTER_MENU_DUBS_RADIO_GROUP_NAME}"][value="${dubMode}"]`).checked=true;
		const queueMode=!savedFilter.showInQueue?'hide':(savedFilter.showOnlyInQueue?'only':'show');
		document.querySelector(`input[name="${CRRS_FILTER_MENU_QUEUE_RADIO_GROUP_NAME}"][value="${queueMode}"]`).checked=true;
		const premiereMode=!savedFilter.showPremiere?'hide':(savedFilter.showOnlyPremiere?'only':'show');
		document.querySelector(`input[name="${CRRS_FILTER_MENU_PERMIERE_RADIO_GROUP_NAME}"][value="${premiereMode}"]`).checked=true;
		renderMainDubPicker();
		const othersPanel=document.getElementById('cr-rs-others-panel');
		othersPanel.querySelectorAll('input').forEach(cb=>{
			cb.checked=!savedFilter.mainLanguages.includes(cb.dataset.lang);
		});
		const lockCheckbox=document.getElementById(CRRS_FILTER_MENU_LOCK_BTN_ID);
		if(lockCheckbox)lockCheckbox.checked=true;
	}
	const CRRS_JSON_VERSION=2;
	async function saveFilter(filter){await GM_setValue('filter',filter);await GM_setValue('jsonVersion',CRRS_JSON_VERSION);}
	async function restorePreference(){
		let items={
			filter:await GM_getValue('filter',null),
			showFilter:await GM_getValue('showFilter',true),
			showHCount:await GM_getValue('showHCount',true),
			jsonVersion:await GM_getValue('jsonVersion',0)
		};
		if(items.jsonVersion!==CRRS_JSON_VERSION){
			await clearAll();
			return{...items,filter:null};
		}
		return items;
	}
	async function clearSavedFilter(){await GM_deleteValue('filter');}
	async function clearAll(){const keys=await GM_listValues();for(const key of keys){await GM_deleteValue(key);}}
	window.addEventListener('load',async()=>{
		const header=document.querySelector('header.simulcast-calendar-header');
		if(!header)return;
		const items=await restorePreference();
		preference.crrsFilter=new Filter(new Week(items.showHCount));
		if(items.filter){
			preference.crrsFilter.restore(items.filter);
		}
		if(items.showFilter){
			createUI(header);
			if(items.filter){
				restoreUI(items.filter);
				lockFilters(true);
			}
		}
	});
})();
