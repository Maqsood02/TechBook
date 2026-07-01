const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Semester Select Options in index.html ===');
lines.forEach((line, index) => {
  if (line.includes('id="adm-sem"') || line.includes('id="reg-sem"') || line.includes('id="bulk-new-sem"')) {
    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length - 1, index + 8);
    console.log(`--- Context for ${line.trim()} (Lines ${start+1}-${end+1}) ---`);
    for (let i = start; i <= end; i++) {
      console.log(`${i+1}: ${lines[i]}`);
    }
  }
});
