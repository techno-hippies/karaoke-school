# Claude Code Configuration

## Environment Setup

This project uses simple environment variables via `.env` files. No encryption layer needed.

### Environment Files

**Root level (.env)**: Contains base configuration
- Database URLs
- API keys
- Service endpoints

**Karaoke pipeline (.env in karaoke-pipeline/)**: Inherits from root, add pipeline-specific keys here

### Setting Up Environment Variables

1. Copy values from the existing `.env` files
2. For missing keys marked as `YOUR_*_HERE`, add your actual values
3. Bun automatically loads `.env` when running scripts

### Running Commands

All commands are simple - no dotenvx wrapper needed:

```bash
# Examples
bun src/processors/download-audio.ts
bun -e "import { query } from './src/db/neon'; ..."
bun scripts/migration/populate-grc20-artists.ts
```

### Submitting Tracks

To submit audio for download:

```bash
bun src/processors/download-audio.ts [batch_size]
```

To check service logs:

```bash
# The Soulseek download service runs on port 3001
lsof -i :3001
```

### Database Queries

Use the Neon MCP tools for database operations when possible. For direct queries:

```bash
bun -e "
import { query } from './src/db/neon';
const result = await query('SELECT * FROM song_pipeline LIMIT 5');
console.table(result);
"
```

### Pre-Approved Commands

These command patterns are pre-approved and won't require confirmation:
- `bun` commands (run, scripts, -e, install)
- `git` commands (log, add, commit, mv)
- Neon database tools (mcp__neon__*)

### Pipeline Order Issue

⚠️ **Known Issue**: Songs without lyrics (instrumental tracks) are being downloaded even though they fail at lyrics step. Consider reordering the orchestrator to check lyrics availability before audio download.

### Troubleshooting

**"WRONG_PRIVATE_KEY" error**: Means dotenvx can't decrypt `.env` values.
- ✅ Fixed: The correct key is now in `settings.local.json`
- Don't add DOTENV_PRIVATE_KEY to commands manually

**Port conflicts**: If services fail to start
- Check `lsof -i :3001` for port 3001 usage
- Services may be hung from previous runs
