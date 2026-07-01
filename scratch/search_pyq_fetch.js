const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/pyq.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('fetchPyqBlob') || line.includes('function fetchPyqBlob')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
