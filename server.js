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
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// ─── Firestore OTP Helpers (for Serverless statelessness) ───
function firestoreSaveOTP(usn, data) {
  return new Promise((resolve, reject) => {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
      return resolve({ status: 500, error: 'Firebase project ID or API key environment variables are missing.' });
    }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/otp_${usn}?key=${FIREBASE_API_KEY}`;
    const urlObj = new URL(url);
    const body = JSON.stringify({
      fields: {
        otp: { stringValue: data.otp },
        email: { stringValue: data.email },
        name: { stringValue: data.name },
        expiresAt: { integerValue: String(data.expiresAt) },
        attempts: { integerValue: String(data.attempts) }
      }
    });

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: responseData });
      });
    });
    req.on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });
    req.write(body);
    req.end();
  });
}

function firestoreGetOTP(usn) {
  return new Promise((resolve, reject) => {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
      return resolve({ status: 500, error: 'Firebase project ID or API key environment variables are missing.' });
    }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/otp_${usn}?key=${FIREBASE_API_KEY}`;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET'
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve({ status: 200, record: parseDoc(JSON.parse(data)) });
          } catch (e) {
            resolve({ status: 500, error: 'Failed to parse Firestore document.' });
          }
        } else if (res.statusCode === 404) {
          resolve({ status: 404, record: null });
        } else {
          resolve({ status: res.statusCode, error: `Firestore API returned status ${res.statusCode}`, raw: data });
        }
      });
    });
    req.on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });
    req.end();
  });
}

function firestoreDeleteOTP(usn) {
  return new Promise((resolve, reject) => {
    if (!FIREBASE_PROJECT_ID || !FIREBASE_API_KEY) {
      return resolve({ status: 500, error: 'Firebase project ID or API key environment variables are missing.' });
    }
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/otp_${usn}?key=${FIREBASE_API_KEY}`;
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'DELETE'
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 204) {
          resolve({ status: res.statusCode, success: true });
        } else {
          resolve({ status: res.statusCode, success: false, error: `Delete failed with status ${res.statusCode}` });
        }
      });
    });
    req.on('error', (err) => {
      resolve({ status: 500, success: false, error: err.message });
    });
    req.end();
  });
}

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
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

const SMTP_SENDER = process.env.SMTP_SENDER || 'techbook.ac.in@gmail.com';

function sendEmail({ to, subject, html }) {
  if (process.env.SMTP_HOST && process.env.SMTP_HOST.includes('brevo')) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        sender: { name: 'TechBook', email: SMTP_SENDER },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
      });

      const options = {
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.SMTP_PASSWORD,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', chunk => responseBody += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            reject(new Error(`Brevo API Error: ${res.statusCode} - ${responseBody}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  } else {
    return transporter.sendMail({
      from: `"TechBook" <${SMTP_SENDER}>`,
      to,
      subject,
      html
    });
  }
}

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

    // Store OTP in Firestore (Serverless stateless fix)
    const saveRes = await firestoreSaveOTP(usnUpper, {
      otp,
      email: emailLower,
      name: name || usnUpper,
      expiresAt,
      attempts: 0
    });

    if (saveRes.status !== 200 && saveRes.status !== 201) {
      console.error(`❌ Firestore Save OTP Failed:`, saveRes);
      return res.status(500).json({ 
        success: false, 
        error: `Database error: Failed to save OTP. ${saveRes.error || 'Check server configuration.'}`
      });
    }

    console.log(`📨 OTP for ${usnUpper}: ${otp} (expires in 5 min)`);

    // Send OTP email
    const studentName = name || usnUpper;
    const clientOrigin = req.headers.origin || req.get('origin') || APP_URL;
    const html = loadTemplate('otp.html', {
      STUDENT_NAME: studentName,
      OTP_CODE: otp,
      APP_URL: clientOrigin
    });

    await sendEmail({
      to: emailLower,
      subject: `${otp} — Your TechBook Verification Code`,
      html
    });

    console.log(`✅ OTP email sent to ${emailLower} for USN ${usnUpper}`);
    res.json({ success: true, message: 'OTP sent! Check your inbox (and spam folder).' });

  } catch (err) {
    console.error('Send OTP error:', err.message);
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

  const getRes = await firestoreGetOTP(usnUpper);

  if (getRes.status !== 200 && getRes.status !== 404) {
    console.error(`❌ Firestore Get OTP Failed for ${usnUpper}:`, getRes);
    return res.status(500).json({
      success: false,
      error: `Database connection error: ${getRes.error || 'Please try again.'}`,
      code: 'DB_ERROR'
    });
  }

  const record = getRes.record;

  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'No OTP found for this USN. Please request a new one.',
      code: 'OTP_NOT_FOUND'
    });
  }

  // Check expiry
  if (record.expiresAt < Date.now()) {
    await firestoreDeleteOTP(usnUpper);
    return res.status(400).json({
      success: false,
      error: 'OTP has expired. Please request a new one.',
      code: 'OTP_EXPIRED'
    });
  }

  // Check attempts
  if (record.attempts >= 3) {
    await firestoreDeleteOTP(usnUpper);
    return res.status(429).json({
      success: false,
      error: 'Too many incorrect attempts. Please request a new OTP.',
      code: 'TOO_MANY_ATTEMPTS'
    });
  }

  // Verify OTP
  if (record.otp !== otpStr) {
    record.attempts++;
    await firestoreSaveOTP(usnUpper, record);
    const remaining = 3 - record.attempts;
    return res.status(400).json({
      success: false,
      error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      code: 'WRONG_OTP'
    });
  }

  // ✅ OTP is correct — remove from store and return verified email
  const verifiedEmail = record.email;
  await firestoreDeleteOTP(usnUpper);

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

    // Send emails synchronously before responding (required for Serverless environment like Vercel)
    let sentCount = 0;
    for (const student of targetStudents) {
      if (!student.email) continue;
      try {
        const clientOrigin = req.headers.origin || req.get('origin') || APP_URL;
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
          APP_URL: clientOrigin
        });
        await sendEmail({
          to: student.email,
          subject: `New ${contentType} Uploaded: ${subject} — TechBook`,
          html
        });
        sentCount++;
      } catch (emailErr) {
        console.error(`Failed email to ${student.email}:`, emailErr.message);
      }
    }

    console.log(`✅ Upload notification complete: ${sentCount}/${targetStudents.length} emails sent`);
    res.json({ success: true, sentCount, total: targetStudents.length });

  } catch (err) {
    console.error('Notify upload error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send notifications.' });
  }
});

