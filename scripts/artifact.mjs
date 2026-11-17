// Turns dist/index.html into dist/artifact.html for publishing as a claude.ai artifact.
// The artifact host wraps the page in its own <!doctype>/<html>/<head>/<body> skeleton
// (with charset + viewport meta), so those are stripped here; <title>, <style> and the
// inlined <script> are kept, and the title + viewport-fit tag go first.
import { readFileSync, writeFileSync } from 'node:fs';

let s = readFileSync('dist/index.html', 'utf8');
const title = s.match(/<title>.*?<\/title>/s)?.[0] ?? '<title>Sigilfall Prototype</title>';
s = s
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?html[^>]*>/gi, '')
  .replace(/<\/?head>/gi, '')
  .replace(/<\/?body[^>]*>/gi, '')
  .replace(/<meta charset[^>]*>/gi, '')
  .replace(/<meta name="viewport"[^>]*>/gi, '')
  .replace(title, '');
s = `${title}\n<meta name="claude:viewport-fit-sides" content="cover">\n${s.trim()}\n`;
writeFileSync('dist/artifact.html', s);
console.log(`dist/artifact.html: ${(s.length / 1024).toFixed(1)} kB`);
