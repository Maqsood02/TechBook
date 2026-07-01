const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../assets/css/style.css');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let found = false;
  lines.forEach((line, index) => {
    if (line.includes('admin-section')) {
      found = true;
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
  if (!found) {
    console.log('No matches for "admin-section" in style.css');
  }
} else {
  console.log('style.css does not exist at assets/css/style.css');
}
