const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../js-v2/features/qbank.js'),
  path.join(__dirname, '../js-v2/features/pyq.js')
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`\n=== File: ${path.basename(file)} ===`);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('filter') || line.includes('Filter') || line.includes('sem-filter-btn')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
});
