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

// Test note: "Quantum Mechanics" (ID: Nm2mgAOnV0gh1sCdkVh7)
const noteId = 'Nm2mgAOnV0gh1sCdkVh7';
const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/techbook_notes/${noteId}/chunks?key=${apiKey}&pageSize=300`;

console.log("Fetching note chunks via REST API from:", url);

fetch(url)
  .then(res => {
    console.log("HTTP Status:", res.status);
    return res.json();
  })
  .then(data => {
    if (data.error) {
      console.error("Firestore REST Error:", data.error);
      return;
    }
    const docs = data.documents || [];
    console.log(`Fetched ${docs.length} chunks successfully!`);
    
    // Sort chunks by idx
    docs.sort((a, b) => {
      const idxA = parseInt(a.fields?.idx?.integerValue || a.fields?.idx?.stringValue || '0', 10);
      const idxB = parseInt(b.fields?.idx?.integerValue || b.fields?.idx?.stringValue || '0', 10);
      return idxA - idxB;
    });

    let totalLength = 0;
    docs.forEach((doc, i) => {
      const chunkData = doc.fields?.data?.stringValue || '';
      totalLength += chunkData.length;
      console.log(`Chunk ${i}: idx=${doc.fields?.idx?.integerValue || doc.fields?.idx?.stringValue}, size=${chunkData.length} chars`);
    });
    console.log(`Total reconstructed base64 size: ${totalLength} characters`);
  })
  .catch(err => {
    console.error("REST request failed:", err);
  });
