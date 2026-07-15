const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const firebaseConfig = {
  projectId: "attendance-system-54b30",
  apiKey: "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function compileList() {
  const collections = {
    notes: 'techbook_notes',
    qbanks: 'qbank_papers',
    pyqs: 'pyq_papers'
  };
  
  const results = {
    notes: [],
    qbanks: [],
    pyqs: []
  };

  for (const [key, coll] of Object.entries(collections)) {
    try {
      const snap = await getDocs(collection(db, coll));
      snap.forEach(doc => {
        const data = doc.data();
        results[key].push({
          id: doc.id,
          title: data.title || 'Untitled',
          subject: data.subject || 'General',
          sem: data.sem || 'N/A',
          year: data.year || 'N/A',
          dept: data.dept || 'Common/All',
          section: data.section || 'all',
          examYear: data.examYear || null
        });
      });
    } catch (err) {
      console.error(`Error querying ${coll}:`, err);
    }
  }

  // Generate Markdown
  let markdown = `# TechBook Resource Catalog\n\nThis catalog lists all student resources currently available in the TechBook database, categorized by Semester, Year, and Branch/Department.\n\n`;

  // Helper to sort resources
  const sortResources = (arr) => {
    return arr.sort((a, b) => {
      // Sort by sem first, then year, then dept, then subject, then title
      const semCompare = String(a.sem).localeCompare(String(b.sem));
      if (semCompare !== 0) return semCompare;
      const yearCompare = String(a.year).localeCompare(String(b.year));
      if (yearCompare !== 0) return yearCompare;
      const deptCompare = String(a.dept).localeCompare(String(b.dept));
      if (deptCompare !== 0) return deptCompare;
      const subCompare = String(a.subject).localeCompare(String(b.subject));
      if (subCompare !== 0) return subCompare;
      return String(a.title).localeCompare(String(b.title));
    });
  };

  // 1. NOTES SECTION
  markdown += `## 1. Study Notes\n\nTotal Notes: ${results.notes.length}\n\n`;
  markdown += `| Semester | Year | Branch/Dept | Subject | Title | Targets |\n`;
  markdown += `| --- | --- | --- | --- | --- | --- |\n`;
  sortResources(results.notes).forEach(n => {
    markdown += `| Sem ${n.sem} | Yr ${n.year} | ${n.dept} | ${n.subject} | ${n.title} | Sec: ${n.section} |\n`;
  });
  markdown += `\n`;

  // 2. QUESTION BANKS SECTION
  markdown += `## 2. Question Banks\n\nTotal Question Banks: ${results.qbanks.length}\n\n`;
  markdown += `| Semester | Year | Branch/Dept | Subject | Title | Targets |\n`;
  markdown += `| --- | --- | --- | --- | --- | --- |\n`;
  sortResources(results.qbanks).forEach(q => {
    markdown += `| Sem ${q.sem} | Yr ${q.year} | ${q.dept} | ${q.subject} | ${q.title} | Sec: ${q.section} |\n`;
  });
  markdown += `\n`;

  // 3. PREVIOUS YEAR QUESTIONS SECTION
  markdown += `## 3. Previous Year Question Papers (PYQs)\n\nTotal PYQ Papers: ${results.pyqs.length}\n\n`;
  markdown += `| Semester | Year | Exam Year | Subject | Title | Target Dept |\n`;
  markdown += `| --- | --- | --- | --- | --- | --- |\n`;
  sortResources(results.pyqs).forEach(p => {
    markdown += `| Sem ${p.sem} | Yr ${p.year} | ${p.examYear || 'N/A'} | ${p.subject} | ${p.title} | ${p.dept} |\n`;
  });

  const outputPath = path.join(__dirname, 'compiled_resources.md');
  fs.writeFileSync(outputPath, markdown);
  console.log(`✓ Markdown list successfully written to scratch/compiled_resources.md`);
}

compileList();
