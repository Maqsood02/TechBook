const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/attendance.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const queries = ['applyRoleRestrictions', 'initAdminNav'];
queries.forEach(query => {
  console.log(`\n=== Matches for "${query}" ===`);
  lines.forEach((line, index) => {
    if (line.includes(query)) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
});
