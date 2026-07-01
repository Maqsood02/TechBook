const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/attendance.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let start = -1;
let end = -1;
lines.forEach((line, index) => {
  if (line.includes('window.adminLogout =')) {
    start = index;
  }
  if (start !== -1 && end === -1 && line.includes('function') && index > start + 10) {
    end = index;
  }
});

if (start !== -1) {
  for (let i = start; i <= (end === -1 ? lines.length - 1 : end); i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
} else {
  console.log('adminLogout function not found');
}
