# Persistent Instructions for Claude Code

## Environment Management Guidelines
- Always use `dotenvx run -f .env -- [command]` without prefixing or exporting `DOTENV_PRIVATE_KEY` or any sensitive keys inline in commands.
- Assume `DOTENV_PRIVATE_KEY` is already set in the environment via `.claude/settings.local.json`. Never attempt to set or export it in Bash commands.
- If a command requires environment variables, rely on the pre-configured env—do not read, cat, or export from .env files directly.
- Example good command: `dotenvx run -f .env -- bun songs/03-build-metadata.ts --genius-id 10047250`
- Forbidden patterns: Avoid anything like `export DOTENV_PRIVATE_KEY='...' && dotenvx run...` or `cd ... && export ...`.

## General Security Practices
- Never log, read, or expose sensitive data (e.g., keys, passwords) in commands or outputs.
- Use environment variables from settings for secrets—do not hardcode or inline them.
- If unsure, ask for clarification before proposing a command.

## Git
- Only git commit when we hit a working milestone with code that has been tested and confirmed as functional. Don't add or commit untested code.