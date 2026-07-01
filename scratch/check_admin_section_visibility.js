const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Checking sec-admins markup context ===');
lines.forEach((line, index) => {
  if (line.includes('id="sec-admins"')) {
    for (let i = index; i < index + 10; i++) {
      console.log(`${i+1}: ${lines[i]}`);
    }
  }
});
