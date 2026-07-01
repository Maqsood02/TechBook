const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let start = -1;
let end = -1;
lines.forEach((line, index) => {
  if (line.includes('id="admin-login-block"')) {
    start = index;
  }
  if (start !== -1 && end === -1 && line.includes('</button>') && lines[index+1]?.includes('</div>') && lines[index+2]?.includes('</div>')) {
    end = index + 5;
  }
});

if (start !== -1) {
  console.log(`=== Admin Login Block Context (Lines ${start+1} to ${end+1}) ===`);
  for (let i = start; i <= end; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
} else {
  console.log('Admin login block not found.');
}
