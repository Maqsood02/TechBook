const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js-v2/features/attendance.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('=== Checking for Notes/QBank/PYQ load calls in loadAdminDashboard ===');
let foundDashboard = false;
let start = -1;
let end = -1;
lines.forEach((line, index) => {
  if (line.includes('async function loadAdminDashboard') || line.includes('window.loadAdminDashboard =')) {
    foundDashboard = true;
    start = index;
  }
  if (foundDashboard && end === -1 && line.includes('function') && index > start + 10) {
    // Stop at next function
    end = index;
  }
});

if (start !== -1) {
  for (let i = start; i <= (end === -1 ? lines.length - 1 : end); i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
} else {
  console.log('loadAdminDashboard function not found');
}
