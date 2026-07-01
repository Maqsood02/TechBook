const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const buffer = fs.readFileSync(filePath);
console.log('File size:', buffer.length);
console.log('First 4 bytes:', buffer.slice(0, 4));

// Detect encoding
let content = '';
if (buffer[0] === 0xff && buffer[1] === 0xfe) {
  console.log('Detected UTF-16LE');
  content = buffer.toString('utf16le');
} else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
  console.log('Detected UTF-16BE');
  content = buffer.toString('utf16be');
} else {
  console.log('Detected UTF-8 / ASCII');
  content = buffer.toString('utf8');
}

// Search for register form
const lines = content.split('\n');
console.log('Total lines:', lines.length);

let foundCount = 0;
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('register') || line.toLowerCase().includes('reg-')) {
    foundCount++;
    if (foundCount <= 10) {
      console.log(`Line ${index + 1}: ${line.trim().slice(0, 150)}`);
    }
  }
});
console.log('Total matches for "register" or "reg-":', foundCount);
