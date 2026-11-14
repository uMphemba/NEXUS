# Changelog

## 0.1.0

- Initial local code explanations, function outlines, flow outlines and JavaScript/TypeScript suggestions.
- Improve Python and C# recognition around strings, comments, and nested Python functions; recognize loose inequality in JavaScript and TypeScript.
- Add advisory rules for Python bare except clauses and empty C# catch blocks. Invalidate stale results after edits, respect selection boundaries and open the sidebar when commands run.
- Add Python mutable-default and JavaScript/TypeScript debugger and empty-catch suggestions, along with additional syntax explanations.
- Report potentially unused JavaScript/TypeScript import bindings conservatively, without changing code or assuming imports have no side effects.
