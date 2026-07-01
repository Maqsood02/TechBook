const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== '.agents') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const workspaceRoot = path.join(__dirname, '..');
walkDir(workspaceRoot, (filePath) => {
  if (!filePath.endsWith('.js') && !filePath.endsWith('.html')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('_openPdfViewer') || line.includes('openPdfViewer') || line.includes('pdf-viewer') || line.includes('pdfjs')) {
      console.log(`${path.relative(workspaceRoot, filePath)}:${index + 1}: ${line.trim()}`);
    }
  });
});
