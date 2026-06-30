/**
 * TechBook Email & Notification Server
 * =====================================
 * Run: node server.js
 * Serves the static frontend on / and provides email APIs on /api
 *
 * OTPs are stored in server memory (not Firestore) to avoid permission issues.
 * After OTP is verified, the frontend updates Firestore directly via Firebase client SDK.
 */

require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// ─── In-Memory OTP Store ───
// key: USN (uppercase), value: { otp, email, expiresAt, attempts, name }
const otpStore = new Map();

// Auto-cleanup expired OTPs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expiresAt < now) otpStore.delete(key);
  }
}, 10 * 60 * 1000);

// ─── Middleware ───
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// ─── Rate Limiting ───
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, error: 'Too many OTP requests. Please wait 15 minutes.' }
});
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: 'Too many verification attempts.' }
});

// ─── Email Transporter ───
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ─── Firestore REST API Helpers (for notification queries only) ───
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

function parseField(fieldObj) {
  if (!fieldObj) return null;
  const type = Object.keys(fieldObj)[0];
  const val = fieldObj[type];
  if (type === 'booleanValue') return val;
  if (type === 'integerValue') return parseInt(val);
  if (type === 'doubleValue') return parseFloat(val);
  if (type === 'arrayValue') return (val.values || []).map(parseField);
  if (type === 'mapValue') {
    const obj = {};
    for (const [k, v] of Object.entries(val.fields || {})) obj[k] = parseField(v);
    return obj;
  }
  return val;
}

function parseDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = { _id: doc.name ? doc.name.split('/').pop() : null };
  for (const [k, v] of Object.entries(doc.fields)) obj[k] = parseField(v);
  return obj;
}

// ─── Read Email Template & Replace Placeholders ───
function loadTemplate(filename, replacements) {
  const templatePath = path.join(process.cwd(), 'email-templates', filename);
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [key, val] of Object.entries(replacements)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), val != null ? val : '');
  }
  return html;
}

// ─── Helpers ───
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── API ROUTES ───

/**
 * POST /api/send-otp
 * Generates a 6-digit OTP, stores it in server memory, and sends it by email.
 */
app.post('/api/send-otp', otpLimiter, async (req, res) => {
  const { usn, email, name } = req.body;

  if (!usn || !email) {
    return res.status(400).json({ success: false, error: 'USN and email are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }

  const usnUpper = usn.trim().toUpperCase();
  const emailLower = email.trim().toLowerCase();

  try {
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now

    // Store OTP in memory
    otpStore.set(usnUpper, {
      otp,
      email: emailLower,
      name: name || usnUpper,
      expiresAt,
      attempts: 0
    });

    console.log(`📨 OTP for ${usnUpper}: ${otp} (expires in 5 min)`);

    // Send OTP email
    const studentName = name || usnUpper;
    const html = loadTemplate('otp.html', {
      STUDENT_NAME: studentName,
      OTP_CODE: otp,
      APP_URL
    });

    await transporter.sendMail({
      from: `"TechBook" <${process.env.SMTP_EMAIL}>`,
      to: emailLower,
      subject: `${otp} — Your TechBook Verification Code`,
      html
    });

    console.log(`✅ OTP email sent to ${emailLower} for USN ${usnUpper}`);
    res.json({ success: true, message: 'OTP sent! Check your inbox (and spam folder).' });

  } catch (err) {
    console.error('Send OTP error:', err.message);
    // Still store OTP even if email fails (allow retry)
    res.status(500).json({ success: false, error: 'Failed to send OTP email. Check SMTP credentials.' });
  }
});

/**
 * POST /api/verify-otp
 * Verifies the submitted OTP against the in-memory store.
 * Returns success + the verified email so the frontend can update Firestore directly.
 */
app.post('/api/verify-otp', verifyLimiter, async (req, res) => {
  const { usn, otp } = req.body;

  if (!usn || !otp) {
    return res.status(400).json({ success: false, error: 'USN and OTP are required.' });
  }

  const usnUpper = usn.trim().toUpperCase();
  const otpStr = otp.toString().trim();

  const record = otpStore.get(usnUpper);

  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'No OTP found for this USN. Please request a new one.',
      code: 'OTP_NOT_FOUND'
    });
  }

  // Check expiry
  if (record.expiresAt < Date.now()) {
    otpStore.delete(usnUpper);
    return res.status(400).json({
      success: false,
      error: 'OTP has expired. Please request a new one.',
      code: 'OTP_EXPIRED'
    });
  }

  // Check attempts
  if (record.attempts >= 3) {
    otpStore.delete(usnUpper);
    return res.status(429).json({
      success: false,
      error: 'Too many incorrect attempts. Please request a new OTP.',
      code: 'TOO_MANY_ATTEMPTS'
    });
  }

  // Verify OTP
  if (record.otp !== otpStr) {
    record.attempts++;
    const remaining = 3 - record.attempts;
    return res.status(400).json({
      success: false,
      error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      code: 'WRONG_OTP'
    });
  }

  // ✅ OTP is correct — remove from store and return verified email
  const verifiedEmail = record.email;
  otpStore.delete(usnUpper);

  console.log(`✅ OTP verified for USN ${usnUpper}: ${verifiedEmail}`);
  res.json({
    success: true,
    message: 'Email verified successfully!',
    email: verifiedEmail
  });
});

