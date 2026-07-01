const projectId = "attendance-system-54b30";
const apiKey = "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI";
const collectionName = "pyq_papers";
const docId = "904QtWhEZBqVNl06kLQL";

async function test() {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionName}/${docId}/chunks?key=${apiKey}&pageSize=300`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const docs = data.documents || [];
    docs.sort((a, b) => {
      const idxA = parseInt(a.fields?.idx?.integerValue || a.fields?.idx?.stringValue || "0", 10);
      const idxB = parseInt(b.fields?.idx?.integerValue || b.fields?.idx?.stringValue || "0", 10);
      return idxA - idxB;
    });
    const base64 = docs.map(d => d.fields?.data?.stringValue || "").join('');
    console.log('Combined base64 length:', base64.length);
    const buffer = Buffer.from(base64, 'base64');
    const header = buffer.toString('utf8', 0, 5);
    console.log('File header (should be %PDF-):', header);
    console.log('Buffer length in bytes:', buffer.length);
  } catch (err) {
    console.error(err);
  }
}

test();
