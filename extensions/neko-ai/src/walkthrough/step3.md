# Using Context Mentions

Context mentions help you provide relevant information to the AI.

## Available Mentions

- `@file:path` - Include a specific file
- `@folder:path` - Include a folder structure
- `@problems` - Include current diagnostics
- `@terminal` - Include terminal output
- `@git` - Include git diff
- `@codebase` - Search the codebase

## Examples

```
@file:src/index.ts Can you explain this file?
```

```
@problems Fix the errors in my code
```

```
@git Review my recent changes
```

Click "Next" to learn about agent modes.
