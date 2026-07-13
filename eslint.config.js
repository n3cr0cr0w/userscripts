import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import globals from "globals";

const densePlugin = {
	rules:{
		"no-space-around-operators":{
			meta:{
				type:"layout",
				fixable:"whitespace",
				schema:[]
			},
			create(context){
				const sourceCode = context.sourceCode;
				const text = sourceCode.text;
				const reportOperatorSpacing = (leftToken,operatorToken,rightToken,operatorLabel)=>{
					if (!leftToken || !operatorToken || !rightToken){
						return;
					}
					const before = text.slice(leftToken.range[1],operatorToken.range[0]);
					const after = text.slice(operatorToken.range[1],rightToken.range[0]);
					const hasFixableBefore = /^[\t ]+$/.test(before);
					const hasFixableAfter = /^[\t ]+$/.test(after);
					if (!hasFixableBefore && !hasFixableAfter){
						return;
					}

					context.report({
						node:operatorToken,
						message:"Unexpected spaces around operator '{{op}}'.",
						data:{op:operatorLabel || operatorToken.value},
						fix(fixer){
							const fixes = [];
							if (hasFixableBefore){
								fixes.push(fixer.replaceTextRange([leftToken.range[1],operatorToken.range[0]],""));
							}
							if (hasFixableAfter){
								fixes.push(fixer.replaceTextRange([operatorToken.range[1],rightToken.range[0]],""));
							}
							return fixes;
						}
					});
				};

				const checkBinaryLikeNode = (node)=>{
					if (/^[a-z]+$/i.test(node.operator)){
						return;
					}
					const leftToken = sourceCode.getLastToken(node.left);
					const operatorToken = sourceCode.getTokenAfter(leftToken);
					if (!operatorToken || operatorToken.value !== node.operator){
						return;
					}
					const rightToken = sourceCode.getFirstToken(node.right);
					if (!rightToken){
						return;
					}
					// Keep spacing in ambiguous cases like a + +b / a - -b.
					if ((node.operator === "+" || node.operator === "-") && (rightToken.value === "+" || rightToken.value === "-")){
						return;
					}
					const immediateRightToken = sourceCode.getTokenAfter(operatorToken);
					reportOperatorSpacing(leftToken,operatorToken,immediateRightToken || rightToken,node.operator);
				};

				const checkAssignmentNode = (node)=>{
					const leftToken = sourceCode.getLastToken(node.left);
					const operatorToken = sourceCode.getTokenAfter(leftToken);
					if (!operatorToken || operatorToken.value !== node.operator){
						return;
					}
					const rightToken = sourceCode.getTokenAfter(operatorToken) || sourceCode.getFirstToken(node.right);
					reportOperatorSpacing(leftToken,operatorToken,rightToken,node.operator);
				};

				const checkVariableDeclarator = (node)=>{
					if (!node.init){
						return;
					}
					const idToken = sourceCode.getLastToken(node.id);
					const operatorToken = sourceCode.getTokenAfter(idToken);
					if (!operatorToken || operatorToken.value !== "="){
						return;
					}
					const initToken = sourceCode.getTokenAfter(operatorToken) || sourceCode.getFirstToken(node.init);
					reportOperatorSpacing(idToken,operatorToken,initToken,"=");
				};

				const checkAssignmentPattern = (node)=>{
					const leftToken = sourceCode.getLastToken(node.left);
					const operatorToken = sourceCode.getTokenAfter(leftToken);
					if (!operatorToken || operatorToken.value !== "="){
						return;
					}
					const rightToken = sourceCode.getTokenAfter(operatorToken) || sourceCode.getFirstToken(node.right);
					reportOperatorSpacing(leftToken,operatorToken,rightToken,"=");
				};

				return {
					BinaryExpression:checkBinaryLikeNode,
					LogicalExpression:checkBinaryLikeNode,
					AssignmentExpression:checkAssignmentNode,
					VariableDeclarator:checkVariableDeclarator,
					AssignmentPattern:checkAssignmentPattern
				};
			}
		},
		"no-space-after-control-keyword":{
			meta:{
				type:"layout",
				fixable:"whitespace",
				schema:[]
			},
			create(context){
				const sourceCode = context.sourceCode;
				const checkKeywordBeforeBlock = (node,keyword)=>{
					const keywordToken = sourceCode.getFirstToken(node,(token)=>token.value === keyword);
					if (!keywordToken){
						return;
					}
					const nextToken = sourceCode.getTokenAfter(keywordToken);
					if (!nextToken || nextToken.value !== "{"){
						return;
					}
					const between = sourceCode.text.slice(keywordToken.range[1],nextToken.range[0]);
					if (!/^[\t ]+$/.test(between)){
						return;
					}
					context.report({
						node:keywordToken,
						message:"Unexpected space after '{{kw}}'.",
						data:{kw:keyword},
						fix(fixer){
							return fixer.replaceTextRange([keywordToken.range[1],nextToken.range[0]],"");
						}
					});
				};
				const checkStatement = (node,keyword)=>{
					const keywordToken = sourceCode.getFirstToken(node,(token)=>token.value === keyword);
					if (!keywordToken){
						return;
					}
					const nextToken = sourceCode.getTokenAfter(keywordToken);
					if (!nextToken || nextToken.value !== "("){
						return;
					}
					const between = sourceCode.text.slice(keywordToken.range[1],nextToken.range[0]);
					if (!/^[\t ]+$/.test(between)){
						return;
					}
					context.report({
						node:keywordToken,
						message:"Unexpected space after '{{kw}}'.",
						data:{kw:keyword},
						fix(fixer){
							return fixer.replaceTextRange([keywordToken.range[1],nextToken.range[0]],"");
						}
					});
				};

				return {
					IfStatement(node){checkStatement(node,"if");},
					ForStatement(node){checkStatement(node,"for");},
					ForInStatement(node){checkStatement(node,"for");},
					ForOfStatement(node){checkStatement(node,"for");},
					WhileStatement(node){checkStatement(node,"while");},
					DoWhileStatement(node){
						checkKeywordBeforeBlock(node,"do");
						checkStatement(node,"while");
					},
					SwitchStatement(node){checkStatement(node,"switch");},
					CatchClause(node){checkStatement(node,"catch");}
				};
			}
		},
		"no-space-in-ternary":{
			meta:{
				type:"layout",
				fixable:"whitespace",
				schema:[]
			},
			create(context){
				const sourceCode = context.sourceCode;
				const text = sourceCode.text;
				const reportBetween = (leftToken,rightToken,label)=>{
					if (!leftToken || !rightToken){
						return;
					}
					const between = text.slice(leftToken.range[1],rightToken.range[0]);
					if (!/^[\t ]+$/.test(between)){
						return;
					}
					context.report({
						node:rightToken,
						message:"Unexpected spaces around ternary '{{op}}'.",
						data:{op:label},
						fix(fixer){
							return fixer.replaceTextRange([leftToken.range[1],rightToken.range[0]],"");
						}
					});
				};
				return {
					ConditionalExpression(node){
						const testLast = sourceCode.getLastToken(node.test);
						const questionToken = sourceCode.getTokenAfter(testLast);
						if (!questionToken || questionToken.value !== "?"){
							return;
						}
						const consequentFirst = sourceCode.getTokenAfter(questionToken);
						reportBetween(testLast,questionToken,"?");
						reportBetween(questionToken,consequentFirst,"?");

						const consequentLast = sourceCode.getLastToken(node.consequent);
						const colonToken = sourceCode.getTokenAfter(consequentLast);
						if (!colonToken || colonToken.value !== ":"){
							return;
						}
						const alternateFirst = sourceCode.getTokenAfter(colonToken);
						reportBetween(consequentLast,colonToken,":");
						reportBetween(colonToken,alternateFirst,":");
					}
				};
			}
		},
		"no-space-before-inline-return":{
			meta:{
				type:"layout",
				fixable:"whitespace",
				schema:[]
			},
			create(context){
				const sourceCode = context.sourceCode;
				const text = sourceCode.text;
				const compactBefore = new Set([")",":","{",";"]);
				return {
					ReturnStatement(node){
						const returnToken = sourceCode.getFirstToken(node);
						const prevToken = sourceCode.getTokenBefore(returnToken);
						if (!prevToken || !compactBefore.has(prevToken.value)){
							return;
						}
						const between = text.slice(prevToken.range[1],returnToken.range[0]);
						if (!/^[\t ]+$/.test(between)){
							return;
						}
						context.report({
							node:returnToken,
							message:"Unexpected space before inline return.",
							fix(fixer){
								return fixer.replaceTextRange([prevToken.range[1],returnToken.range[0]],"");
							}
						});
					}
				};
			}
		}
	}
};

