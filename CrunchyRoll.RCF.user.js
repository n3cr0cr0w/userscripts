// ==UserScript==
// @name         Crunchyroll Release Calendar Filter
// @namespace    https://github.com/N3Cr0Cr0W/userscripts
// @version      0.25.07.16
// @description  Adds a filter to the Crunchyroll release calendar
// @author       N3Cr0Cr0W
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.RCF.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/CrunchyRoll.RCF.user.js
// @match        https://www.crunchyroll.com/simulcastcalendar
// @grant        GM_listValues
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==
(function (){
	'use strict';
	GM_addStyle(`
		#cr-rs-filter-menu{
			display:flex;
			align-items:center;
			justify-content:space-around;
			padding:10px;
			background-color:#23252b;
			border-radius:4px;
			margin-bottom:15px;
			gap:15px;
			flex-wrap:wrap;
		}
		.cr-rs-class{
			color:#f4f4f4;
			font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;
		}
		.cr-rs-filter-group{
			display:flex;
			align-items:center;
			gap:8px;
		}
		.cr-rs-filter-group label{
			cursor:pointer;
			margin-right:5px;
		}
		.cr-rs-filter-group .group-label{
			font-weight:bold;
			margin-right:5px;
		}
		.cr-rs-vertical-divider{
			border-left:1px solid #444;
			height:24px;
		}
		.cr-rs-hide{
			display:none !important;
		}
		.cr-rs-progress-on-closed{
				width:100%;
				height:3px;
				position:absolute;
				bottom:0;
				left:0;
				-webkit-appearance:none;
				appearance:none;
				border:none;
				background-color:transparent;
		}
		.cr-rs-progress-on-closed::-webkit-progress-bar{
				background-color:transparent;
		}
		.cr-rs-progress-on-closed::-webkit-progress-value{
				background-color:#f47521;
		}
		.cr-rs-progress-on-closed::-moz-progress-bar{
				background-color:#f47521;
		}
		.cr-rs-reset-button{
				background-color:#f47521;
				color:white;
				border:none;
				border-radius:3px;
				padding:4px 8px;
				font-size:0.9em;
				cursor:pointer;
				margin-left:10px;
		}
		.cr-rs-reset-button:hover{background-color:#d8641c;}
		.cr-rs-hidden-count{
			padding:2px 6px;
			background-color:#f47521;
			color:white;
			border-radius:3px;
			font-size:0.9em;
			margin-left:5px;
		}
	`);
	const CRRS_CLASS="cr-rs-class";
	const CRRS_FILTER_MENU_DIV_ID="cr-rs-filter-menu";
	const CRRS_FILTER_MENU_PICK_DUBS_DIV_ID="cr-rs-filter-menu-pick-dubs";
	const CRRS_FILTER_MENU_PICK_DUBS_INPUT_ID_PREFIX="cr-rs-filter-menu-pick-dubs-lang-";
	const CRRS_FILTER_MENU_DUBS_RADIO_GROUP_NAME="dubbed-switch";
	const CRRS_FILTER_MENU_QUEUE_RADIO_GROUP_NAME="in-queue-switch";
	const CRRS_FILTER_MENU_PERMIERE_RADIO_GROUP_NAME="premiere-switch";
	const CRRS_FILTER_MENU_LOCK_BTN_ID="cr-rs-filter-menu-lock-filters";
	const CRRS_HIDDEN_COUNT_CLASS_NAME="cr-rs-filter-hidden-count";
	const ALL_DUB_LANGUAGES=["Arabic","Castilian","Catalan","English","English-IN","European-Portuguese","French","German","Hindi","Italian","Mandarin","Polish","Portuguese","Russian","Spanish","Tamil","Thai"];
	const DEFAULT_DUB_LANGUAGES=["English","Spanish","French","German"];
	class Pref{
		static instance;
		#crrsFilter;
		#reflowEnabled;
		#savedLanguages;
		static getInstance(){
			if(!this.instance){
				this.instance=new Pref();
			}
			return this.instance;
		}
		set crrsFilter(filter){this.#crrsFilter=filter;}
		get crrsFilter(){return this.#crrsFilter;}
		set reflowEnabled(enabled){this.#reflowEnabled=enabled;}
		get reflowEnabled(){return this.#reflowEnabled;}
		set savedLanguages(languages){this.#savedLanguages=languages;}
		get savedLanguages(){return this.#savedLanguages;}
	}
	const preference=Pref.getInstance();
	class Content{
		static #regexp=/^(.*) ?(?:\(([A-Z][a-z]+(?:-(?:[A-Z]{2}))?(?: ?[A-Z][a-z]+)?) Dub\)?)$/;
		static #regexp_for_english_dub_special_case=/^(.*) ?(?:\(Dub\)?)$/;
		static #regexp_for_cr_anime_awards=/^(?!.*Japanese)(.*) (?:\(([A-Z][a-z]+(?:-(?:[A-Z]{2}))?) Audio\)?)$/;
		static #regexp_for_cr_anime_awards_english_dub=/^(The \d{4} Crunchyroll Anime Awards)$/;
		static #id_prefix="cr-rs-content-";
		constructor(content,index){
			this.element=content;
			this.contentIndex=index;
			this.#parseContent(content);
		}
		#parseContent(content){
			const releaseArticle=content.querySelector("article.js-release");
			if(!releaseArticle)return;
			const{slug,episodeNum}=releaseArticle.dataset;
			this.showTitle=slug;
			this.episodesAvailable=episodeNum;
			this.isPremiere=!!content.querySelector(".premiere-flag");
			this.inQueue=!!content.querySelector(".queue-flag.queued");
			this.dateTime=new Date(content.querySelector("time.available-time")?.dateTime);
			const seasonCite=content.querySelector("h1.season-name cite");
			this.seasonTitle=seasonCite?seasonCite.textContent:"";
			this.isDub=false;
			let match=this.seasonTitle.match(Content.#regexp);
			if(match){
				this.isDub=true;
				this.dubLanguage=match[2].replace(" ","-");
				this.seasonTitle=match[1];
			}else if(match=this.seasonTitle.match(Content.#regexp_for_english_dub_special_case)){
				this.isDub=true;
				this.dubLanguage="English";
				this.seasonTitle=match[1];
			}else if(match=this.seasonTitle.match(Content.#regexp_for_cr_anime_awards)){
				this.isDub=true;
				this.dubLanguage=match[2];
				this.seasonTitle=match[1];
			}else if(match=this.seasonTitle.match(Content.#regexp_for_cr_anime_awards_english_dub)){
				this.isDub=true;
				this.dubLanguage="English";
				this.seasonTitle=match[1];
				this.forceShowInSubOnlyAlso=true;
			}
			const progress=content.querySelector("progress");
			if(progress&&progress.value>0){
				this.createProgressBar(releaseArticle,progress.value);
			}
			this.id=`${Content.#id_prefix}${slug}-${episodeNum}-${this.isDub?this.dubLanguage.toLowerCase():'sub'}-${this.contentIndex}`;
			content.id=this.id;
			content.classList.add(this.isDub?`cr-rs-${this.dubLanguage.toLowerCase()}`:"cr-rs-no-dub");
		}
		createProgressBar(elementToAttachTo,progressAmount){
				const progressElem=document.createElement("progress");
				progressElem.classList.add(CRRS_CLASS,"cr-rs-progress-on-closed");
				progressElem.value=progressAmount;
				progressElem.max=100;
				elementToAttachTo.append(progressElem);
		}
		hide(){this.element.classList.add("cr-rs-hide");}
		show(){this.element.classList.remove("cr-rs-hide");}
	}
	class Day{
		constructor(dayElement,showHiddenCount){
			this.element=dayElement;
			const dateElem=dayElement.querySelector(".specific-date");
			this.date=new Date(dateElem.querySelector("time").dateTime);
			if(showHiddenCount){
					this.hiddenCountElement=this.createHiddenCount(dateElem.parentNode);
			}
			this.contentList=[...dayElement.querySelectorAll("li")].map((li,i) => new Content(li,i));
			this.dubsList=this.contentList.filter(c => c.isDub);
			this.subsList=this.contentList.filter(c => !c.isDub);
			this.inQueueList=this.contentList.filter(c => c.inQueue);
			this.premiereList=this.contentList.filter(c => c.isPremiere);
		}
		createHiddenCount(elementToAttachTo){
				const hiddenCount=document.createElement("div");
				hiddenCount.classList.add(CRRS_CLASS,CRRS_HIDDEN_COUNT_CLASS_NAME);
				hiddenCount.textContent="0 Hidden";
				elementToAttachTo.append(hiddenCount);
				return hiddenCount;
		}
		applyFilter(filterState){
			let hiddenContent=new Set();
			if(filterState.hideAllSubs)this.subsList.forEach(c=>hiddenContent.add(c));
			if(filterState.hideAllDubs){
				this.dubsList.forEach(c=>{
						if(!c.forceShowInSubOnlyAlso)hiddenContent.add(c);
				});
			}else if(filterState.dubsShown.length>0){
				const isOtherAllowed=filterState.dubsShown.includes("others");
				const knownDubsLangs=ALL_DUB_LANGUAGES.map(x=>x.toLowerCase());
				this.dubsList.forEach(c=>{
					const dubLangLower=c.dubLanguage.toLowerCase();
					if(!filterState.dubsShown.includes(dubLangLower)){
							if(!isOtherAllowed||knownDubsLangs.includes(dubLangLower)){
									hiddenContent.add(c);
							}
					}
				});
			}
			if(filterState.hideInQueue)this.inQueueList.forEach(c=>hiddenContent.add(c));
			if(filterState.hidePremiere)this.premiereList.forEach(c=>hiddenContent.add(c));
			let shownContent=this.contentList.filter(c=>!hiddenContent.has(c));
			if(filterState.showOnlyInQueue&&filterState.showOnlyPremiere){
				shownContent=shownContent.filter(c=>c.inQueue||c.isPremiere);
			}else if(filterState.showOnlyInQueue){
				shownContent=shownContent.filter(c=>c.inQueue);
			}else if(filterState.showOnlyPremiere){
				shownContent=shownContent.filter(c=>c.isPremiere);
			}
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
			this.days=[...document.querySelectorAll(".day")].map(d=>new Day(d,showHiddenCount));
		}
		applyFilter(filterState){
			this.days.forEach(day=>day.applyFilter(filterState));
		}
	}
	class Filter{
		constructor(week,savedLanguages){
			this.week=week;
			this.savedLanguages=savedLanguages;
			this.state=this.defaultState();
		}
		defaultState(){
			return{
				hideAllSubs:false,
				hideAllDubs:false,
				dubsShown:[],
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
								dubsShown:savedJson.dubsShown||[],
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
				showInQueue:!this.state.hideInQueue,
				showOnlyInQueue:this.state.showOnlyInQueue,
				showPremiere:!this.state.hidePremiere,
				showOnlyPremiere:this.state.showOnlyPremiere,
			};
		}
		apply(){
			this.week.applyFilter(this.state);
		}
		updateDubFilter(mode,list){
				this.state.hideAllSubs=(mode==='only');
				this.state.hideAllDubs=(mode==='hide');
				this.state.dubsShown=(mode==='hide')?[]:list;
				this.apply();
		}
		updateQueueFilter(mode){
				this.state.hideInQueue=(mode==='hide');
				this.state.showOnlyInQueue=(mode==='only');
				this.apply();
		}
		updatePremiereFilter(mode){
				this.state.hidePremiere=(mode==='hide');
				this.state.showOnlyPremiere=(mode==='only');
				this.apply();
		}
	}
	function createUI(elementToAttachTo,savedLanguages){
		const menu=document.createElement("div");
		menu.id=CRRS_FILTER_MENU_DIV_ID;
		menu.append(createRadioGroup("Dubbed:","dubbed-toggle",CRRS_FILTER_MENU_DUBS_RADIO_GROUP_NAME,handleDubbedRadioGroup));
		menu.append(createDubPicker(savedLanguages));
		menu.append(createVerticalDivider());
		menu.append(createRadioGroup("In Queue:","in-queue-toggle",CRRS_FILTER_MENU_QUEUE_RADIO_GROUP_NAME,handleQueueRadioGroup));
		menu.append(createVerticalDivider());
		menu.append(createRadioGroup("Premiere:","premier-toggle",CRRS_FILTER_MENU_PERMIERE_RADIO_GROUP_NAME,handlePremiereRadioGroup));
		menu.append(createVerticalDivider());
		menu.append(createActionButtons());
		elementToAttachTo.prepend(menu);
		return menu;
	}
	function createRadioGroup(groupText,idPrefix,name,eventHandler){
		const group=document.createElement("div");
		group.className="cr-rs-filter-group";
		const label=document.createElement("span");
		label.className="group-label";
		label.textContent=groupText;
		group.append(label);
		["Only","Show","Hide"].forEach((value,index)=>{
			const input=document.createElement("input");
			const label=document.createElement("label");
			const id=`cr-rs-filter-menu-${idPrefix}-${value.toLowerCase()}`;
			input.type="radio";
			input.id=id;
			input.name=name;
			input.value=value.toLowerCase();
			input.checked=(index===1);
			input.addEventListener("change",eventHandler);
			label.htmlFor=id;
			label.textContent=value;
			group.append(input,label);
		});
		return group;
	}
	function createDubPicker(savedLanguages){
		const picker=document.createElement("div");
		picker.id=CRRS_FILTER_MENU_PICK_DUBS_DIV_ID;
		picker.className="cr-rs-filter-group";
		const languages=(savedLanguages&&savedLanguages.length>0)?savedLanguages:DEFAULT_DUB_LANGUAGES;
		languages.push("Others");
		languages.forEach(lang=>{
			const input=document.createElement("input");
			const label=document.createElement("label");
			const id=`${CRRS_FILTER_MENU_PICK_DUBS_INPUT_ID_PREFIX}${lang.toLowerCase()}`;
			input.type="checkbox";
			input.id=id;
			input.dataset.lang=lang.toLowerCase();
			input.checked=true;
			input.addEventListener("change",handleDubPickerCheckbox);
			label.htmlFor=id;
			label.textContent=lang;
			picker.append(input,label);
		});
		return picker;
	}
	function createActionButtons(){
			const group=document.createElement("div");
			group.className="cr-rs-filter-group";
			const lockLabel=document.createElement("label");
			const lockCheckbox=document.createElement("input");
			lockCheckbox.type="checkbox";
			lockCheckbox.id=CRRS_FILTER_MENU_LOCK_BTN_ID;
			lockCheckbox.title="Save filter settings for future visits";
			lockCheckbox.addEventListener("change",handelLockBtn);
			lockLabel.htmlFor=CRRS_FILTER_MENU_LOCK_BTN_ID;
			lockLabel.textContent="Lock";
			lockLabel.style.cursor="pointer";
			const resetBtn=document.createElement("button");
			resetBtn.textContent="Reset";
			resetBtn.title="Reset Filters";
			resetBtn.className="cr-rs-reset-button";
			resetBtn.addEventListener("click",handelResetBtn);
			group.append(lockCheckbox,lockLabel,resetBtn);
			return group;
	}
	function createVerticalDivider(){
			const divider=document.createElement("div");
			divider.className="cr-rs-vertical-divider";
			return divider;
	}
	function getDubPickerLangs(){
			return[...document.querySelectorAll(`#${CRRS_FILTER_MENU_PICK_DUBS_DIV_ID} input:checked`)].map(cb=>cb.dataset.lang);
	}
	function handleDubbedRadioGroup(event){
			preference.crrsFilter.updateDubFilter(event.target.value,getDubPickerLangs());
	}
	function handleDubPickerCheckbox(){
			const mode=document.querySelector(`input[name="${CRRS_FILTER_MENU_DUBS_RADIO_GROUP_NAME}"]:checked`).value;
			preference.crrsFilter.updateDubFilter(mode,getDubPickerLangs());
	}
	function handleQueueRadioGroup(event){
			preference.crrsFilter.updateQueueFilter(event.target.value);
	}
	function handlePremiereRadioGroup(event){
			preference.crrsFilter.updatePremiereFilter(event.target.value);
	}
	function handelLockBtn(event){
			const isLocked=event.target.checked;
			if(isLocked){
					saveFilter(preference.crrsFilter.createJson());
			}else{
					clearSavedFilter();
			}
			lockFilters(isLocked);
	}
	function handelResetBtn(){
			const lockCheckbox=document.getElementById(CRRS_FILTER_MENU_LOCK_BTN_ID);
			if(lockCheckbox){
					lockCheckbox.checked=false;
			}
			document.querySelectorAll('input[type="radio"]').forEach(radio=>{
					if(radio.value==='show')radio.checked=true;
			});
			document.querySelectorAll(`input[type="checkbox"]:not(#${CRRS_FILTER_MENU_LOCK_BTN_ID})`).forEach(cb=>cb.checked=true);
			clearSavedFilter();
			preference.crrsFilter.reset();
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
			const dubPickers=document.querySelectorAll(`#${CRRS_FILTER_MENU_PICK_DUBS_DIV_ID} input`);
			dubPickers.forEach(picker=>{
					picker.checked=savedFilter.dubsShown.includes(picker.dataset.lang);
			});
			const lockCheckbox=document.getElementById(CRRS_FILTER_MENU_LOCK_BTN_ID);
			if(lockCheckbox){
					lockCheckbox.checked=true;
			}
	}
	const CRRS_JSON_VERSION=2;
	async function saveFilter(filter){
			await GM_setValue("filter",filter);
			await GM_setValue("jsonVersion",CRRS_JSON_VERSION);
	}
	async function restorePreference(){
			let items={
					filter:await GM_getValue("filter",null),
					showFilter:await GM_getValue("showFilter",true),
					reflowHCount:await GM_getValue("reflowHCount",true),
					showHCount:await GM_getValue("showHCount",true),
					savedShownLanguages:await GM_getValue("savedShownLanguages",[]),
					jsonVersion:await GM_getValue("jsonVersion",0)
			};
			if(items.jsonVersion!==CRRS_JSON_VERSION){
					await clearAll();
					return{...items,filter:null,savedShownLanguages:[]};
			}
			return items;
	}
	async function clearSavedFilter(){
			await GM_deleteValue("filter");
	}
	async function clearAll(){
			const keys=await GM_listValues();
			for(const key of keys){
					await GM_deleteValue(key);
			}
	}
	window.addEventListener('load',async()=>{
		const header=document.querySelector("header.simulcast-calendar-header");
		if(!header)return;
		const items=await restorePreference();
		if(items.showFilter){
			createUI(header,items.savedShownLanguages);
		}
		preference.reflowEnabled=items.reflowHCount;
		const week=new Week(items.showHCount);
		preference.crrsFilter=new Filter(week,items.savedShownLanguages);
		if(items.filter){
			preference.crrsFilter.restore(items.filter);
			if(items.showFilter){
				restoreUI(items.filter);
				lockFilters(true);
			}
		}
	});
})();
