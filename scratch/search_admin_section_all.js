const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Style / CSS occurrences of admin-section ===');
lines.forEach((line, index) => {
  if (line.includes('admin-section') && index < 800) { // style tags are usually at the top (< 800 lines)
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
