import * as vscode from 'vscode';
import { analyze, explain, findFunction, supported, findingOverlapsSelection, Finding } from './engine';

const MAX_CHARS = 200_000;
type Result = { title:string; subtitle:string; kind:string; items?:unknown[]; function?:unknown; message?:string; uri?:string; learning?:boolean };
export function activate(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection('NEXUS'); context.subscriptions.push(diagnostics);
  let learning = false; let lastCommand = ''; let generation = 0; let result: Result = {title:'Ready to explore',subtitle:'Local code intelligence',kind:'empty'};
  const provider = new class implements vscode.WebviewViewProvider {
    view?: vscode.WebviewView;
    resolveWebviewView(view:vscode.WebviewView) { this.view=view; view.webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]}; const css=view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','sidebar.css')); const script=view.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media','sidebar.js')); const nonce=String(Date.now())+Math.random().toString(36).slice(2); view.webview.html=`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${view.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${css}"></head><body><div id="app"></div><script nonce="${nonce}" src="${script}"></script></body></html>`; view.webview.onDidReceiveMessage(async msg=>{ if(msg.command==='ready'){this.send();} else if(msg.command==='navigate' && typeof msg.line==='number' && typeof msg.uri==='string'){try {const doc=await vscode.workspace.openTextDocument(vscode.Uri.parse(msg.uri)); const editor=await vscode.window.showTextDocument(doc,{preview:true}); const line=Math.max(0,Math.min(msg.line,doc.lineCount-1)); editor.selection=new vscode.Selection(line,0,line,0); editor.revealRange(new vscode.Range(line,0,line,0),vscode.TextEditorRevealType.InCenter);}catch{vscode.window.showErrorMessage('NEXUS could not open the source file.');}} else if(typeof msg.command==='string' && ['explainSelection','explainFile','explainFunction','analyze','suggestions','flow','learning','clear','refresh'].includes(msg.command)) await vscode.commands.executeCommand('nexus.'+msg.command); }); }
    send(){this.view?.webview.postMessage({...result,learning});}
  };
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('nexus.sidebar',provider));
  const show=(r:Result)=>{result=r;provider.send();};
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event=>{if(!event.contentChanges.length)return;diagnostics.delete(event.document.uri);if(result.uri===event.document.uri.toString()){generation++;show({title:'Results out of date',subtitle:'The source changed. Refresh to analyze the current content.',kind:'empty'});}}),vscode.workspace.onDidCloseTextDocument(doc=>{diagnostics.delete(doc.uri);if(result.uri===doc.uri.toString()){generation++;show({title:'Source closed',subtitle:'Open a source file to continue.',kind:'empty'});}}));
  async function run(action:string) {
    if(action==='clear'){generation++;diagnostics.clear();lastCommand='';show({title:'Results cleared',subtitle:'Choose an action to begin',kind:'empty'});return;}
    if(action==='learning'){learning=!learning;provider.send();return;}
    if(action==='refresh'){if(!lastCommand){vscode.window.showInformationMessage('NEXUS: Run an analysis first.');return;} action=lastCommand;}
    const request=++generation;
    const editor=vscode.window.activeTextEditor; if(!editor){show({title:'No active editor',subtitle:'Open a supported source file to begin.',kind:'error'});return;}
    const doc=editor.document; if(!supported(doc.languageId)){show({title:'Language not supported',subtitle:`${doc.languageId} is not supported. Use JavaScript, TypeScript, Python or C#.`,kind:'error'});return;}
    const selection=editor.selection; if(action==='explainSelection' && selection.isEmpty){show({title:'Select code first',subtitle:'Highlight code in the editor, then try again.',kind:'error'});return;}
    const text=doc.getText(); if(text.length>MAX_CHARS){show({title:'File is too large',subtitle:'NEXUS currently analyzes files up to 200,000 characters.',kind:'error'});return;}
    lastCommand=action; const uri=doc.uri.toString(), version=doc.version; show({title:'Analyzing',subtitle:'Inspecting the current file locally…',kind:'loading',uri});
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    if(request!==generation || doc.isClosed || doc.version!==version)return;
    try {
      if(action==='explainSelection'||action==='explainFile') {const range=action==='explainSelection'?selection:undefined; let content=range?doc.getText(range):text; if(range && range.end.character===0 && range.end.line>range.start.line) content=content.replace(/\r?\n$/,''); show({title:range?'Selected code':'Current file',subtitle:`${doc.fileName.split(/[\\/]/).pop()} · ${doc.languageId}`,kind:'explanation',items:explain(content,range?.start.line??0,doc.languageId),uri});}
      else if(action==='explainFunction'||action==='flow') {const fn=findFunction(text,doc.languageId,doc.offsetAt(selection.active)); if(!fn){show({title:'Function not found',subtitle:'Place the cursor inside a supported function and try again.',kind:'error'});return;} show({title:action==='flow'?'Logic flow':'Function overview',subtitle:`${fn.name} · lines ${fn.start+1}–${fn.end+1}`,kind:action==='flow'?'flow':'function',function:fn,uri});}
      else {let findings=analyze(text,doc.languageId); const existing=vscode.languages.getDiagnostics(doc.uri).filter(d=>d.source!=='NEXUS'); const duplicatePatterns:Record<string,RegExp>={'Loose equality':/equality|eqeqeq/i,'Deeply nested conditions':/nest/i,'Long function':/long|length/i,'Bare except clause':/bare.except|bare-except|E722/i,'Empty catch block':/empty.catch|empty block|no-empty/i,'Mutable default argument':/mutable.argument|mutable.default|B006|W0102/i,'Debugger statement':/debugger|no-debugger/i,'Possibly unused import':/unused|never read|never used|6133|6192|6196/i}; findings=findings.filter(f=>!existing.some(d=>d.range.start.line===f.line && duplicatePatterns[f.title]?.test(`${typeof d.code==='object'?d.code.value:d.code ?? ''} ${d.message}`)));
        const selected=action==='suggestions'&&!selection.isEmpty; if(selected) findings=findings.filter(f=>findingOverlapsSelection(f,selection.start,selection.end));
        diagnostics.set(doc.uri,findings.map((f:Finding)=>{const d=new vscode.Diagnostic(new vscode.Range(f.line,f.start,f.line,Math.min(f.end,doc.lineAt(f.line).text.length)),`${f.title}: ${f.reason} ${f.improvement}`,f.severity==='warning'?vscode.DiagnosticSeverity.Warning:vscode.DiagnosticSeverity.Information);d.source='NEXUS';return d;}));
        const note=selected?'Showing findings within the selection.':'Only implemented rules are checked; coverage varies by language.';
        show({title:'Code suggestions',subtitle:note,kind:'suggestions',items:findings,uri}); }
    }catch(error){show({title:'Analysis failed',subtitle:error instanceof Error?error.message:'Unexpected error',kind:'error'});}
  }
  for(const action of ['explainSelection','explainFile','explainFunction','analyze','suggestions','flow','learning','clear','refresh']) context.subscriptions.push(vscode.commands.registerCommand('nexus.'+action,async()=>{await run(action);await vscode.commands.executeCommand('nexus.sidebar.focus');}));
}
export function deactivate() {}
