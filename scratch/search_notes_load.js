const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const searchDir = path.join(__dirname, '../js-v2');
walkDir(searchDir, (filePath) => {
  if (!filePath.endsWith('.js')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('admLoadAllNotes') || line.includes('admLoadNotes') || line.includes('loadAllNotes')) {
      console.log(`${path.relative(path.join(__dirname, '..'), filePath)}:${index + 1}: ${line.trim()}`);
    }
  });
});
