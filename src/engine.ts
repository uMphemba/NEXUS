import ts from 'typescript';

export type Language = 'javascript' | 'javascriptreact' | 'typescript' | 'typescriptreact' | 'python' | 'csharp';
export interface LineExplanation { line: number; code: string; what: string; why: string; concepts: string[] }
export interface Finding { line: number; start: number; end: number; severity: 'warning' | 'information'; title: string; reason: string; improvement: string; safe: boolean }
export interface FunctionInfo { name: string; parameters: string; returnType: string; start: number; end: number; purpose: string; dependencies: string[]; flow: string[] }
export function findingOverlapsSelection(f:Finding, start:{line:number;character:number}, end:{line:number;character:number}):boolean {
  return (f.line>start.line || (f.line===start.line && f.end>start.character)) && (f.line<end.line || (f.line===end.line && f.start<end.character));
}
export const supported = (language: string): language is Language => ['javascript','javascriptreact','typescript','typescriptreact','python','csharp'].includes(language);
const js = (language: Language) => language.startsWith('javascript') || language.startsWith('typescript');
function source(text: string, language: Language) { return ts.createSourceFile('file.' + (language === 'javascriptreact' ? 'jsx' : language === 'typescriptreact' ? 'tsx' : language.startsWith('javascript') ? 'js' : 'ts'), text, ts.ScriptTarget.Latest, true, language === 'javascriptreact' ? ts.ScriptKind.JSX : language === 'typescriptreact' ? ts.ScriptKind.TSX : language.startsWith('javascript') ? ts.ScriptKind.JS : ts.ScriptKind.TS); }
function describe(line: string): [string,string,string[]] {
  const s = line.trim();
  if (!s) return ['Blank line.','Separates sections of code.',['readability']];
  if (/^(\/\/|#|\/\*|\*)/.test(s)) return ['A comment or documentation line.','Comments provide context for readers.',['comments']];
  if (/^(import\b|from\s+\S+\s+import\b|using\s+\S+)/.test(s)) return ['Imports or references a module or namespace.','Makes external names available to this file.',['modules']];
  if (/\b(return|yield)\b/.test(s)) return ['Contains a return or yield statement.','Passes a value or control back to the caller or iterator.',['functions']];
  if (/\b(if|elif|else|switch|case)\b/.test(s)) return ['Contains a conditional branch.','Selects a path based on a condition.',['conditions']];
  if (/\b(for|while|foreach)\b/.test(s)) return ['Contains a loop.','Repeats work while the loop conditions permit.',['loops']];
  if (/\b(try|catch|except|finally|throw|raise)\b/.test(s)) return ['Contains exception-handling syntax.','Controls how errors are raised or handled.',['exceptions']];
  if (/\b(class|interface|struct)\b/.test(s)) return ['Declares a type or class.','Groups related structure or behavior.',['classes']];
  if (/\b(function|def)\b|=>/.test(s)) return ['Contains a function definition or arrow function.','Defines reusable behavior.',['functions']];
  const declaration = s.match(/\b(const|let|var)\s+([\w$]+)\s*(?:=\s*(.*?))?;?$/);
  if (declaration) { const kind = declaration[1] === 'const' ? 'a binding that cannot be reassigned' : 'a variable binding'; return [`${declaration[1]} declares ${declaration[2]} as ${kind}${declaration[3] ? ` and initializes it with ${declaration[3].replace(/;$/, '')}` : ''}.`, 'Names a value for use in this scope.', ['variables', 'expressions']]; }
  if (/^[\w.]+\s*=/.test(s)) return ['Assigns an expression to a name or property.','Stores a value for subsequent use.',['assignment']];
  if (/^[{}\])(:;,]+$/.test(s)) return ['Syntax delimiting a block or expression.','Defines the structure of the surrounding code.',['syntax']];
  return ['This line contains code; its specific behavior cannot be determined by the available templates.','Interpret it in the context of its surrounding syntax.',['syntax']];
}
// Hide comments and strings while preserving columns and line boundaries for conservative matching.
function maskLines(text: string, language: Language): string[] {
  const lines=text.split(/\r?\n/); let block=false, triple='', verbatim=false;
  return lines.map(line=>{let out='', quote='', escape=false;
    for(let i=0;i<line.length;i++){const c=line[i], next=line[i+1]||'';
      if(triple){if(line.slice(i,i+3)===triple){out+='   ';i+=2;triple='';}else out+=' ';continue;}
      if(block){if(c==='*'&&next==='/'){out+='  ';i++;block=false;}else out+=' ';continue;}
      if(verbatim){if(c==='"'&&next==='"'){out+='  ';i++;}else if(c==='"'){out+=' ';verbatim=false;}else out+=' ';continue;}
      if(quote){out+=' ';if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}
      if((language==='python' && line.slice(i,i+3)==="'''") || line.slice(i,i+3)==='"""'){triple=line.slice(i,i+3);out+='   ';i+=2;continue;}
      if(language==='python'&&c==='#' || language==='csharp'&&c==='/'&&next==='/'){out+=' '.repeat(line.length-i);break;}
      if(language==='csharp'&&c==='/'&&next==='*'){out+='  ';i++;block=true;continue;}
      if(language==='csharp'&&c==='@'&&next==='"'){out+='  ';i++;verbatim=true;continue;}
      if(c==='"'||c==="'"){out+=' ';quote=c;continue;} out+=c;
    }return out;
  });
}
function describeMasked(code:string, masked:string, language:Language): [string,string,string[]] {
  const s=masked.trim();
  if(!s) return code.trim().startsWith(language==='python'?'#':'//') ? ['A comment line.','Comments provide context for readers.',['comments']] : code.trim() ? ['This line contains text whose role is not determined by the available templates.','Interpret it in context.',['syntax']] : ['Blank line.','Separates sections of code.',['readability']];
  if (/^(import\b|from\s+\S+\s+import\b|using\s+\w)/.test(s)) return ['Imports or references a module or namespace.','Makes names available to this file.',['modules']];
  if (/^(?:async\s+)?def\s+\w+\s*\(/.test(s)) return ['Declares a function.','Defines reusable callable behavior.',['functions']];
  if (language==='csharp' && /^(?:(?:public|private|protected|internal|static|async|virtual|override)\s+)*[\w<>\[\]?]+\s+\w+\s*\([^;]*\)\s*(?:\{|$)/.test(s)) return ['Declares a method with a return type and parameters.','Defines callable behavior in its enclosing type.',['functions']];
  if (/^(?:return|yield)\b/.test(s)) return ['Contains a return or yield statement.','Transfers a value or control from this function or iterator.',['functions']];
  if (/^(?:if|elif|else|switch|case)\b/.test(s)) return ['Contains a conditional branch.','Selects a path according to a condition.',['conditions']];
  if (/^(?:for|while|foreach)\b/.test(s)) return ['Contains a loop.','Repeats work according to the loop syntax.',['loops']];
  if (/^(?:try|catch|except|finally|throw|raise)\b/.test(s)) return ['Contains exception-related syntax.','Raises an exception or handles one.',['exceptions']];
  if (/^(?:(?:public|private|internal|protected|abstract|sealed|static)\s+)*(?:class|interface|struct)\s+\w+/.test(s)) return ['Declares a class or type.','Defines a named structure or behavior.',['classes']];
  if (language==='csharp' && /^(?:var|(?:int|string|bool|double|decimal|long|float|char))\s+\w+\s*(?:=|;)/.test(s)) return ['Declares a local variable or field.','Names a value with an explicit or inferred type.',['variables']];
  if (language==='python' && /^(?:async\s+)?with\b/.test(s)) return ['Enters a context manager.','A context manager can set up and clean up a resource around a block.',['patterns']];
  if (/^[\w.]+\s*=(?!=)/.test(s)) return ['Assigns an expression to a name or property.','Stores a value for subsequent use.',['assignment']];
  if (/^[{}\])(:;,]+$/.test(s)) return ['Syntax delimiting a block or expression.','Defines the structure of the surrounding code.',['syntax']];
  return ['This line contains code; its specific behavior cannot be determined by the available templates.','Interpret it in the context of its surrounding syntax.',['syntax']];
}
export function explain(text: string, startLine = 0, language?: Language): LineExplanation[] {
  const lines = text.split(/\r?\n/);
  if (!language) return lines.map((code, i) => { const [what,why,concepts] = describe(code); return {line:startLine+i, code, what, why, concepts}; });
  if (!js(language)) {const masked=maskLines(text,language);return lines.map((code,i)=>{const [what,why,concepts]=describeMasked(code,masked[i],language);return {line:startLine+i,code,what,why,concepts};});}
  const sf = source(text, language);
  const descriptions = new Map<number, [string,string,string[]]>();
  const walk = (node: ts.Node) => {
    let info: [string,string,string[]] | undefined;
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) info=['Imports names from another module.','Makes imported names available in this file.',['modules']];
    else if (ts.isVariableStatement(node)) { const list=node.declarationList; const kind=(list.flags & ts.NodeFlags.Const)?'const':(list.flags & ts.NodeFlags.Let)?'let':'var'; const names=list.declarations.map(d=>d.name.getText(sf)).join(', '); const declaration=list.declarations.length===1?list.declarations[0]:undefined; const init=declaration?.initializer; const arithmetic=init && ts.isBinaryExpression(init) && init.operatorToken.kind===ts.SyntaxKind.AsteriskToken ? ` The initializer multiplies ${init.left.getText(sf)} by ${init.right.getText(sf)}.` : ''; info=[`${kind} declares ${names}${list.declarations.some(d=>d.initializer)?' with an initializer':''}.${arithmetic}`,kind==='const'?'Creates a binding that cannot be reassigned.':'Creates a variable binding for use in its scope.',['variables','expressions']]; }
    else if (ts.isReturnStatement(node)) info=['Returns from the current function'+(node.expression?' with an expression.':'.'),'Passes control back to the caller.',['functions']];
    else if (ts.isIfStatement(node) || ts.isSwitchStatement(node)) info=['Begins a conditional branch.','Selects a path according to an expression.',['conditions']];
    else if (ts.isForStatement(node)||ts.isForInStatement(node)||ts.isForOfStatement(node)||ts.isWhileStatement(node)||ts.isDoStatement(node)) info=['Begins a loop.','Repeats its body according to the loop syntax.',['loops']];
    else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) info=['Declares a function or method.','Defines a callable block of behavior.',['functions']];
    else if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) info=['Declares a class or interface.','Defines a named structure or type.',['classes']];
    else if (ts.isTryStatement(node) || ts.isThrowStatement(node)) info=['Contains exception-related syntax.','Raises an exception or provides a way to handle one.',['exceptions']];
    else if (ts.isExpressionStatement(node)) info=['Evaluates an expression.','The effect depends on the expression and its context.',['expressions']];
    if(info){const line=sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;if(!descriptions.has(line))descriptions.set(line,info);}
    ts.forEachChild(node,walk);
  }; walk(sf);
  return lines.map((code,i)=>{const trimmed=code.trim(); const info=descriptions.get(i) ?? (!trimmed || /^(\/\/|\/\*|\*)/.test(trimmed) || /^[{}\])(:;,]+$/.test(trimmed) ? describe(code) : ['This line contains code; its specific behavior cannot be determined by the available templates.','Interpret it in the context of its surrounding syntax.',['syntax']] as [string,string,string[]]); return {line:startLine+i,code,what:info[0],why:info[1],concepts:info[2]};});
}

