// ==UserScript==
// @name         YouTube Playlist Sorter and Cleaner
// @namespace    https://github.com/N3Cr0Cr0W/userscripts
// @version      0.25.9.5.0
// @description  Sorts and cleans YouTube playlists with a modern UI and precise video removal
// @downloadURL  https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/YT.playlist.sorter.cleaner.user.js
// @updateURL    https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/YT.playlist.sorter.cleaner.user.js
// @license      MIT
// @author       N3Cr0Cr0W
// @match        https://*.youtube.com/playlist*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function(){
	'use strict';

	const SCRIPT_PREFIX = 'YTPSC';

	// --- CSS STYLES ---
	GM_addStyle(`
		.playlist-actions-container {
			background-color: #282828;
			border: 1px solid #383838;
			border-radius: 12px;
			padding: 16px;
			margin-top: 16px;
			box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
			color: #fff;
		}
		.playlist-actions-container h3 {
			margin-top: 0;
			font-size: 18px;
			font-weight: 500;
			border-bottom: 1px solid #383838;
			padding-bottom: 10px;
			margin-bottom: 15px;
		}
		.action-row {
			display: flex;
			align-items: center;
			margin-bottom: 10px;
		}
		.action-row label {
			margin-right: 10px;
			font-weight: 500;
		}
		.playlist-actions-container button,
		.playlist-actions-container select,
		.playlist-actions-container input {
			background-color: #383838;
			color: #fff;
			border: 1px solid #585858;
			border-radius: 8px;
			padding: 8px 12px;
			font-size: 14px;
			cursor: pointer;
			transition: background-color 0.2s ease;
		}
		.playlist-actions-container button:hover {
			background-color: #484848;
		}
		.playlist-actions-container button:active {
			background-color: #585858;
		}
		.playlist-actions-container select {
			flex-grow: 1;
		}
	`);

	// --- UTILITY FUNCTIONS ---
	const getPlaylistItems = () => Array.from(document.querySelectorAll('ytd-playlist-video-renderer'));
	const getVideoTitle = (element) => element.querySelector('#video-title').textContent.trim();
	const getChannelName = (element) => element.querySelector('.ytd-channel-name a').textContent.trim();
	const getDuration = (element) => {
		const durationString = element.querySelector('span.ytd-thumbnail-overlay-time-status-renderer').textContent.trim();
		const timeParts = durationString.split(':').map(Number);
		if(timeParts.length === 2){
			return timeParts[0] * 60 + timeParts[1];
		} else if (timeParts.length === 3){
			return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
		}
		return 0;
	};
	const isVideoWatched = (element) => {
		const watchedPercentage = parseInt(GM_getValue(`${SCRIPT_PREFIX}_watchedPercentage`, 75), 10);
		const progressEl = element.querySelector('ytd-thumbnail-overlay-resume-playback-renderer');
		const percentDurationWatched = progressEl?.data?.percentDurationWatched ?? 0;
		return percentDurationWatched >= watchedPercentage;
	};

	const fireMouseEvent = (type, elem, centerX, centerY) => {
		const event = new MouseEvent(type, {
			view: unsafeWindow,
			bubbles: true,
			cancelable: true,
			clientX: centerX,
			clientY: centerY
		});
		elem.dispatchEvent(event);
	};

	const simulateDrag = (elemDrag, elemDrop) => {
		let pos = elemDrag.getBoundingClientRect();
		let center1X = Math.floor((pos.left + pos.right) / 2);
		let center1Y = Math.floor((pos.top + pos.bottom) / 2);
		pos = elemDrop.getBoundingClientRect();
		let center2X = Math.floor((pos.left + pos.right) / 2);
		let center2Y = Math.floor((pos.top + pos.bottom) / 2);

		fireMouseEvent('mousemove', elemDrag, center1X, center1Y);
		fireMouseEvent('mouseenter', elemDrag, center1X, center1Y);
		fireMouseEvent('mouseover', elemDrag, center1X, center1Y);
		fireMouseEvent('mousedown', elemDrag, center1X, center1Y);

		fireMouseEvent('dragstart', elemDrag, center1X, center1Y);
		fireMouseEvent('drag', elemDrag, center1X, center1Y);
		fireMouseEvent('mousemove', elemDrag, center1X, center1Y);
		fireMouseEvent('drag', elemDrag, center2X, center2Y);
		fireMouseEvent('mousemove', elemDrop, center2X, center2Y);

		fireMouseEvent('mouseenter', elemDrop, center2X, center2Y);
		fireMouseEvent('dragenter', elemDrop, center2X, center2Y);
		fireMouseEvent('mouseover', elemDrop, center2X, center2Y);
		fireMouseEvent('dragover', elemDrop, center2X, center2Y);

		fireMouseEvent('drop', elemDrop, center2X, center2Y);
		fireMouseEvent('dragend', elemDrag, center2X, center2Y);
		fireMouseEvent('mouseup', elemDrag, center2X, center2Y);
	};

	// --- CORE LOGIC ---
	async function scrollToBottom(){
		const scrollElement = document.documentElement;
		let lastScrollTop = -1;
		while(scrollElement.scrollTop !== lastScrollTop){
			lastScrollTop = scrollElement.scrollTop;
			scrollElement.scrollTop = scrollElement.scrollHeight;
			await new Promise(resolve => setTimeout(resolve, 500));
		}
	}

	async function performAction(actionFn){
		await scrollToBottom();
		await actionFn();
	}

	async function sortPlaylist(sortOrder) {
		const sortBtn = document.getElementById(`${SCRIPT_PREFIX}-sort-btn`);
		const stopBtn = document.getElementById(`${SCRIPT_PREFIX}-stop-sort-btn`);
		let stopSort = false;

		sortBtn.disabled = true;
		stopBtn.style.display = 'inline-block';
		const originalStopOnclick = stopBtn.onclick;
		stopBtn.onclick = () => { stopSort = true; };

		const delay = parseInt(document.getElementById(`${SCRIPT_PREFIX}-delay`).value, 10);
		const getVideoURL = (element) => element.querySelector('a#thumbnail').href;

		try {
			let isSorted = false;
			while (!isSorted && !stopSort) {
				let playlistItems = getPlaylistItems();
				if (playlistItems.length === 0) break;

				const getSortableValue = (item) => {
					switch (sortOrder) {
						case 'title-asc': case 'title-desc': return getVideoTitle(item).toLowerCase();
						case 'channel-asc': case 'channel-desc': return getChannelName(item).toLowerCase();
						case 'duration-asc': case 'duration-desc': return getDuration(item);
						default: return 0;
					}
				};

				let videos = playlistItems.map((item) => ({
					id: getVideoURL(item),
					value: getSortableValue(item),
				}));

				const sortedVideos = [...videos];
				if (sortOrder.endsWith('-asc')) {
					sortedVideos.sort((a, b) => typeof a.value === 'string' ? a.value.localeCompare(b.value) : a.value - b.value);
				} else {
					sortedVideos.sort((a, b) => typeof a.value === 'string' ? b.value.localeCompare(a.value) : b.value - a.value);
				}

				if (videos.every((v, i) => v.id === sortedVideos[i].id)) {
					isSorted = true;
					continue;
				}

				let dragged = false;
				for (let i = 0; i < sortedVideos.length; i++) {
					const currentItemId = getVideoURL(playlistItems[i]);
					const targetItemId = sortedVideos[i].id;

					if (currentItemId !== targetItemId) {
						const itemToMoveElement = playlistItems.find(p => getVideoURL(p) === targetItemId);
						const dropTargetElement = playlistItems[i];

						if (!itemToMoveElement || !dropTargetElement) {
							console.error("Could not find elements for drag/drop");
							stopSort = true;
							break;
						}

						let dragHandle = itemToMoveElement.querySelector('yt-icon#reorder');
						if (!dragHandle) {
							dragHandle = itemToMoveElement.querySelector('#grab-handle');
						}

						if (!dragHandle) {
							console.error('Could not find drag handle for item. Tried yt-icon#reorder and #grab-handle.', itemToMoveElement);
							continue;
						}

						simulateDrag(dragHandle, dropTargetElement);
						dragged = true;
						await new Promise(r => setTimeout(r, delay));
						break;
					}
				}

				if (!dragged) {
					isSorted = true;
				}
			}
		} catch (e) {
			console.error("Error during sort:", e);
		} finally {
			sortBtn.disabled = false;
			stopBtn.style.display = 'none';
			stopBtn.onclick = originalStopOnclick;
			if (stopSort) {
				console.log('Sort stopped by user.');
			} else {
				console.log('Sort finished.');
				GM_setValue(`${SCRIPT_PREFIX}_lastSort`, sortOrder);
			}
		}
	}

	async function removeVideo(item, delay){
		const menuButton = item.querySelector('yt-icon-button#button');
		menuButton.click();
		await new Promise(resolve => setTimeout(resolve, delay));
		const menuPopup = document.querySelector('ytd-menu-popup-renderer');
		if(menuPopup){
			const menuItems = menuPopup.querySelectorAll('ytd-menu-service-item-renderer');
			for(const menuItem of menuItems){
				if(menuItem.textContent.includes('Remove from')){
					menuItem.click();
					await new Promise(resolve => setTimeout(resolve, delay));
					break;
				}
			}
		}
	}

	async function removeWatchedVideos(){
		const delay = parseInt(document.getElementById(`${SCRIPT_PREFIX}-delay`).value, 10);
		const playlistItems = getPlaylistItems();
		for(const item of playlistItems){
			if(isVideoWatched(item)){
				await removeVideo(item, delay);
			}
		}
	}

	async function removeDuplicateVideos(){
		const delay = parseInt(document.getElementById(`${SCRIPT_PREFIX}-delay`).value, 10);
		const duplicates = new Set();
		const playlistItems = getPlaylistItems();
		for(const item of playlistItems){
			const videoTitle = getVideoTitle(item);
			if(duplicates.has(videoTitle)){
				await removeVideo(item, delay);
			}else{
				duplicates.add(videoTitle);
			}
		}
	}

	// --- UI AND INITIALIZATION ---
	function init() {
		const controlsContainer = document.createElement("div");
		controlsContainer.className = "playlist-actions-container";

		const lastSort = GM_getValue(`${SCRIPT_PREFIX}_lastSort`, "title-asc");
		const lastDelay = GM_getValue(`${SCRIPT_PREFIX}_delay`, 500);
		const watchedPercentage = GM_getValue(
			`${SCRIPT_PREFIX}_watchedPercentage`,
			75
		);

		// Title
		const title = document.createElement("h3");
		title.textContent = "Playlist Sorter & Cleaner";
		controlsContainer.appendChild(title);

		// --- Sort row ---
		const sortRow = document.createElement("div");
		sortRow.className = "action-row";

		const sortLabel = document.createElement("label");
		sortLabel.setAttribute("for", `${SCRIPT_PREFIX}-sort-order`);
		sortLabel.textContent = "Sort by:";
		sortRow.appendChild(sortLabel);

		const sortSelect = document.createElement("select");
		sortSelect.id = `${SCRIPT_PREFIX}-sort-order`;
		[
			["title-asc", "Title (A-Z)"],
			["title-desc", "Title (Z-A)"],
			["channel-asc", "Channel (A-Z)"],
			["channel-desc", "Channel (Z-A)"],
			["duration-asc", "Duration (Shortest)"],
			["duration-desc", "Duration (Longest)"],
		].forEach(([val, text]) => {
			const opt = document.createElement("option");
			opt.value = val;
			opt.textContent = text;
			sortSelect.appendChild(opt);
		});
		sortRow.appendChild(sortSelect);

		const sortBtn = document.createElement("button");
		sortBtn.id = `${SCRIPT_PREFIX}-sort-btn`;
		sortBtn.textContent = "Sort";
		sortRow.appendChild(sortBtn);

		const stopBtn = document.createElement("button");
		stopBtn.id = `${SCRIPT_PREFIX}-stop-sort-btn`;
		stopBtn.style.display = "none";
		stopBtn.style.marginLeft = "8px";
		stopBtn.textContent = "Stop";
		sortRow.appendChild(stopBtn);

		controlsContainer.appendChild(sortRow);

		// --- Remove row ---
		const removeRow = document.createElement("div");
		removeRow.className = "action-row";

		const removeWatchedBtn = document.createElement("button");
		removeWatchedBtn.id = `${SCRIPT_PREFIX}-remove-watched-btn`;
		removeWatchedBtn.textContent = "Remove Watched";
		removeRow.appendChild(removeWatchedBtn);

		const removeDupBtn = document.createElement("button");
		removeDupBtn.id = `${SCRIPT_PREFIX}-remove-duplicates-btn`;
		removeDupBtn.textContent = "Remove Duplicates";
		removeRow.appendChild(removeDupBtn);

		controlsContainer.appendChild(removeRow);

		// --- Settings row ---
		const settingsRow = document.createElement("div");
		settingsRow.className = "action-row";

		const delayLabel = document.createElement("label");
		delayLabel.setAttribute("for", `${SCRIPT_PREFIX}-delay`);
		delayLabel.textContent = "Delay (ms):";
		settingsRow.appendChild(delayLabel);

		const delayInput = document.createElement("input");
		delayInput.type = "number";
		delayInput.id = `${SCRIPT_PREFIX}-delay`;
		delayInput.value = lastDelay;
		delayInput.style.width = "80px";
		settingsRow.appendChild(delayInput);

		const watchedLabel = document.createElement("label");
		watchedLabel.setAttribute("for", `${SCRIPT_PREFIX}-watched-percentage`);
		watchedLabel.textContent = "Watched %:";
		settingsRow.appendChild(watchedLabel);

		const watchedInput = document.createElement("input");
		watchedInput.type = "number";
		watchedInput.id = `${SCRIPT_PREFIX}-watched-percentage`;
		watchedInput.value = watchedPercentage;
		watchedInput.style.width = "60px";
		watchedInput.min = "1";
		watchedInput.max = "100";
		settingsRow.appendChild(watchedInput);

		controlsContainer.appendChild(settingsRow);

		// --- Attach to page ---
		let targetContainer =
			document.querySelector(".thumbnail-and-metadata-wrapper") ||
			document.querySelector(".yt-page-header-view-model__page-header-content");
		if (targetContainer) {
			targetContainer.appendChild(controlsContainer);

			// Restore last sort
			sortSelect.value = lastSort;

			// Event listeners
			sortBtn.addEventListener("click", () =>
									 performAction(() => sortPlaylist(sortSelect.value))
									);
			removeWatchedBtn.addEventListener("click", () =>
											  performAction(removeWatchedVideos)
											 );
			removeDupBtn.addEventListener("click", () =>
										  performAction(removeDuplicateVideos)
										 );
			delayInput.addEventListener("change", (e) => {
				GM_setValue(`${SCRIPT_PREFIX}_delay`, e.target.value);
			});
			watchedInput.addEventListener("change", (e) => {
				GM_setValue(`${SCRIPT_PREFIX}_watchedPercentage`, e.target.value);
			});
		}
	}

	// --- RUN ---
	const observer = new MutationObserver((mutations, obs) => {
		if(document.querySelector('ytd-playlist-video-list-renderer')){
			init();
			obs.disconnect();
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true
	});
})();
