const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "attendance-system-54b30",
  apiKey: "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function list() {
  const collections = ['techbook_notes', 'qbank_papers', 'pyq_papers'];
  for (const coll of collections) {
    try {
      const snap = await getDocs(collection(db, coll));
      console.log(`Collection ${coll}: count = ${snap.size}`);
      snap.forEach(doc => {
        console.log(`  - ID: ${doc.id}, title: ${doc.data().title}, subject: ${doc.data().subject}`);
      });
    } catch (err) {
      console.error(`Error listing ${coll}:`, err);
    }
  }
}

list();