export default [
	{
		ignores:["node_modules/**"]
	},
	js.configs.recommended,
	{
		files:["*.user.js"],
		languageOptions:{
			ecmaVersion:"latest",
			sourceType:"script",
			globals:{
				...globals.browser,
				unsafeWindow:"readonly",
				GM_log:"readonly",
				GM_setValue:"readonly",
				GM_getValue:"readonly",
				GM_registerMenuCommand:"readonly",
				GM_unregisterMenuCommand:"readonly",
				GM_addStyle:"readonly",
				GM_deleteValue:"readonly",
				GM_listValues:"readonly"
			}
		},
		plugins:{
			"@stylistic":stylistic,
			dense:densePlugin
		},
		rules:{
			indent:["error","tab",{SwitchCase:1}],
			"comma-spacing":["error",{before:false,after:false}],
			"space-in-parens":["error","never"],
			"space-before-function-paren":["error","never"],
			"object-curly-spacing":["error","never"],
			"array-bracket-spacing":["error","never"],
			"computed-property-spacing":["error","never"],
			"space-infix-ops":"off",
			"keyword-spacing":"off",
			"space-before-blocks":["error","never"],
			"block-spacing":["error","never"],
			"arrow-spacing":["error",{before:false,after:false}],
			"semi-spacing":["error",{before:false,after:false}],
			"key-spacing":["error",{beforeColon:false,afterColon:false,mode:"minimum"}],
			"template-curly-spacing":["error","never"],
			"func-call-spacing":["error","never"],
			"dense/no-space-around-operators":"error",
			"dense/no-space-after-control-keyword":"error",
			"dense/no-space-in-ternary":"error",
			"dense/no-space-before-inline-return":"error",
			"no-trailing-spaces":"error",
			"eol-last":["error","always"]
		}
	}
];
