const projectId = "attendance-system-54b30";
const apiKey = "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI";
const collectionName = "pyq_papers";
const docId = "904QtWhEZBqVNI06kLQL";

async function test() {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}/chunks?key=${apiKey}&pageSize=300`;
  console.log('Fetching:', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status, res.statusText);
    const data = await res.json();
    console.log('Data keys:', Object.keys(data));
    if (data.error) {
      console.error('REST API Error:', data.error);
    } else {
      const docs = data.documents || [];
      console.log('Chunks count:', docs.length);
      if (docs.length > 0) {
        console.log('First chunk metadata fields:', Object.keys(docs[0].fields || {}));
        console.log('First chunk data string value exists:', !!docs[0].fields?.data?.stringValue);
        console.log('First chunk idx:', docs[0].fields?.idx);
      }
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

test();
