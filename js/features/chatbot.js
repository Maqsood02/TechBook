import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, getDocs, orderBy, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { auth } from '../core/firebase.js';

    const fbCfg = {
      apiKey: "AIzaSyC-aoJvlXHec3XQojpD1eKPvOQtYwCL0gI",
      authDomain: "attendance-system-54b30.firebaseapp.com",
      projectId: "attendance-system-54b30",
      storageBucket: "attendance-system-54b30.firebasestorage.app",
      messagingSenderId: "48653878552",
      appId: "1:48653878552:web:cc7f71cafb5b9aebc24a6d"
    };
    const hApp = getApps().find(a => a.name === 'hc3') || initializeApp(fbCfg, 'hc3');
    const hDb = getFirestore(hApp);
    let hUnsub = null;

    function tid() {
      const usn = window._currentStudentUSN || (auth.currentUser ? auth.currentUser.email.split('@')[0].toUpperCase() : 'anon');
      let t = sessionStorage.getItem('hc_tid4');
      if (!t || !t.startsWith(usn)) {
        t = usn + '_' + Date.now();
        sessionStorage.setItem('hc_tid4', t);
      }
      return t;
    }

    let voices = [];
    function loadVoices() { voices = window.speechSynthesis?.getVoices() || []; if (!voices.length) setTimeout(loadVoices, 300); }
    if (window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = () => { voices = window.speechSynthesis.getVoices(); }; loadVoices(); }

    // Chrome has a bug where speech pauses/stops mid-sentence on long text.
    // Fix: split into sentences and speak them in sequence.
    let _speakQueue = [];
    let _speakTimer = null;

    function speakChunk(chunks, idx, voice) {
      if (idx >= chunks.length) { _speakQueue = []; return; }
      const u = new SpeechSynthesisUtterance(chunks[idx]);
      u.lang = 'en-IN';
      u.rate = 0.88;
      u.pitch = 1.0;
      u.volume = 1.0;
      if (voice) u.voice = voice;
      u.onend = () => speakChunk(chunks, idx + 1, voice);
      u.onerror = () => speakChunk(chunks, idx + 1, voice);
      // Chrome keepalive: pause/resume every 10s to prevent silent stop
      if (_speakTimer) clearInterval(_speakTimer);
      _speakTimer = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else { clearInterval(_speakTimer); }
      }, 10000);
      window.speechSynthesis.speak(u);
    }

    function speak(text) {
      try {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        if (_speakTimer) { clearInterval(_speakTimer); _speakTimer = null; }

        // Clean text for natural pronunciation
        const clean = text
          .replace(/\*\*/g, '')           // remove markdown bold
          .replace(/\*/g, '')             // remove markdown italic
          .replace(/#{1,6}\s/g, '')       // remove markdown headings
          .replace(/CO(\d)/g, 'Course Outcome $1')
          .replace(/Q(\d+)\./g, 'Question $1.')
          .replace(/USN/g, 'U S N')
          .replace(/PYQ/g, 'previous year question')
          .replace(/DBMS/g, 'D B M S')
          .replace(/OSI/g, 'O S I')
          .replace(/TCP\/IP/gi, 'T C P I P')
          .replace(/MANET/g, 'man-et')
          .replace(/AODV/g, 'A O D V')
          .replace(/\bIA\b/g, 'Internal Assessment')
          .replace(/[-–—]/g, ', ')        // dashes become natural pauses
          .replace(/[•·]/g, '')           // remove bullets
          .replace(/[^\x00-\x7F]/g, ' ') // strip emojis/special chars
          .replace(/\n{2,}/g, '. ')       // paragraph breaks → sentence pause
          .replace(/\n/g, ', ')           // line breaks → short pause
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (!clean) return;

        // Split into natural sentence chunks (max ~180 chars each)
        const sentences = clean.match(/[^.!?]+[.!?,]?/g) || [clean];
        const chunks = [];
        let buf = '';
        for (const s of sentences) {
          if ((buf + s).length > 180) { if (buf.trim()) chunks.push(buf.trim()); buf = s; }
          else buf += s;
        }
        if (buf.trim()) chunks.push(buf.trim());

        // Pick best English voice
        const best =
          voices.find(v => /google.*english.*india|google.*en.*in/i.test(v.name)) ||
          voices.find(v => v.lang === 'en-IN') ||
          voices.find(v => /samantha|karen|zira|google us english/i.test(v.name)) ||
          voices.find(v => v.lang === 'en-US' && v.localService) ||
          voices.find(v => /en/i.test(v.lang)) ||
          voices[0] || null;

        speakChunk(chunks, 0, best);
      } catch (e) { console.warn('speak error:', e); }
    }

    // Voice recognition
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let voiceRecog = null;
    if (SR) {
      voiceRecog = new SR();
      voiceRecog.lang = 'en-IN';
      voiceRecog.continuous = false;
      voiceRecog.interimResults = false;
      let final = '';
      voiceRecog.onstart = () => {
        const status = document.getElementById('hc-voice-status');
        if (status) status.textContent = '🎤 Listening…';
      };
      voiceRecog.onresult = e => { final = Array.from(e.results).map(r => r[0].transcript).join(' '); };
      voiceRecog.onend = () => {
        const status = document.getElementById('hc-voice-status');
        if (final && status) status.textContent = '✓ Sending…';
        window._hcVoiceStop && window._hcVoiceStop();
        if (final) {
          const inp = document.getElementById('hc-input');
          if (inp) { inp.value = final; final = ''; }
          setTimeout(() => window._hcSend(), 350);
        }
      };
      voiceRecog.onerror = e => {
        window._hcVoiceStop && window._hcVoiceStop();
        const errMsgs = {
          'not-allowed': 'Microphone access denied. Please allow microphone in browser settings.',
          'no-speech': 'No speech detected. Please try again.',
          'audio-capture': 'No microphone found.',
          'network': 'Network error. Check connection.',
          'service-not-allowed': 'Speech service not allowed.'
        };
        const inp = document.getElementById('hc-input');
        if (inp) inp.placeholder = errMsgs[e.error] || ('Voice error: ' + e.error);
        setTimeout(() => { if (inp) inp.placeholder = 'Ask me anything...'; }, 3500);
      };
    } else {
      const micBtn = document.getElementById('hc-mic-btn');
      if (micBtn) { micBtn.disabled = true; micBtn.title = 'Voice input not supported'; micBtn.style.opacity = '0.5'; }
    }
    window._hcVoiceStart = function () {
      const btn = document.getElementById('hc-mic-btn');
      const panel = document.getElementById('hc-voice-panel');
      const status = document.getElementById('hc-voice-status');
      if (!voiceRecog) {
        const inp = document.getElementById('hc-input');
        if (inp) inp.placeholder = 'Voice not supported in this browser.';
        return;
      }
      try {
        voiceRecog.start();
        if (btn) { btn.classList.add('mic-on'); btn.title = 'Listening… (click to stop)'; }
        if (panel) panel.classList.add('show');
        if (status) status.textContent = '🎤 Listening…';
      } catch (err) { console.warn('Voice start:', err); }
    };
    window._hcVoiceStop = function () {
      const btn = document.getElementById('hc-mic-btn');
      const panel = document.getElementById('hc-voice-panel');
      if (btn) { btn.classList.remove('mic-on'); btn.title = 'Voice input'; }
      if (panel) panel.classList.remove('show');
      try { voiceRecog && voiceRecog.stop(); } catch (e) { }
    };

    // ================================================
    // TECHBOOK AI ENGINE - local fallback plus optional API support
    // ================================================

    let _notesCache = null;
    async function getNotesContext() {
      if (_notesCache !== null) return _notesCache;
      try {
        // Use a Promise.race to prevent hanging if Firebase is slow/blocked
        const notesPromise = (async () => {
          const snap = await getDocs(collection(hDb, 'techbook_notes'));
          return snap.docs.map(d => {
            const x = d.data();
            return 'Subject: ' + (x.subject || '?') + ' | Title: ' + (x.title || '?') + ' | Sem: ' + (x.sem || '?') + ' | Desc: ' + (x.desc || '');
          }).slice(0, 60).join('\n');
        })();

        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(''), 3000));
        _notesCache = await Promise.race([notesPromise, timeoutPromise]);
      } catch (e) {
        console.warn('Notes context error:', e);
        _notesCache = '';
      }
      return _notesCache;
    }

    async function getAIReply(userMsg) {
      const m = userMsg.toLowerCase().trim();

      // Instant greetings
      if (/^\s*(hi+|hello+|hey+|hii+|hola)\s*[!?]*\s*$/i.test(m))
        return 'Hey! I am your TechBook AI Assistant!\n\nI can:\n- Analyse notes and list important exam topics\n- Generate exam questions mapped to Course Outcomes (CO1, CO2...)\n- Help with attendance, quizzes, PYQs, login\n- Answer any academic question\n\nJust type your question!';
      if (/thank|thanks|tysm/i.test(m)) return 'You are welcome! Ask me anything else!';
      if (/bye|goodbye/i.test(m)) return 'Goodbye! Best of luck with your studies!';

      // Fast local match for common intents to bypass AI/DB wait
      if (m === 'notes' || m === 'show me notes') return '📚 **TechBook Notes**\n\nYou can find all your study materials in the **Notes** tab. They are organized by Year, Semester, and Subject.\n\nLooking for something specific? Try asking: "Analyse Computer Networks notes"';
      if (m.includes('attendance help')) return '📋 **Attendance Help**\n\n1. Open the Attendance tab.\n2. Enter the 6-digit code provided by your teacher.\n3. Make sure to submit before the timer runs out!\n\nIf you missed it, contact your teacher directly.';
      if (m.includes('quiz and scores')) return '🧠 **Quizzes & Scores**\n\nGo to the **Quizzes** tab to see active tests. Your scores and rank will update immediately after submission.';
      if (m.includes('previous year questions') || m === 'pyq') return '🗂️ **Previous Year Questions (PYQs)**\n\nSelect the PYQs tab to download past exam papers for your subjects. They are uploaded by your department.';

      const notesCtx = await getNotesContext();
      const name = window._currentStudentName || 'Student';
      const apiKey = window.getAiKey ? window.getAiKey() : '';
      // Always try AI — if no external key, callAI falls back to Anthropic automatically
      try {
        const prompt = buildChatPrompt(userMsg, notesCtx, name);
        // Add a 5s timeout for AI reply
        const aiPromise = callAI(apiKey, prompt);
        const aiTimeout = new Promise(resolve => setTimeout(() => resolve(''), 5000));
        const aiReply = await Promise.race([aiPromise, aiTimeout]);
        if (aiReply && aiReply.trim()) return aiReply.trim();
      } catch (e) {
        console.error('Chat AI API failed:', e);
      }

      // Detect intent
      const wantsTopics = /topic|import|key|main|syllabus|unit|chapter|analys|overview/i.test(m);
      const wantsQuestions = /question|q&a|exam|test|generat|creat|make|give/i.test(m);
      const wantsMCQ = /\bmcq\b|multiple.?choice/i.test(m);
      const isPlatform = /attend|present|absent|code|login|password|forgot|reset|pyq|previous year|quiz|score/i.test(m);

      // Platform help
      if (isPlatform && !wantsTopics && !wantsQuestions) {
        if (/attend|present|absent|code|proxy/.test(m))
          return '**Mark Attendance**\n\n1. Tap Attendance tab\n2. Enter the 6-digit code from your teacher\n3. Submit before timer expires\n\nWrongly marked? Contact your coordinator\nPhone: +91 87924 04950';
        if (/pyq|previous year|question paper/.test(m))
          return '**Previous Year Questions**\n\n1. Go to PYQs tab\n2. Select: Year > Semester > Subject\n3. Download the PDF\n\nAll papers uploaded by teachers.';
        if (/quiz|score|result|marks/.test(m))
          return '**Quiz Results**\n\nOpen the Quiz tab for active quizzes.\nScores update instantly after submission.\n\nWrong score? Email: techbook.ac.in@gmail.com';
        if (/password|forgot|reset|login/.test(m))
          return '**Login Help**\n\n1. Click Forgot Password on login screen\n2. Enter your USN + Name + Section\n3. Set your new password\n\nStill stuck?\nEmail: techbook.ac.in@gmail.com\nPhone: +91 87924 04950';
      }

      // Detect subject
      const subjectMap = [
        [/wireless|adapt.*network/i, 'Wireless and Adaptive Networks'],
        [/computer.?network|cn\b/i, 'Computer Networks'],
        [/data.?struct/i, 'Data Structures'],
        [/algorithm|daa\b/i, 'Design and Analysis of Algorithms'],
        [/dbms|database/i, 'Database Management Systems'],
        [/\bos\b|operating.?system/i, 'Operating Systems'],
        [/\bjava\b/i, 'Java Programming'],
        [/python/i, 'Python Programming'],
        [/web.?tech|html|css/i, 'Web Technologies'],
        [/machine.?learn|ml\b/i, 'Machine Learning'],
        [/\bai\b|artificial.?intel/i, 'Artificial Intelligence'],
        [/cloud/i, 'Cloud Computing'],
        [/cyber|security/i, 'Cyber Security'],
        [/software.?eng|se\b/i, 'Software Engineering'],
        [/microprocess/i, 'Microprocessors'],
        [/signal|dsp\b/i, 'Digital Signal Processing'],
        [/math|calculus|linear.?algebra/i, 'Engineering Mathematics'],
      ];

      let subject = null;
      for (const [re, label] of subjectMap) {
        if (re.test(m)) { subject = label; break; }
      }

      // Check notes for subject match if not found
      if (!subject && notesCtx) {
        for (const line of notesCtx.split('\n')) {
          const s = (line.match(/Subject:\s*([^|]+)/) || [])[1];
          if (s && m.includes(s.toLowerCase().slice(0, 5))) { subject = s.trim(); break; }
        }
      }

      const subName = subject || userMsg.replace(/analyse|analyze|generate|questions?|topics?|important|exam|for|the|of|chapter|unit|\d/gi, '').trim() || 'your subject';

      if (wantsTopics || (!wantsQuestions && !wantsMCQ && subject)) {
        return buildTopicsReply(subName, notesCtx);
      }

      if (wantsQuestions || wantsMCQ) {
        return buildQuestionsReply(subName, userMsg, wantsMCQ);
      }

      // General
      if (notesCtx) {
        const count = notesCtx.split('\n').filter(l => l.trim()).length;
        return 'TechBook AI - ' + name + '\n\nI found ' + count + ' notes in the system.\n\nTry asking:\n- "Analyse wireless networks notes" - for unit-wise important topics\n- "Generate questions for CO1" - for CO-mapped exam questions\n- "Important topics for DBMS" - for exam preparation\n- "Explain TCP/IP protocol" - for concept explanation\n\nWhat would you like help with?';
      }
      return 'TechBook AI Assistant\n\nAsk me:\n- "Analyse [subject] notes"\n- "Generate questions for CO2 Data Structures"\n- "Important topics for DBMS Unit 3"\n- "Explain TCP/IP protocol"\n\nOr ask about: Attendance, Notes, PYQs, Quizzes, Login\n\nPhone: +91 87924 04950';
    }

    function buildChatPrompt(userMsg, notesCtx, name) {
      let prompt = `You are TechBook Assistant, a helpful academic assistant for college students. Answer clearly and politely in plain English. Use available notes and syllabus context when relevant.`;
      if (notesCtx) {
        prompt += `\n\nNotes context:\n${notesCtx}`;
      }
      prompt += `\n\nStudent name: ${name}`;
      prompt += `\nUser question: ${userMsg}`;
      prompt += `\n\nIf the question is about the TechBook app, provide step-by-step guidance. If the question is academic, give a concise and correct answer. Avoid markdown formatting.`;
      return prompt;
    }

    function buildTopicsReply(subject, notesCtx) {
      // Find matching notes
      let matchingNotes = [];
      if (notesCtx) {
        notesCtx.split('\n').forEach(line => {
          const s = (line.match(/Subject:\s*([^|]+)/) || [])[1] || '';
          const t = (line.match(/Title:\s*([^|]+)/) || [])[1] || '';
          const d = (line.match(/Desc:\s*(.+)/) || [])[1] || '';
          const q = subject.toLowerCase();
          if (q.split(' ').some(w => w.length > 3 && s.toLowerCase().includes(w))) {
            matchingNotes.push((t || s) + (d ? ' - ' + d.slice(0, 50) : ''));
          }
        });
      }

      const topics = getSubjectTopics(subject);
      let reply = subject + ' - Important Exam Topics\n\n';

      if (matchingNotes.length > 0) {
        reply += 'Notes found in TechBook:\n';
        matchingNotes.slice(0, 4).forEach((n, i) => reply += (i + 1) + '. ' + n + '\n');
        reply += '\n';
      }

      reply += 'Unit-wise Important Topics:\n\n';
      topics.units.forEach((unit, i) => {
        reply += 'Unit ' + (i + 1) + ': ' + unit.name + '\n';
        unit.topics.forEach(t => reply += '  - ' + t + '\n');
        reply += '\n';
      });

      reply += 'CO Mapping:\n';
      topics.cos.forEach((co, i) => reply += 'CO' + (i + 1) + ': ' + co + '\n');

      reply += '\nTip: Ask "Generate questions for CO1" or "Unit 2 questions" for exam practice!';
      return reply;
    }

    function buildQuestionsReply(subject, originalMsg, includeMCQ) {
      const coMatch = originalMsg.match(/co\s*(\d)/i);
      const unitMatch = originalMsg.match(/unit\s*(\d)/i);
      const coNum = coMatch ? parseInt(coMatch[1]) : null;
      const unitNum = unitMatch ? parseInt(unitMatch[1]) : null;

      const topics = getSubjectTopics(subject);
      const coLabel = coNum ? 'CO' + coNum : 'All COs';
      const unitLabel = unitNum ? 'Unit ' + unitNum : 'All Units';
      const unit = unitNum ? (topics.units[unitNum - 1] || topics.units[0]) : topics.units[0];
      const unitName = unit ? unit.name : subject;
      const unitTopics = unit ? unit.topics : topics.units[0].topics;
      const coText = coNum ? topics.cos[coNum - 1] : topics.cos[0];

      let reply = subject + '\nQuestions - ' + coLabel + ' | ' + unitLabel + '\n\n';
      if (coText) reply += 'Course Outcome: ' + coText + '\n\n';

      reply += '2-Mark Questions:\n';
      unitTopics.slice(0, 3).forEach((t, i) => {
        reply += 'Q' + (i + 1) + '. Define ' + t.replace(/and.*/, '').trim() + '.\n';
      });

      reply += '\n5-Mark Questions:\n';
      unitTopics.slice(0, 2).forEach((t, i) => {
        reply += 'Q' + (i + 1) + '. Explain ' + t + ' with a neat diagram.\n';
      });

      reply += '\n10-Mark Questions:\n';
      reply += 'Q1. Describe the architecture and working of ' + unitName + ' with examples.\n';
      reply += 'Q2. Compare different approaches in ' + unitName + '. Discuss advantages and limitations.\n';

      if (includeMCQ) {
        reply += '\nMCQ Questions:\n';
        unitTopics.slice(0, 2).forEach((t, i) => {
          reply += 'Q' + (i + 1) + '. Which best describes ' + t.split(' ').slice(0, 4).join(' ') + '?\n';
          reply += '   a) Option A   b) Option B   c) Option C   d) Option D\n';
        });
      }

      reply += '\nTip: Ask "Generate questions for CO2" or "Unit 3 questions" for more!';
      return reply;
    }

    function getSubjectTopics(subject) {
      const s = subject.toLowerCase();

      if (/wireless|adapt/i.test(s)) return {
        units: [
          { name: 'Introduction to Wireless Networks', topics: ['Wireless communication basics', 'Radio frequency spectrum and bands', 'IEEE 802.11 Wi-Fi standards', 'Differences between wired and wireless', 'Infrared vs Radio transmission'] },
          { name: 'Mobile IP and Wireless MAC', topics: ['Mobile IP protocol and operation', 'DHCP in wireless networks', 'CSMA/CA mechanism', 'Hidden terminal and exposed terminal problem', 'RTS/CTS handshake protocol'] },
          { name: 'Ad-hoc and Sensor Networks', topics: ['MANET definition and characteristics', 'AODV and DSR routing protocols', 'Wireless Sensor Network architecture', 'Energy-efficient routing in WSN', 'Flooding and gossiping protocols'] },
          { name: 'Cellular Networks', topics: ['GSM architecture and components', 'CDMA technology basics', 'Evolution from 2G to 5G', 'Handoff types: hard and soft', 'Cell splitting and sectoring'] },
          { name: 'Wireless Security', topics: ['WEP, WPA, WPA2 comparison', '802.1X authentication', 'Common wireless attacks: DoS, eavesdropping', 'Bluetooth and Zigbee security', 'Intrusion detection in wireless'] },
        ],
        cos: [
          'Understand wireless communication fundamentals and IEEE standards',
          'Analyse MAC protocols and mobile IP for wireless networks',
          'Apply routing protocols for ad-hoc and sensor networks',
          'Evaluate cellular network generations and handoff management',
          'Assess wireless security mechanisms and attack prevention'
        ]
      };

      if (/computer.?net|cn\b/i.test(s)) return {
        units: [
          { name: 'Network Fundamentals and OSI Model', topics: ['OSI 7-layer model functions', 'TCP/IP model vs OSI', 'Transmission media types', 'Network topologies', 'Switching: circuit vs packet vs message'] },
          { name: 'Data Link Layer', topics: ['Framing techniques', 'CRC and checksum error detection', 'HDLC and PPP protocols', 'Sliding window: Go-Back-N, Selective Repeat', 'CSMA/CD and CSMA/CA'] },
          { name: 'Network Layer', topics: ['IPv4 addressing and subnetting', 'Routing algorithms: Dijkstra, Bellman-Ford', 'OSPF and BGP protocols', 'NAT and CIDR', 'IPv6 basics'] },
          { name: 'Transport Layer', topics: ['TCP vs UDP comparison', 'TCP three-way handshake', 'Flow control and congestion control', 'TCP window management', 'UDP applications'] },
          { name: 'Application Layer', topics: ['DNS hierarchy and resolution', 'HTTP vs HTTPS', 'FTP, SMTP, POP3, IMAP', 'DHCP operation', 'REST API basics'] },
        ],
        cos: [
          'Understand OSI and TCP/IP network architectures',
          'Analyse data link layer protocols and error control',
          'Apply IP addressing and routing in network design',
          'Evaluate TCP transport mechanisms',
          'Design application layer services'
        ]
      };

      if (/data.?struct/i.test(s)) return {
        units: [
          { name: 'Arrays and Linked Lists', topics: ['Array operations and time complexity', 'Singly and doubly linked lists', 'Circular linked list operations', 'Dynamic memory allocation', 'Array vs linked list comparison'] },
          { name: 'Stacks and Queues', topics: ['Stack push/pop operations', 'Infix to postfix/prefix conversion', 'Expression evaluation using stack', 'Queue: circular, deque, priority queue', 'Applications of stack and queue'] },
          { name: 'Trees', topics: ['Binary tree traversals: inorder, preorder, postorder', 'Binary Search Tree: insert, delete, search', 'AVL tree rotations: LL, RR, LR, RL', 'Heap: min-heap, max-heap, heapsort', 'B-tree and B+ tree'] },
          { name: 'Graphs', topics: ['Graph representations: adjacency matrix and list', 'BFS and DFS traversal algorithms', 'Minimum Spanning Tree: Kruskal and Prim', 'Shortest path: Dijkstra and Floyd-Warshall', 'Topological sorting'] },
          { name: 'Sorting and Hashing', topics: ['Bubble, selection, insertion sort', 'Quick sort and merge sort with complexity', 'Hash functions: division, multiplication', 'Collision handling: chaining, open addressing', 'Comparison of sorting algorithms'] },
        ],
        cos: [
          'Analyse time and space complexity of data structures',
          'Implement linear data structures for real problems',
          'Apply tree structures for efficient searching and sorting',
          'Use graph algorithms to solve network problems',
          'Evaluate hashing and sorting strategies'
        ]
      };

      if (/dbms|database/i.test(s)) return {
        units: [
          { name: 'ER Model and Relational Model', topics: ['Entities, attributes and relationships', 'ER diagram notation and mapping rules', 'Relational algebra: select, project, join', 'Keys: primary, foreign, candidate, super', 'ER to relational schema conversion'] },
          { name: 'SQL', topics: ['DDL: CREATE, ALTER, DROP', 'DML: INSERT, UPDATE, DELETE, SELECT', 'Types of joins: inner, outer, natural, cross', 'Aggregate functions: COUNT, SUM, AVG, MAX, MIN', 'Subqueries and correlated queries'] },
          { name: 'Normalization', topics: ['Functional dependencies and Armstrong axioms', '1NF, 2NF, 3NF definitions and examples', 'BCNF and its differences from 3NF', 'Lossless join and dependency preservation', '4NF and multivalued dependencies'] },
          { name: 'Transaction Management', topics: ['ACID properties explained', 'Concurrency problems: dirty read, phantom read', 'Two-phase locking protocol', 'Deadlock detection and prevention', 'Transaction recovery and rollback'] },
          { name: 'Indexing and File Organization', topics: ['B-tree and B+ tree indexing', 'Dense vs sparse indexing', 'Hashing in databases: static and dynamic', 'Sequential and random file organization', 'Query optimization basics'] },
        ],
        cos: [
          'Design ER diagrams for real-world database problems',
          'Write complex SQL queries with joins and subqueries',
          'Apply normalization techniques to database design',
          'Analyse transaction management and concurrency control',
          'Implement indexing strategies for query optimization'
        ]
      };

      // Generic for any other subject
      return {
        units: [
          { name: subject + ' Fundamentals', topics: ['Introduction and scope of ' + subject, 'Core concepts and key definitions', 'Historical development and motivation', 'Real-world applications'] },
          { name: 'Core Principles', topics: ['Fundamental theories and models', 'Standard architectures and frameworks', 'Protocols and interfaces', 'Design principles and best practices'] },
          { name: 'Advanced Topics', topics: ['Advanced algorithms and techniques', 'Performance analysis', 'Security considerations', 'Optimization strategies'] },
          { name: 'Implementation', topics: ['Tools and environments', 'Practical implementation', 'Testing and validation', 'Case studies and examples'] },
          { name: 'Applications and Trends', topics: ['Industry applications', 'Integration with other technologies', 'Current research directions', 'Future scope and challenges'] },
        ],
        cos: [
          'Understand fundamental concepts of ' + subject,
          'Analyse and apply core principles',
          'Implement solutions using ' + subject + ' techniques',
          'Evaluate performance, security and trade-offs',
          'Design and develop ' + subject + '-based applications'
        ]
      };
    }

    // -- IA Timetable: Student load --
    window.loadIATimetable = async function () {
      const display = document.getElementById('ia-timetable-display');
      if (!display) return;
      display.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:28px;margin-bottom:8px;">⏳</div><div style="color:#9ca3af;font-size:13px;">Loading timetable…</div></div>';
      try {
        const studentYear = window._currentStudentYear || '';
        const studentSem = window._currentStudentSem || '';
        const studentSec = window._currentStudentSection || '';
        const key = studentYear && studentSem && studentSec
          ? 'ia_timetable_Y' + studentYear + '_S' + studentSem + '_' + studentSec
          : 'ia_timetable';
        const sharedKey = studentYear && studentSem
          ? 'ia_timetable_Y' + studentYear + '_S' + studentSem + '_AB'
          : null;

        let snap = await getDoc(doc(hDb, 'settings', key));
        if ((!snap.exists() || !snap.data().imageBase64) && sharedKey) {
          snap = await getDoc(doc(hDb, 'settings', sharedKey));
        }
        if ((!snap.exists() || !snap.data().imageBase64) && key !== 'ia_timetable') {
          snap = await getDoc(doc(hDb, 'settings', 'ia_timetable'));
        }

        if (snap.exists() && snap.data().imageBase64) {
          const d = snap.data();
          const label = d.section ? 'Year ' + d.year + ' · Sem ' + d.sem + ' · Section ' + d.section : 'General';
          const dateStr = d.uploadedAt ? new Date(d.uploadedAt.seconds * 1000).toLocaleDateString('en-IN') : 'Recently';
          display.innerHTML =
            '<div style="border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 2px 12px rgba(0,0,0,0.07);">' +
            '<div style="background:#f7f8fc;padding:10px 14px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">' +
            '<span style="font-size:12px;font-weight:700;color:#6b7280;">📌 ' + label + ' · Uploaded: ' + dateStr + '</span>' +
            '<a href="' + d.imageBase64 + '" download="IA_Timetable.png" style="font-size:11px;font-weight:700;color:#3d5af1;text-decoration:none;background:#eff2fe;padding:4px 10px;border-radius:20px;border:1px solid #c7d2fe;">⬇️ Download</a>' +
            '</div>' +
            '<img src="' + d.imageBase64 + '" style="width:100%;display:block;" alt="IA Timetable"/>' +
            '</div>';
        } else {
          display.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;"><div style="font-size:48px;margin-bottom:12px;">🗓️</div><div style="font-weight:700;font-size:15px;color:#6b7280;">No timetable uploaded yet</div><div style="font-size:12px;margin-top:6px;">Your admin will upload the IA timetable here</div></div>';
        }
      } catch (e) {
        display.innerHTML = '<div style="text-align:center;padding:30px;color:#f87171;font-size:13px;">Error loading. Check connection.</div>';
      }
    };

    window.adminUploadIATimetable = async function () {
      const fileInput = document.getElementById('ia-tt-file');
      const msgEl = document.getElementById('ia-tt-msg');
      const btn = document.getElementById('ia-tt-btn');
      const year = document.getElementById('ia-tt-year')?.value;
      const sem = document.getElementById('ia-tt-sem')?.value;
      const secs = getIASelectedSections();
      if (!year || !sem || !secs.length) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Please select Year, Semester and at least one Section first.</span>';
        return;
      }
      if (!fileInput || !fileInput.files[0]) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Please select an image first.</span>';
        return;
      }
      const file = fileInput.files[0];
      if (file.size > 20 * 1024 * 1024) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">Image too large. Max 20MB.</span>';
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const img = new Image();
          img.onload = async function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

            // If both A and B selected with same timetable, store one shared doc
            const sortedSecs = [...secs].sort();
            const isShared = sortedSecs.length === 2 && sortedSecs[0] === 'A' && sortedSecs[1] === 'B';
            if (isShared) {
              const key = 'ia_timetable_Y' + year + '_S' + sem + '_AB';
              await setDoc(doc(hDb, 'settings', key), {
                imageBase64: compressedBase64,
                year, sem, section: 'A & B',
                uploadedAt: serverTimestamp(),
                uploadedBy: window._currentAdminId || 'admin'
              });
            } else {
              for (const sec of secs) {
                const key = 'ia_timetable_Y' + year + '_S' + sem + '_' + sec;
                await setDoc(doc(hDb, 'settings', key), {
                  imageBase64: compressedBase64,
                  year, sem, section: sec,
                  uploadedAt: serverTimestamp(),
                  uploadedBy: window._currentAdminId || 'admin'
                });
              }
            }
            if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Uploaded for Year ' + year + ' · Sem ' + sem + ' · Section(s) ' + secs.join(', ') + (isShared ? ' (shared single doc)' : '') + '!</span>';
            if (btn) { btn.disabled = false; btn.textContent = '📤 Upload Timetable'; }
            const preview = document.getElementById('ia-tt-preview');
            if (preview) { preview.src = compressedBase64; preview.style.display = 'block'; }
            adminLoadIATimetablePreview();
          };
          img.onerror = () => { throw new Error("Invalid image file"); };
          img.src = e.target.result;
        } catch (err) {
          if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">Error: ' + err.message + '</span>';
          if (btn) { btn.disabled = false; btn.textContent = '📤 Upload Timetable'; }
        }
      };
      reader.readAsDataURL(file);
    };

    window.adminLoadIATimetablePreview = async function () {
      const display = document.getElementById('ia-tt-current-display');
      if (!display) return;
      display.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">⏳ Loading all uploaded timetables…</div>';
      try {
        const { getDocs, collection: col2 } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
        const settingsSnap = await getDocs(col2(hDb, 'settings'));
        const timetables = [];
        settingsSnap.forEach(docSnap => {
          if (docSnap.id.startsWith('ia_timetable') && docSnap.data().imageBase64) {
            timetables.push({ id: docSnap.id, ...docSnap.data() });
          }
        });
        if (timetables.length === 0) {
          display.innerHTML = '<div style="text-align:center;padding:20px;color:#9ca3af;font-size:13px;">No timetables uploaded yet</div>';
          return;
        }
        let html = '<div style="display:grid;gap:12px;">';
        timetables.forEach(d => {
          const label = d.section ? 'Year ' + d.year + ' · Sem ' + d.sem + ' · Section ' + d.section : 'General Timetable';
          const dateStr = d.uploadedAt ? new Date(d.uploadedAt.seconds * 1000).toLocaleDateString('en-IN') : 'Recently';
          html += '<div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">' +
            '<div style="background:#f7f8fc;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">' +
            '<span style="font-size:12px;font-weight:700;color:#7c3aed;">📌 ' + label + '</span>' +
            '<span style="font-size:11px;color:#6b7280;">Uploaded: ' + dateStr + '</span>' +
            '</div><img src="' + d.imageBase64 + '" style="width:100%;display:block;"/></div>';
        });
        html += '</div>';
        display.innerHTML = html;
      } catch (e) { display.innerHTML = '<div style="color:#f87171;font-size:13px;">Error loading. Try again.</div>'; }
    };

    window.adminDeleteIATimetable = async function () {
      const year = document.getElementById('ia-tt-year')?.value;
      const sem = document.getElementById('ia-tt-sem')?.value;
      const secs = getIASelectedSections();
      const msgEl = document.getElementById('ia-tt-msg');
      if (!year || !sem || !secs.length) {
        if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">⚠️ Please select Year, Semester and at least one Section to remove.</span>';
        return;
      }
      if (!confirm('Remove timetable for Year ' + year + ', Sem ' + sem + ', Section(s) ' + secs.join(', ') + '?')) return;
      try {
        for (const sec of secs) {
          const key = 'ia_timetable_Y' + year + '_S' + sem + '_' + sec;
          await setDoc(doc(hDb, 'settings', key), { imageBase64: null, deletedAt: serverTimestamp() });
        }
        if (msgEl) msgEl.innerHTML = '<span style="color:#10b981;">✅ Removed Sec ' + secs.join(', ') + '.</span>';
        adminLoadIATimetablePreview();
      } catch (e) { if (msgEl) msgEl.innerHTML = '<span style="color:#f87171;">Error: ' + e.message + '</span>'; }
    };

    function renderSecureText(container, text) {
      container.textContent = '';
      if (!text) return;
      // Split by bold markdown and newlines
      const parts = text.split(/(\*\*.+?\*\*|\n)/g);
      parts.forEach(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const b = document.createElement('strong');
          b.style.color = '#3d5af1';
          b.textContent = part.slice(2, -2);
          container.appendChild(b);
        } else if (part === '\n') {
          container.appendChild(document.createElement('br'));
        } else if (part) {
          container.appendChild(document.createTextNode(part));
        }
      });
    }

    function mkBubble(data, isOwn) {
      const row = document.createElement('div');
      row.className = 'hc-row ' + (isOwn ? 'own' : 'bot');
      const av = document.createElement('div');
      av.className = 'hc-av ' + (isOwn ? 'stu-av' : 'bot-av');
      av.textContent = isOwn ? 'S' : 'B';
      const bub = document.createElement('div');
      bub.className = 'hc-bub ' + (isOwn ? 'own-bub' : 'bot-bub');
      if (!isOwn) {
        const nm = document.createElement('div');
        nm.className = 'hc-bot-name';
        nm.textContent = data.senderName || 'TechBook Bot';
        bub.appendChild(nm);
      }
      const txt = document.createElement('div');
      renderSecureText(txt, data.message || '');
      bub.appendChild(txt);
      const ts = document.createElement('div');
      ts.className = 'hc-ts';
      const d = data.createdAt?.toDate?.();
      ts.textContent = d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
      bub.appendChild(ts);
      row.appendChild(av);
      row.appendChild(bub);
      return row;
    }

    const scrollBot = () => { const b = document.getElementById('hc-messages'); if (b) b.scrollTop = b.scrollHeight; };
    const showTyping = () => { const t = document.getElementById('hc-typing'); if (t) { t.style.display = 'block'; scrollBot(); } };
    const hideTyping = () => { const t = document.getElementById('hc-typing'); if (t) t.style.display = 'none'; };

    function startListen() { if (hUnsub) { hUnsub(); hUnsub = null; } try { const q = query(collection(hDb, 'help_messages', tid(), 'msgs'), orderBy('createdAt', 'asc')); hUnsub = onSnapshot(q, snap => { const box = document.getElementById('hc-messages'); const typing = document.getElementById('hc-typing'); if (!box || !typing) return; Array.from(box.querySelectorAll('.hc-row:not(#hc-welcome-msg)')).forEach(el => el.remove()); snap.forEach(d => { if (d.id !== '__typing__') { const el = mkBubble(d.data(), d.data().senderRole === 'student'); box.insertBefore(el, typing); } }); scrollBot(); }, e => console.warn('HC:', e)); } catch (e) { console.warn('HC Firebase:', e); } }

    window._hcOpen = window.openHelpCenter = function () {
      if (!auth.currentUser) {
        alert('🔐 Please log in to your student account to access the Help Center.');
        return;
      }
      const modal = document.getElementById('help-center-modal');
      if (modal) { modal.classList.add('hc-flex'); document.body.style.overflow = 'hidden'; }
      setTimeout(() => document.getElementById('hc-card')?.classList.add('hc-open'), 20);
      if (typeof window.loadAIKey === 'function') window.loadAIKey();
      startListen();
      setTimeout(() => speak('Welcome to TechBook Help Center. How can I assist you today?'), 700);
    };
    window._hcClose = window.closeHelpCenter = function () { document.getElementById('hc-card')?.classList.remove('hc-open'); setTimeout(() => { const m = document.getElementById('help-center-modal'); if (m) m.classList.remove('hc-flex'); document.body.style.overflow = ''; }, 420); try { window.speechSynthesis?.cancel(); } catch (e) { } if (voiceRecog) { try { voiceRecog.stop(); } catch (e) { } } };
    window.hcQuick = function (text) { const inp = document.getElementById('hc-input'); if (inp) inp.value = text; window._hcSend(); };

    window._hcSend = window.sendHelpMessage = async function () {
      const inp = document.getElementById('hc-input');
      const msg = (inp?.value || '').trim();
      if (!msg) return;
      const btn = document.getElementById('hc-send-btn');
      if (btn) { btn.disabled = true; btn.style.opacity = '0.38'; }
      inp.value = ''; inp.style.height = 'auto';
      const t = tid(), usn = window._currentStudentUSN || 'anonymous', name = window._currentStudentName || usn;
      const box = document.getElementById('hc-messages');
      const typing = document.getElementById('hc-typing');
      // Show user's message immediately
      if (box && typing) { const lm = mkBubble({ message: msg, senderRole: 'student', senderName: name }, true); box.insertBefore(lm, typing); scrollBot(); }
      // Re-enable send button right away
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
      // Save to Firebase (non-blocking)
      try {
        addDoc(collection(hDb, 'help_messages', t, 'msgs'), { message: msg, senderRole: 'student', senderUSN: usn, senderName: name, createdAt: serverTimestamp() });
        setDoc(doc(hDb, 'help_threads', t), { threadId: t, studentUSN: usn, studentName: name, lastMessage: msg, updatedAt: serverTimestamp(), status: 'open' }, { merge: true });
      } catch (e) { }
      showTyping();
      // Use local AI engine — works offline, no API key needed
      try {
        const reply = await getAIReply(msg);
        hideTyping();
        const botBub = mkBubble({ message: reply, senderRole: 'bot', senderName: 'TechBook Bot' }, false);
        const typingEl = document.getElementById('hc-typing');
        const boxEl = document.getElementById('hc-messages');
        if (boxEl && typingEl) { boxEl.insertBefore(botBub, typingEl); scrollBot(); }
        // Save bot reply to Firebase (non-blocking)
        try {
          addDoc(collection(hDb, 'help_messages', t, 'msgs'), { message: reply, senderRole: 'bot', senderName: 'TechBook Bot', createdAt: serverTimestamp() });
          setDoc(doc(hDb, 'help_threads', t), { lastBotReply: reply, updatedAt: serverTimestamp() }, { merge: true });
        } catch (e) { }
        speak(reply.replace(/<[^>]*>/g, ''));
      } catch (e) {
        hideTyping();
        console.error('Chat error:', e);
      }
    };

