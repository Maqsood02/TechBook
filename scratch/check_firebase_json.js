const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../firebase.json');
if (fs.existsSync(filePath)) {
  console.log(fs.readFileSync(filePath, 'utf8'));
} else {
  console.log('firebase.json does not exist');
}