/**
 * POST /api/notify-upload
 * Sends content upload notification emails to eligible students.
 */
app.post('/api/notify-upload', async (req, res) => {
  const { contentType, subject, title, dept, year, sem, section } = req.body;

  if (!contentType || !subject || !dept || !year || !sem) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }

  try {
    const filters = [
      { fieldFilter: { field: { fieldPath: 'year' }, op: 'EQUAL', value: { stringValue: String(year) } } },
      { fieldFilter: { field: { fieldPath: 'sem' }, op: 'EQUAL', value: { stringValue: String(sem) } } },
      { fieldFilter: { field: { fieldPath: 'email_verified' }, op: 'EQUAL', value: { booleanValue: true } } }
    ];

    if (dept && dept !== 'All') {
      filters.push({ fieldFilter: { field: { fieldPath: 'dept' }, op: 'EQUAL', value: { stringValue: dept } } });
    }

    const queryResult = await firestoreRunQuery({
      structuredQuery: {
        from: [{ collectionId: 'students' }],
        where: { compositeFilter: { op: 'AND', filters } }
      }
    });

    if (!Array.isArray(queryResult.data)) return res.json({ success: true, sentCount: 0 });

    const students = queryResult.data
      .filter(r => r.document)
      .map(r => parseDoc(r.document));

    const targetStudents = students.filter(s => {
      if (!section || section === 'all') return true;
      const secs = section.split(',').map(x => x.trim());
      return secs.includes('all') || secs.includes(s.section);
    });

    const icons = { 'Notes': '📄', 'Question Bank': '📝', 'PYQ': '📋' };
    const icon = icons[contentType] || '📁';
    const uploadDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

    // Send response instantly to the frontend to eliminate loading delay
    res.json({ success: true, sentCount: targetStudents.length, total: targetStudents.length });

    // Send emails asynchronously in the background
    (async () => {
      let sentCount = 0;
      for (const student of targetStudents) {
        if (!student.email) continue;
        try {
          const html = loadTemplate('content-upload.html', {
            STUDENT_NAME: student.name || student.usn,
            CONTENT_TYPE: contentType,
            CONTENT_ICON: icon,
            SUBJECT: subject,
            TITLE: title || subject,
            DEPT: dept,
            YEAR: String(year),
            SEM: String(sem),
            UPLOAD_DATE: uploadDate,
            APP_URL
          });
          await transporter.sendMail({
            from: `"TechBook" <${process.env.SMTP_EMAIL}>`,
            to: student.email,
            subject: `New ${contentType} Uploaded: ${subject} — TechBook`,
            html
          });
          sentCount++;
        } catch (emailErr) {
          console.error(`Failed email to ${student.email}:`, emailErr.message);
        }
      }
      console.log(`✅ Background upload notification complete: ${sentCount}/${targetStudents.length} emails sent`);
    })().catch(err => console.error('Background upload email loop failed:', err));

  } catch (err) {
    console.error('Notify upload error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send notifications.' });
  }
});

/**
 * POST /api/notify-quiz
 * Sends quiz published notification to eligible students.
 */
