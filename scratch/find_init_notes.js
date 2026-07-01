const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/notes.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('init') || line.includes('DOMContentLoaded') || line.includes('window.onload') || line.includes('addEventListener')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
