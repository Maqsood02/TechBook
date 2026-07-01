const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/pyq.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Firestore collection names in pyq.js ===');
lines.forEach((line, index) => {
  if (line.includes('collection(db,') || line.includes('doc(db,')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
