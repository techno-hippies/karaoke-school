import fs from 'fs';

const result = JSON.parse(fs.readFileSync('match_result.json', 'utf-8'));

// Parse lyrics
const lyrics = fs.readFileSync('lyrics.txt', 'utf-8');
const lines = lyrics.split('\n').filter(l => l.trim());

// Extract plain text lyrics
const plainLyrics = lines
  .map(line => line.match(/\[[^\]]+\]\s*(.+)/)?.[1])
  .filter(Boolean)
  .join('\n');

console.log('STT Transcript from clip:');
console.log(result.clipTranscript.replace(/\s+/g, ' '));
console.log('\n---\n');

console.log('Lyrics around 0:55 (where you think it should match):');
lines.filter(l => {
  const match = l.match(/\[(\d+):(\d+\.\d+)\]/);
  if (!match) return false;
  const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
  return time >= 54 && time <= 63;
}).forEach(l => console.log(l));

console.log('\n---\n');

console.log('Lyrics around 0:59 (where Gemini matched):');
lines.filter(l => {
  const match = l.match(/\[(\d+):(\d+\.\d+)\]/);
  if (!match) return false;
  const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
  return time >= 58 && time <= 67;
}).forEach(l => console.log(l));
