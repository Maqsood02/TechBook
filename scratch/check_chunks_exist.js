const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "attendance-system-54b30",
  apiKey: "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const docId = "904QtWhEZBqVNI06kLQL";

async function check() {
  try {
    const metaSnap = await getDoc(doc(db, 'pyq_papers', docId));
    console.log('Meta exists:', metaSnap.exists());
    if (metaSnap.exists()) {
      console.log('Meta data:', metaSnap.data());
    }
    const chunksSnap = await getDocs(collection(db, 'pyq_papers', docId, 'chunks'));
    console.log('Chunks count (SDK):', chunksSnap.size);
    if (chunksSnap.size > 0) {
      const first = chunksSnap.docs[0];
      console.log('First chunk id:', first.id);
      console.log('First chunk data sample keys:', Object.keys(first.data()));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
