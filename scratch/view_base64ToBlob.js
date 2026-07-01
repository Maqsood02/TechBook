const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/core/helpers.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let start = -1;
lines.forEach((line, index) => {
  if (line.includes('export function base64ToBlob')) {
    start = index;
  }
});

if (start !== -1) {
  for (let i = start - 2; i < start + 25; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
} else {
  console.log('base64ToBlob not found');
}
