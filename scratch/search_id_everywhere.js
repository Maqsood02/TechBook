const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "attendance-system-54b30",
  apiKey: "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const docId = "904QtWhEZBqVNI06kLQL";

async function check() {
  const collections = ['techbook_notes', 'qbank_papers', 'pyq_papers'];
  for (const coll of collections) {
    try {
      const snap = await getDoc(doc(db, coll, docId));
      console.log(`Collection: ${coll} -> exists: ${snap.exists()}`);
      if (snap.exists()) {
        console.log('Data:', snap.data());
      }
    } catch (err) {
      console.error(`Error checking ${coll}:`, err);
    }
  }
}

check();