app.post('/api/notify-quiz', async (req, res) => {
  const { quizName, subject, questionCount, duration, difficulty, instructions, dept, year, sem } = req.body;

  if (!quizName || !subject || !dept || !year || !sem) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }

  try {
    const filters = [
      { fieldFilter: { field: { fieldPath: 'year' }, op: 'EQUAL', value: { stringValue: String(year) } } },
      { fieldFilter: { field: { fieldPath: 'sem' }, op: 'EQUAL', value: { stringValue: String(sem) } } },
      { fieldFilter: { field: { fieldPath: 'email_verified' }, op: 'EQUAL', value: { booleanValue: true } } }
    ];

    if (dept && dept !== 'All') {
      filters.push({ fieldFilter: { field: { fieldPath: 'dept' }, op: 'EQUAL', value: { stringValue: dept } } });
    }

    const queryResult = await firestoreRunQuery({
      structuredQuery: {
        from: [{ collectionId: 'students' }],
        where: { compositeFilter: { op: 'AND', filters } }
      }
    });

    if (!Array.isArray(queryResult.data)) return res.json({ success: true, sentCount: 0 });

    const students = queryResult.data.filter(r => r.document).map(r => parseDoc(r.document));
    const timeLbl = duration > 0 ? `${duration} min/Question` : 'No time limit';

    let sentCount = 0;
    for (const student of students) {
      if (!student.email) continue;
      try {
        const html = loadTemplate('quiz-published.html', {
          STUDENT_NAME: student.name || student.usn,
          QUIZ_NAME: quizName,
          SUBJECT: subject,
          QUESTION_COUNT: String(questionCount || '?'),
          DURATION: timeLbl,
          DIFFICULTY: difficulty || 'Medium',
          INSTRUCTIONS: instructions || '',
          APP_URL
        });
        await transporter.sendMail({
          from: `"TechBook" <${process.env.SMTP_EMAIL}>`,
          to: student.email,
          subject: `New Quiz: ${quizName} (${subject}) — TechBook`,
          html
        });
        sentCount++;
      } catch (emailErr) {
        console.error(`Failed email to ${student.email}:`, emailErr.message);
      }
    }

    console.log(`✅ Quiz notification: ${sentCount}/${students.length} emails sent`);
    res.json({ success: true, sentCount, total: students.length });

  } catch (err) {
    console.error('Notify quiz error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send quiz notifications.' });
  }
});

/**
 * POST /api/notify-quiz-result
 * Sends quiz result email to a single student (using their verified email from request body).
 */
app.post('/api/notify-quiz-result', async (req, res) => {
  const { usn, studentEmail, studentName, quizName, subject, marksObtained, totalMarks, percentage, completionTime } = req.body;

  if (!usn || !quizName) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }

  const email = studentEmail;
  if (!email || !isValidEmail(email)) {
    return res.status(200).json({ success: false, error: 'Student has no verified email.' });
  }

  try {
    const pct = percentage || Math.round((marksObtained / totalMarks) * 100);
    const passed = pct >= 40;

    const html = loadTemplate('quiz-result.html', {
      STUDENT_NAME: studentName || usn,
      QUIZ_NAME: quizName,
      SUBJECT: subject || '',
      MARKS_OBTAINED: String(marksObtained),
      TOTAL_MARKS: String(totalMarks),
      PERCENTAGE: String(pct),
      PASS_FAIL: passed ? 'PASSED' : 'FAILED',
      COMPLETION_TIME: completionTime || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      RESULT_BORDER: passed ? '#10b981' : '#ef4444',
      RESULT_GRADIENT: passed ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,#ef4444,#f87171)',
      SCORE_BG: passed ? '#f0fdf4' : '#fef2f2',
      SCORE_BORDER: passed ? '#10b981' : '#ef4444',
      SCORE_COLOR: passed ? '#059669' : '#dc2626',
      STATUS_BG: passed ? '#d1fae5' : '#fee2e2',
      APP_URL
    });

    await transporter.sendMail({
      from: `"TechBook" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: `Your Quiz Result: ${quizName} — ${pct}% ${passed ? '✅ Passed' : '❌ Failed'}`,
      html
    });

    console.log(`✅ Quiz result email sent to ${email} for ${usn}`);
    res.json({ success: true, message: 'Result email sent.' });

  } catch (err) {
    console.error('Notify quiz result error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send result email.' });
  }
});

// ─── Serve index.html for all unmatched routes ───
app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'index.html'));
});

// ─── Start Server ───
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 TechBook Server running at http://localhost:${PORT}`);
    console.log(`📧 SMTP Email: ${process.env.SMTP_EMAIL}`);
    console.log(`🔥 Firebase Project: ${FIREBASE_PROJECT_ID}\n`);
  });
}

// Export for Vercel serverless function wrapper
module.exports = app;
