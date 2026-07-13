// ==UserScript==
// @name		Show Password onMouseOver
// @namespace		https://github.com/N3Cr0Cr0W/userscripts
// @description		Show password when mouseover on password input dom object (Don't use this, lol)
// @downloadURL		https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/showPassowrd.user.js
// @updateURL		https://raw.githubusercontent.com/N3Cr0Cr0W/userscripts/master/showPassowrd.user.js
// @author		N3Cr0Cr0W
// @license		MIT
// @match		https://*/*
// @version		0.26.07.13.0
// @run-at		document-idle
// @grant		none
// ==/UserScript==

// WORKAROUND: This document requires TrustedHTML assignment
if(window.trustedTypes&&window.trustedTypes.createPolicy){
	if(!window.trustedTypes.defaultPolicy){
		const passThroughFn=(x)=>x;
		window.trustedTypes.createPolicy('default',{
			createHTML:passThroughFn,
			createScriptURL:passThroughFn,
			createScript:passThroughFn,
		});
	}
}

!function(){
	var passFields=document.querySelectorAll("input[type='password']");
	if(!passFields.length){
		return;
	}
	for(var i=0;i<passFields.length;i++){
		passFields[i].addEventListener("mouseover",function(){
			this.type="text";
		},false);
		passFields[i].addEventListener("mouseout",function(){
			this.type="password";
		},false);
	}
}();
