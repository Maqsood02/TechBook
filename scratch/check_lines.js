const fs = require('fs');
const path = require('path');

const attPath = path.join(__dirname, '../js-v2/features/attendance.js');
const attLines = fs.readFileSync(attPath, 'utf8').split('\n');
console.log('attendance.js:L773:', attLines[772]?.trim()); // 1-indexed

const promoPath = path.join(__dirname, '../js-v2/features/promos.js');
const promoLines = fs.readFileSync(promoPath, 'utf8').split('\n');
console.log('promos.js:L627:', promoLines[626]?.trim()); // 1-indexed
