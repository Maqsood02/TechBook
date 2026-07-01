const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== All occurrences of admin-section in index.html ===');
let count = 0;
lines.forEach((line, index) => {
  if (line.includes('admin-section')) {
    count++;
    if (line.includes('{') || line.includes(':') || line.includes('display')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  }
});
console.log(`Total occurrences: ${count}`);
