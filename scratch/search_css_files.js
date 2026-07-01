const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== CSS Link Tags in index.html ===');
lines.forEach((line, index) => {
  if (line.includes('<link') && line.includes('stylesheet')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
