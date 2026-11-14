# NEXUS

NEXUS is an early-stage local code exploration extension for Visual Studio Code. It provides line explanations, function outlines, a simple syntax-based flow outline and focused static-analysis suggestions without an AI service or API key. Contributions and feedback are welcome; see CONTRIBUTING.md in the source repository.

## Getting started

Open a JavaScript, TypeScript, Python or C# file and select the NEXUS icon in the Activity Bar. Select code and choose **Explain selection**, or place the cursor inside a function and choose **Explain function** or **Logic flow**. Source line links return to the editor. The editor context menu and Command Palette also expose these actions. `Ctrl+Alt+E` (`Cmd+Alt+E` on macOS) explains a selection.

**Analyze file** reports supported findings in the sidebar and Problems panel. **Suggestions** limits results to the selection when one exists. Suggestions are advisory and never automatically change code. Learning mode adds concept labels and a function primer. Refresh repeats the last action using the current editor and selection; Clear removes NEXUS diagnostics and results.

## Language support and limitations

- JavaScript and TypeScript (including JSX/TSX): TypeScript syntax parser for function boundaries, a syntax flow outline, and checks for loose equality or inequality, four nested conditions, functions longer than 80 lines, `debugger` statements, empty catch blocks, and potentially unused import bindings. The import check is deliberately conservative and skips files containing `eval` or `with`.
- Python and C#: conservative pattern-based function boundaries and flow outlines, with basic string and comment masking. Python detects bare `except` clauses and simple list/dictionary literal defaults in single-line function signatures; C# detects empty `catch` blocks. These are advisory, and changing exception handling or defaults can alter behavior. Multiline signatures, interpolation, complex strings, nested constructs and unusual indentation can confuse these patterns.
- JavaScript/TypeScript line explanations use syntax nodes; Python/C# use masked line templates. Both fall back for unrecognized lines and do not infer intent or execute code. Partial selections and multiline constructs may be described only generally. Function dependencies are approximate for JavaScript/TypeScript and not extracted for Python/C#.
- Flow is a linear syntax outline, not a control-flow graph. Branch alternatives, exceptions, nested functions and all execution paths are not fully represented.
- Analysis is limited to the current file and files up to 200,000 characters. Matching diagnostics from other providers are suppressed on a best-effort basis. Results and diagnostics are invalidated when their source changes. No unused-variable, duplicate-code or automatic-fix rules are currently provided. Imported modules may have side effects even if a binding appears unused.

## Privacy

Analysis runs locally. NEXUS does not send code to a server, make background network requests, collect telemetry, or require credentials. It reads the active document and does not scan the workspace. It does not modify source files.

## Development and installation

Requires Node.js and VS Code 1.85 or later.

```sh
npm install
npm run check
npm test
npm run build
```

Open the folder in VS Code and press F5 to launch an Extension Development Host. To build a VSIX, run `npm run package`, then use **Extensions: Install from VSIX...** in VS Code.

## Marketplace preparation

Before publishing, confirm that the `publisher` in `package.json` matches your Marketplace publisher ID, add your actual repository and issue URLs, review the license and add screenshots. Run `npm run package`, inspect the VSIX, and use the official VS Code publishing workflow with your own publisher credentials. This project does not publish automatically.

## Screenshots

Add actual Extension Development Host screenshots to `screenshots/` before release. Capture both dark and light themes.

## License

MIT; see the LICENSE file included with the extension.