export function findFunction(text: string, language: Language, offset: number): FunctionInfo | undefined {
  if (js(language)) {
    const sf = source(text, language); let best: ts.FunctionLikeDeclaration | undefined;
    const visit = (node: ts.Node) => { if (ts.isFunctionLike(node) && 'body' in node && node.body && node.getStart(sf) <= offset && offset <= node.end && (!best || node.end-node.getStart(sf) < best.end-best.getStart(sf))) best = node as ts.FunctionLikeDeclaration; ts.forEachChild(node, visit); }; visit(sf);
    if (!best) return undefined;
    const fn = best as ts.FunctionLikeDeclaration; const named = fn as ts.FunctionLikeDeclaration & { name?: ts.PropertyName }; const name = named.name?.getText(sf) ?? (ts.isVariableDeclaration(fn.parent) ? fn.parent.name.getText(sf) : '(anonymous)');
    const local = new Set<string>(fn.parameters.map(p => p.name.getText(sf))); const refs = new Set<string>(); const flow: string[] = ['Entry'];
    const walk = (node: ts.Node) => { if (node !== fn && ts.isFunctionLike(node)) return; if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) local.add(node.name.text); if (ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !('name' in node.parent && node.parent.name === node)) refs.add(node.text);
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      if (ts.isIfStatement(node)) flow.push(`Line ${line}: condition${node.elseStatement?' (then / else)':''}`); else if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)) flow.push(`Line ${line}: loop`); else if (ts.isReturnStatement(node)) flow.push(`Line ${line}: return`); else if (ts.isExpressionStatement(node)) flow.push(`Line ${line}: statement`); ts.forEachChild(node, walk); }; if (fn.body) walk(fn.body); flow.push('Exit');
    return {name, parameters:fn.parameters.map(p=>p.getText(sf)).join(', ') || 'None', returnType:fn.type?.getText(sf) ?? 'Not explicitly declared', start:sf.getLineAndCharacterOfPosition(fn.getStart(sf)).line, end:sf.getLineAndCharacterOfPosition(fn.end).line, purpose:'Defines a callable block. Its intent cannot be inferred reliably from syntax alone.', dependencies:[...refs].filter(x=>!local.has(x) && x!==name).slice(0,30), flow};
  }
  const lines = text.split(/\r?\n/), masked=maskLines(text,language); const current = text.slice(0,offset).split(/\r?\n/).length-1; let start = -1, end=-1; let match: RegExpMatchArray | null = null;
  for (let candidate=current;candidate>=0;candidate--) { const m = language === 'python' ? masked[candidate].match(/^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/) : masked[candidate].match(/^\s*(?:(?:public|private|protected|internal|static|async|virtual|override)\s+)*([\w<>\[\]?]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:\{|$)/); if(!m)continue;
    let candidateEnd=candidate,valid=true; if(language==='python'){const indent=m[1].length;for(let i=candidate+1;i<lines.length;i++){if(masked[i].trim() && masked[i].match(/^\s*/)![0].length<=indent)break;candidateEnd=i;}}
    else {let depth=0,opened=false;for(let i=candidate;i<lines.length;i++){for(const ch of masked[i]){if(ch==='{'){depth++;opened=true;}else if(ch==='}')depth--;}candidateEnd=i;if(opened&&depth<=0)break;}valid=opened&&depth===0;}
    if(valid && current<=candidateEnd){start=candidate;end=candidateEnd;match=m;break;}
  }
  if (!match) return undefined;
  const flow=['Entry']; for(let i=start+1;i<=end;i++){const s=masked[i].trim(); if(/^(if|elif|else|switch)\b/.test(s)) flow.push(`Line ${i+1}: condition`); else if(/^(for|foreach|while)\b/.test(s)) flow.push(`Line ${i+1}: loop`); else if(/^return\b/.test(s)) flow.push(`Line ${i+1}: return`); else if(s && !/^[{}#]/.test(s)) flow.push(`Line ${i+1}: statement`); } flow.push('Exit');
  const open=masked[start].indexOf('('), close=masked[start].indexOf(')',open+1);
  return {name:match[2], parameters:lines[start].slice(open+1,close).trim() || 'None', returnType:(language==='python'?match[4]:match[1])?.trim() || 'Not explicitly declared',start,end,purpose:'Defines a callable block. Its intent cannot be inferred reliably from syntax alone.',dependencies:[],flow};
}
export function analyze(text: string, language: Language): Finding[] {
  const findings: Finding[]=[];
  if(!js(language)) {
    const lines=maskLines(text,language);
    if(language==='python') lines.forEach((line,i)=>{
      const m=line.match(/^(\s*)except\s*:\s*$/);if(m) findings.push({line:i,start:m[1].length,end:m[1].length+6,severity:'information',title:'Bare except clause',reason:'A bare except also catches system-exiting exceptions such as KeyboardInterrupt and SystemExit.',improvement:'Consider catching specific exception types; changing the clause changes which exceptions are handled.',safe:false});
      const header=/^\s*(?:async\s+)?def\s+\w+\s*\(/.exec(line); if(!header)return;
      const start=header[0].length;let depth=0,segment=start;
      for(let pos=start;pos<line.length;pos++){const ch=line[pos];if(ch===')'&&depth===0 || ch===','&&depth===0){const part=line.slice(segment,pos);const d=/^\s*[a-zA-Z_]\w*\s*(?::[^=]+)?=\s*(\[\s*\]|\{\s*\})\s*$/.exec(part);if(d){const column=segment+part.lastIndexOf(d[1]);findings.push({line:i,start:column,end:column+d[1].length,severity:'information',title:'Mutable default argument',reason:'This list or dictionary is created when the function is defined and reused when the argument is omitted.',improvement:'If sharing is unintended, use a sentinel default and create a new value inside the function.',safe:false});}segment=pos+1;if(ch===')')break;}else if(ch==='('||ch==='['||ch==='{')depth++;else if(ch===')'||ch===']'||ch==='}')depth=Math.max(0,depth-1);}
    });
    if(language==='csharp') {const masked=lines.join('\n');const re=/\bcatch\s*(?:\([^()\n]*\))?\s*\{\s*\}/g;let line=0,lineStart=0;for(const m of masked.matchAll(re)){while(line<lines.length-1 && lineStart+lines[line].length<m.index!){lineStart+=lines[line].length+1;line++;}const start=m.index!-lineStart;findings.push({line,start,end:start+5,severity:'information',title:'Empty catch block',reason:'This catch block contains no executable statements, so a caught exception is not handled here.',improvement:'Consider handling, logging, or rethrowing the exception if appropriate for this context.',safe:false});}}
    return findings;
  }
  const sf=source(text,language);
  const add=(node:ts.Node,title:string,reason:string,improvement:string,severity:Finding['severity']='information')=>{const p=sf.getLineAndCharacterOfPosition(node.getStart(sf)); findings.push({line:p.line,start:p.character,end:p.character+Math.max(1,Math.min(node.getWidth(sf),80)),severity,title,reason,improvement,safe:false});};
  // Text search intentionally over-approximates references, including comments and strings,
  // to avoid reporting imports when a name might be used in documentation or tooling.
  const imports=sf.statements.filter(ts.isImportDeclaration), chunks:string[]=[];let cursor=0;
  for(const declaration of imports){chunks.push(text.slice(cursor,declaration.getStart(sf)));cursor=declaration.end;}chunks.push(text.slice(cursor));const outsideImports=chunks.join('\n');
  const identifiers=new Set<string>();const collect=(node:ts.Node)=>{if(ts.isImportDeclaration(node))return;if(ts.isIdentifier(node))identifiers.add(node.text);ts.forEachChild(node,collect);};collect(sf);
  if(!/\b(?:eval|with)\b/.test(outsideImports) && !identifiers.has('eval')) for(const declaration of imports){const clause=declaration.importClause;if(!clause)continue;const names:ts.Identifier[]=[];if(clause.name)names.push(clause.name);if(clause.namedBindings){if(ts.isNamespaceImport(clause.namedBindings))names.push(clause.namedBindings.name);else for(const specifier of clause.namedBindings.elements)names.push(specifier.name);}for(const name of names)if(!outsideImports.includes(name.text) && !identifiers.has(name.text))add(name,'Possibly unused import',`No occurrence of ${name.text} was found outside import declarations in this file. Dynamic references or incomplete code may not be recognized.`,'Review whether this binding is needed. Preserve the module import if its side effects are required.');}
  const walk=(node:ts.Node, depth:number)=>{let next=depth; if(ts.isIfStatement(node)){if(!(ts.isIfStatement(node.parent) && node.parent.elseStatement===node)) next++; if(next===4 && !(ts.isIfStatement(node.parent) && node.parent.elseStatement===node)) add(node,'Deeply nested conditions','Four nested conditions can make control flow harder to follow.','Consider guard clauses or extracting a focused function.');}
    if(ts.isFunctionLike(node) && 'body' in node && node.body){const a=sf.getLineAndCharacterOfPosition(node.getStart(sf)).line,b=sf.getLineAndCharacterOfPosition(node.end).line; if(b-a+1>80) add(node,'Long function',`This function spans ${b-a+1} lines.`,'Consider extracting cohesive operations into smaller functions.'); next=0;}
    if(ts.isBinaryExpression(node) && (node.operatorToken.kind===ts.SyntaxKind.EqualsEqualsToken || node.operatorToken.kind===ts.SyntaxKind.ExclamationEqualsToken)) add(node.operatorToken,'Loose equality','Implicit type coercion can make comparisons difficult to reason about.','Consider a strict comparison after checking whether coercion is intended.');
    if(ts.isDebuggerStatement(node)) add(node,'Debugger statement','This statement may pause execution when a debugger is attached.','Remove it if the breakpoint is no longer needed.');
    if(ts.isCatchClause(node) && node.block.statements.length===0) add(node,'Empty catch block','This catch block has no executable statements, so a caught exception is not handled here.','Consider handling, logging, or rethrowing the exception if appropriate for this context.');
    ts.forEachChild(node, child=>walk(child,next)); }; walk(sf,0); return findings;
}
