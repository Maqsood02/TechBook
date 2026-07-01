const https = require('https');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

function listSettingsDocs() {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings?key=${FIREBASE_API_KEY}`;
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
  console.log('Listing settings docs...');
  const res = await listSettingsDocs();
  console.log('Status:', res.status);
  if (res.status === 200) {
    try {
      const parsed = JSON.parse(res.data);
      if (parsed.documents && parsed.documents.length > 0) {
        console.log(`Found ${parsed.documents.length} documents:`);
        parsed.documents.forEach(doc => {
          console.log(parseDoc(doc));
        });
      } else {
        console.log('No documents found in /settings.');
      }
    } catch (e) {
      console.error('Parse error:', e);
      console.log('Raw Data:', res.data);
    }
  } else {
    console.log('Raw Error Data:', res.data);
  }
}

run().catch(console.error);
