const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Password Input Fields in index.html ===');
lines.forEach((line, index) => {
  if (line.includes('type="password"') || line.includes("type='password'")) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
