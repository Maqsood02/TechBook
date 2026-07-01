const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Semester Filter Buttons in index.html ===');
lines.forEach((line, index) => {
  if (line.includes('filterNotesBySemester') || line.includes('sem-filter-btn')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
