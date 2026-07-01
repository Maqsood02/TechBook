const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Admin Sections in index.html ===');
lines.forEach((line, index) => {
  if (line.includes('class="admin-section"') || line.includes('class="admin-nav-btn"')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
