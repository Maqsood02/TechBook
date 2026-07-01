const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/auth.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Top 50 lines of auth.js ===');
for (let i = 0; i < 50; i++) {
  console.log(`Line ${i + 1}: ${lines[i]}`);
}
