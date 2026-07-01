const https = require('https');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

console.log('Project ID:', FIREBASE_PROJECT_ID);
console.log('API Key:', FIREBASE_API_KEY ? 'Present' : 'Missing');

function firestoreSaveOTP(usn, data) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/otp_${usn}?key=${FIREBASE_API_KEY}`;
    const urlObj = new URL(url);
    const body = JSON.stringify({
      fields: {
        otp: { stringValue: data.otp },
        email: { stringValue: data.email },
        name: { stringValue: data.name },
        expiresAt: { integerValue: String(data.expiresAt) },
        attempts: { integerValue: String(data.attempts) }
      }
    });

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: responseData });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function firestoreGetOTP(usn) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/otp_${usn}?key=${FIREBASE_API_KEY}`;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET'
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function parseField(fieldObj) {
  if (!fieldObj) return null;
  const type = Object.keys(fieldObj)[0];
  const val = fieldObj[type];
  if (type === 'booleanValue') return val;
  if (type === 'integerValue') return parseInt(val);
  if (type === 'doubleValue') return parseFloat(val);
  if (type === 'arrayValue') return (val.values || []).map(parseField);
  if (type === 'mapValue') {
    const obj = {};
    for (const [k, v] of Object.entries(val.fields || {})) obj[k] = parseField(v);
    return obj;
  }
  return val;
}

function parseDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = { _id: doc.name ? doc.name.split('/').pop() : null };
  for (const [k, v] of Object.entries(doc.fields)) obj[k] = parseField(v);
  return obj;
}

async function run() {
  const usn = 'TESTUSN123';
  const data = {
    otp: '123456',
    email: 'test@example.com',
    name: 'Test Student',
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0
  };

  console.log('Saving OTP...');
  const saveRes = await firestoreSaveOTP(usn, data);
  console.log('Save Result Status:', saveRes.status);
  console.log('Save Result Data:', saveRes.data);

  console.log('Getting OTP...');
  const getRes = await firestoreGetOTP(usn);
  console.log('Get Result Status:', getRes.status);
  console.log('Get Result Data:', getRes.data);
  if (getRes.status === 200) {
    try {
      console.log('Parsed Doc:', parseDoc(JSON.parse(getRes.data)));
    } catch (e) {
      console.error('Parse error:', e);
    }
  }
}

run().catch(console.error);
