const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const ids = [
  'reg-pass',
  'reg-pass2',
  'forgot-new-pass',
  'forgot-confirm-pass',
  'admin-pass',
  'current-pass',
  'new-pass',
  'confirm-pass',
  'change-username-pass',
  'new-admin-pass',
  'initial password', // raw substring
  'ai-api-key'
];

ids.forEach(id => {
  console.log(`\n=== Context for "${id}" ===`);
  lines.forEach((line, index) => {
    if (line.includes(id) || (id === 'initial password' && line.includes('Set initial password'))) {
      const start = Math.max(0, index - 2);
      const end = Math.min(lines.length - 1, index + 2);
      for (let i = start; i <= end; i++) {
        console.log(`Line ${i + 1}: ${lines[i].trim()}`);
      }
    }
  });
});
