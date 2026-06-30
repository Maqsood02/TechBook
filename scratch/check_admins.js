const https = require('https');
const FIREBASE_PROJECT_ID = 'attendance-system-54b30';
const FIREBASE_API_KEY = 'AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI';

function firestoreRunQuery(query) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery?key=${FIREBASE_API_KEY}`;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: [] }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(query));
    req.end();
  });
}

async function run() {
  const queryResult = await firestoreRunQuery({
    structuredQuery: {
      from: [{ collectionId: 'admins' }]
    }
  });
  console.log("Status:", queryResult.status);
  console.log("Data:", JSON.stringify(queryResult.data, null, 2));
}

run().catch(console.error);
