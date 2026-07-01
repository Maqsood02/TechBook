const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../js-v2/features/notes.js'),
  path.join(__dirname, '../js-v2/features/qbank.js'),
  path.join(__dirname, '../js-v2/features/pyq.js')
];

const queries = ['collection', 'doc', 'updateDoc', 'deleteDoc', 'admin', 'innerHTML', 'delete', 'edit', 'title'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n=== File: ${path.basename(file)} ===`);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  queries.forEach(query => {
    let matches = 0;
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        matches++;
        if (matches <= 5) {
          console.log(`[${query}] Line ${index + 1}: ${line.trim().slice(0, 150)}`);
        }
      }
    });
    if (matches > 0) {
      console.log(`Total matches for "${query}": ${matches}`);
    }
  });
});
