const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/pyq.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('window.') && (line.includes('load') || line.includes('Load') || line.includes('open') || line.includes('Open') || line.includes('All'))) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
