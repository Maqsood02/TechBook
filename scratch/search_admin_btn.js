const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/attendance.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const queries = ['admin', 'btn-admin', 'loginAdmin', 'restoreAdminSession'];
queries.forEach(query => {
  console.log(`\n=== Matches for "${query}" ===`);
  let matches = 0;
  lines.forEach((line, index) => {
    if (line.includes(query)) {
      matches++;
      if (matches <= 10) {
        console.log(`Line ${index + 1}: ${line.trim().slice(0, 150)}`);
      }
    }
  });
  console.log(`Total: ${matches}`);
});
