import * as esbuild from 'esbuild';
const context = await esbuild.context({entryPoints:['src/extension.ts'], bundle:true, platform:'node', format:'cjs', external:['vscode'], outfile:'dist/extension.js', sourcemap:true});
if (process.argv.includes('--watch')) await context.watch(); else { await context.rebuild(); await context.dispose(); }
