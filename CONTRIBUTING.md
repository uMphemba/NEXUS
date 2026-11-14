# Contributing to NEXUS

NEXUS is an early-stage, local-first VS Code extension. Issues, documentation improvements and pull requests are welcome. Please describe the problem and intended behavior before proposing a substantial change.

## Get started

1. Fork the repository and create a branch for your change.
2. Install Node.js and VS Code, then run `npm ci`.
3. Run `npm run check`, `npm test`, and `npm run build`.
4. Open the folder in VS Code and press F5 to run the Extension Development Host.

## Pull requests

Keep changes focused and explain the user-visible behavior, limitations, and how you tested them. Add focused tests for analysis rules, including examples that should not trigger a finding. Update the README when language coverage or limitations change. The maintainer reviews pull requests before merging.

## Project principles

Analysis must run locally without external AI services, credentials, telemetry, a backend, or a database. Do not scan unrelated files or automatically modify source code. Avoid asserting behavior that the implemented analysis cannot establish, and preserve module side effects when suggesting import changes.

Please do not include private source code, secrets, or credentials in issues or pull requests. Share a small, sanitized example when reporting a problem.
