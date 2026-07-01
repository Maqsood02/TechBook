const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/pyq.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== PYQ view/download/open handlers in pyq.js ===');
lines.forEach((line, index) => {
  if (line.includes('pyqStudentView') || line.includes('pyqStudentDownload') || line.includes('pyqAdmView')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