/**
 * POST /api/notify-promo
 * Sends promo upload notification emails to all verified students.
 */
app.post('/api/notify-promo', async (req, res) => {
  const { title, description, mediaUrl, mediaType } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Promo title is required.' });
  }

  try {
    const queryResult = await firestoreRunQuery({
      structuredQuery: {
        from: [{ collectionId: 'students' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'email_verified' },
            op: 'EQUAL',
            value: { booleanValue: true }
          }
        }
      }
    });

    if (!Array.isArray(queryResult.data)) {
      return res.json({ success: true, sentCount: 0 });
    }

    const students = queryResult.data
      .filter(r => r.document)
      .map(r => parseDoc(r.document));

    // Construct the promo media html block to embed in the email
    let mediaHtml = '';
    const isPublicUrl = mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://'));

    if (isPublicUrl) {
      if (mediaType === 'video') {
        mediaHtml = `
          <div style="text-align:center;margin-top:16px;">
            <div style="position:relative;display:inline-block;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.1);background-color:#0f172a;max-width:100%;">
              <video src="${mediaUrl}" style="max-width:100%;height:auto;display:block;" controls></video>
            </div>
          </div>
        `;
      } else {
        mediaHtml = `
          <div style="text-align:center;margin-top:16px;">
            <img src="${mediaUrl}" style="max-width:100%;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.1);display:block;margin:0 auto;" alt="Announcement Banner">
          </div>
        `;
      }
    } else if (mediaUrl) {
      // Chunked base64 or other data URL representation
      mediaHtml = `
        <div style="text-align:center;margin-top:20px;padding:24px;border:2px dashed #bae6fd;border-radius:12px;background-color:#f0f9ff;">
          <span style="font-size:36px;display:block;margin-bottom:8px;">🎬</span>
          <span style="color:#0369a1;font-size:14px;font-weight:700;display:block;">Exclusive Media Attached</span>
          <span style="color:#475569;font-size:12px;display:block;margin-top:4px;">Open TechBook to view the video/image attachment for this promo.</span>
        </div>
      `;
    }

    let sentCount = 0;
    for (const student of students) {
      if (!student.email) continue;
      try {
        const clientOrigin = req.headers.origin || req.get('origin') || APP_URL;
        const html = loadTemplate('promo.html', {
          STUDENT_NAME: student.name || student.usn,
          PROMO_TITLE: title,
          PROMO_DESC: description || 'No description provided.',
          PROMO_MEDIA_HTML: mediaHtml,
          APP_URL: clientOrigin
        });

        await sendEmail({
          to: student.email,
          subject: `📢 New Announcement: ${title} — TechBook`,
          html
        });
        sentCount++;
      } catch (emailErr) {
        console.error(`Failed email to ${student.email}:`, emailErr.message);
      }
    }

    console.log(`✅ Promo notification complete: ${sentCount}/${students.length} emails sent`);
    res.json({ success: true, sentCount, total: students.length });

  } catch (err) {
    console.error('Notify promo error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send promo notifications.' });
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
        const clientOrigin = req.headers.origin || req.get('origin') || APP_URL;
        const html = loadTemplate('quiz-published.html', {
          STUDENT_NAME: student.name || student.usn,
          QUIZ_NAME: quizName,
          SUBJECT: subject,
          QUESTION_COUNT: String(questionCount || '?'),
          DURATION: timeLbl,
          DIFFICULTY: difficulty || 'Medium',
          INSTRUCTIONS: instructions || '',
          APP_URL: clientOrigin
        });
        await sendEmail({
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

    const clientOrigin = req.headers.origin || req.get('origin') || APP_URL;
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
      APP_URL: clientOrigin
    });

    await sendEmail({
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

/**
 * POST /api/notify-founder-message
 * Sends an email notification to the Super Admin (Founder) when Co-Founder sends a message.
 */
app.post('/api/notify-founder-message', async (req, res) => {
  const { senderName, message } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Message content is required.' });
  }

  try {
    const toEmail = process.env.SMTP_EMAIL || 'techbook.ac.in@gmail.com';
    const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    
    const html = `
      <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #f8fafc; padding: 32px; color: #0f172a;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <div style="background: linear-gradient(135deg, #3d5af1, #a855f7); padding: 30px; text-align: center; color: #ffffff;">
            <span style="font-size: 40px; display: block; margin-bottom: 10px;">✉️</span>
            <h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">New Message from Co-Founder</h2>
          </div>
          <div style="padding: 30px;">
            <p style="font-size: 15px; color: #475569; margin-bottom: 20px; line-height: 1.6;">
              Hello <strong>Super Admin / Maqsood M D</strong>,
            </p>
            <p style="font-size: 15px; color: #475569; margin-bottom: 24px; line-height: 1.6;">
              You have received a direct message from Co-Founder <strong>${senderName || 'Chinmay K V'}</strong>:
            </p>
            
            <div style="background-color: #f1f5f9; border-left: 4px solid #3d5af1; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.5; font-style: italic; white-space: pre-wrap;">"${message}"</p>
            </div>
            
            <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
              Sent on: ${dateStr} <br>
              This is an automated notification from TechBook Operations.
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            © ${new Date().getFullYear()} TechBook App. All Rights Reserved.
          </div>
        </div>
      </div>
    `;

    await sendEmail({
      to: toEmail,
      subject: `✉️ New Message from Co-Founder: ${senderName || 'Chinmay K V'}`,
      html
    });

    console.log(`✅ Founder message notification email sent to ${toEmail}`);
    res.json({ success: true, message: 'Notification email sent successfully.' });

  } catch (err) {
    console.error('Founder message notification error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send email notification.' });
  }
});

// ─── Serve index.html for all unmatched routes ───
app.get('/*splat', (req, res) => {
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
