const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const projectId = process.env.FIREBASE_PROJECT_ID || 'attendance-system-54b30';
const apiKey = process.env.FIREBASE_API_KEY;

if (!apiKey) {
  console.error("FIREBASE_API_KEY not found in .env file");
  process.exit(1);
}

const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/techbook_notes?key=${apiKey}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      console.error("Firestore error:", data.error);
      return;
    }
    const docs = data.documents || [];
    console.log(`Found ${docs.length} notes in Firestore:`);
    docs.forEach(doc => {
      const name = doc.name.split('/').pop();
      const fields = doc.fields || {};
      const title = fields.title?.stringValue || 'N/A';
      const subject = fields.subject?.stringValue || 'N/A';
      const sem = fields.sem?.stringValue || fields.sem?.integerValue || 'N/A';
      console.log(`- Note [${name}]: Title="${title}", Subject="${subject}", Sem="${sem}" (Type: ${fields.sem ? Object.keys(fields.sem)[0] : 'None'})`);
    });
  })
  .catch(err => {
    console.error("Request error:", err);
  });
