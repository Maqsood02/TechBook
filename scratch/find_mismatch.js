const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('saveAIKey') || line.includes('Groq')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
    const start = Math.max(0, index - 4);
    const end = Math.min(lines.length - 1, index + 4);
    console.log('--- Context ---');
    for (let i = start; i <= end; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
    console.log('---------------\n');
  }
});
