const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../js-v2/app.js'),
  path.join(__dirname, '../js-v2/features/auth.js'),
  path.join(__dirname, '../index.html')
];

const queries = ['navbar-actions', 'logout', 'Logout', 'btn-logout', 'adminLoggedIn'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n=== File: ${path.basename(file)} ===`);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  queries.forEach(query => {
    let matches = 0;
    lines.forEach((line, index) => {
      if (line.includes(query)) {
        matches++;
        if (matches <= 5) {
          console.log(`[${query}] Line ${index + 1}: ${line.trim()}`);
        }
      }
    });
    if (matches > 0) {
      console.log(`Total matches for "${query}": ${matches}`);
    }
  });
});
