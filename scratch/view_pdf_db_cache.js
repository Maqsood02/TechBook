const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/core/helpers.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let start = -1;
lines.forEach((line, index) => {
  if (line.includes('PdfDbCache')) {
    start = index;
  }
});

if (start !== -1) {
  for (let i = start - 5; i < start + 45; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
} else {
  console.log('PdfDbCache not found');
}
