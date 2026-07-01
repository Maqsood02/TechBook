const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../js-v2/features/notes.js'),
  path.join(__dirname, '../js-v2/features/qbank.js'),
  path.join(__dirname, '../js-v2/features/pyq.js')
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n=== File: ${path.basename(file)} ===`);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('Latest Uploads') || line.includes('Earlier Uploads') || line.includes('Recent Uploads')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
});
