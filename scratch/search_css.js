const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../assets/css/style.css');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const queries = ['.card', 'form-group', 'btn', 'input', 'show-login', 'register-form', 'reg-otp'];
queries.forEach(query => {
  console.log(`\n=== Matches for "${query}" ===`);
  let matches = 0;
  lines.forEach((line, index) => {
    if (line.includes(query)) {
      matches++;
      if (matches <= 5) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    }
  });
  console.log(`Total: ${matches}`);
});
