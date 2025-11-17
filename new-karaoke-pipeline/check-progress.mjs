import { query } from './src/db/connection.js';

const pending = await query("SELECT COUNT(*) FROM enrichment_tasks WHERE task_type = 'genius_songs' AND status = 'pending'");
const completed = await query("SELECT COUNT(*) FROM enrichment_tasks WHERE task_type = 'genius_songs' AND status = 'completed'");

const total = Number(pending[0].count) + Number(completed[0].count);
const progress = total > 0 ? Math.round((Number(completed[0].count) / total) * 100) : 0;

console.log(`\n📊 Genius Songs Progress:`);
console.log(`   Pending:   ${pending[0].count}`);
console.log(`   Completed: ${completed[0].count}`);
console.log(`   Progress:  ${progress}%\n`);
