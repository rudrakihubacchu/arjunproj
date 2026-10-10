'use strict';

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && (!sessionSecret || sessionSecret.length < 32 || sessionSecret.includes('replace-with'))) {
  throw new Error('Set SESSION_SECRET to a unique random secret of at least 32 characters before running in production.');
}
const secret = sessionSecret || 'LOCAL-ONLY-CHANGE-ME-campusconnect-session-secret';
const dbDir = path.resolve(process.env.DB_DIR || './data');
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'campusconnect.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    course TEXT NOT NULL DEFAULT 'BCA · Semester 5',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reset_token_hash TEXT,
    reset_expires INTEGER
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS event_interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    event_title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, event_id)
  );
`);

const notices = [
  { id: 'notice-exam', title: 'Semester examination form submission', category: 'Examination', date: '09 Oct 2026', icon: '▤', color: '', text: 'Students are requested to verify their examination details and complete the form submission before the deadline announced by the examination department.' },
  { id: 'notice-workshop', title: 'Web development workshop registration', category: 'Events', date: '08 Oct 2026', icon: '✦', color: 'purple', text: 'A hands-on workshop covering responsive layouts, JavaScript fundamentals, and modern web development practices. Register through the department office.' },
  { id: 'notice-internal', title: 'Internal assessment schedule published', category: 'Academic', date: '07 Oct 2026', icon: '▦', color: 'greenish', text: 'The tentative internal assessment schedule is available. Please confirm subject-wise dates with your class coordinator.' },
  { id: 'notice-placement', title: 'Campus placement preparation session', category: 'Placement', date: '05 Oct 2026', icon: '↗', color: 'purple', text: 'Students interested in placement preparation can attend a session on CV writing, aptitude tests, and interview skills.' }
];
const classes = [
  { time: '09:00 – 10:00', name: 'Web Development', room: 'Lab 02', teacher: 'Practical session', color: '' },
  { time: '10:15 – 11:15', name: 'Database Management', room: 'Room 204', teacher: 'Lecture', color: 'green' },
  { time: '11:30 – 12:30', name: 'Python Programming', room: 'Lab 01', teacher: 'Practical session', color: 'orange' },
  { time: '01:30 – 02:30', name: 'Software Engineering', room: 'Room 105', teacher: 'Lecture', color: 'bluebar' }
];
const timetable = [
  ['09:00', 'Web Development', 'Database Management', 'Python Programming', 'Software Engineering', 'Web Development'],
  ['10:15', 'Python Programming', 'Web Development', 'Database Management', 'Python Programming', 'Database Management'],
  ['11:30', 'Database Management', 'Software Engineering', 'Web Development', 'Software Engineering', 'Python Programming'],
  ['01:30', 'Software Engineering', 'Python Programming', 'Software Engineering', 'Web Development', 'Project Work']
];
const materials = [
  { id: 'web-notes', title: 'Web Development Notes', subject: 'Web Development', type: 'LEARNING GUIDE', icon: '▧', color: '', description: 'HTML structure, CSS styling, JavaScript basics, and responsive design concepts.', size: 'Online resource', url: 'https://developer.mozilla.org/en-US/docs/Learn' },
  { id: 'database', title: 'Database Management System', subject: 'Database', type: 'STUDY GUIDE', icon: '▤', color: 'green', description: 'Relational models, SQL commands, keys, normalization, and ER diagrams.', size: 'Online resource', url: 'https://sqlbolt.com/' },
  { id: 'python', title: 'Python Programming Basics', subject: 'Programming', type: 'PRACTICE', icon: '⌘', color: 'blue', description: 'Variables, conditions, loops, functions, lists, and beginner exercises.', size: 'Online resource', url: 'https://docs.python.org/3/tutorial/' },
  { id: 'software-engineering', title: 'Software Engineering', subject: 'BCA', type: 'REVISION NOTES', icon: '▣', color: 'orange', description: 'Software design, requirements, testing, and project management fundamentals.', size: 'Online resource', url: 'https://www.geeksforgeeks.org/software-engineering/' },
  { id: 'javascript', title: 'JavaScript Quick Reference', subject: 'Web Development', type: 'REFERENCE', icon: 'JS', color: '', description: 'Syntax, DOM methods, events, arrays, and practical examples.', size: 'Online resource', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
  { id: 'sql-practice', title: 'SQL Query Practice', subject: 'Database', type: 'PRACTICE SET', icon: '⌘', color: 'green', description: 'Practice SELECT, JOIN, GROUP BY, subqueries, and data modification.', size: 'Online resource', url: 'https://sqlzoo.net/' },
  { id: 'python-exercises', title: 'Python Lab Exercises', subject: 'Programming', type: 'LAB WORK', icon: '⌘', color: 'blue', description: 'Practice programming patterns with examples and guided exercises.', size: 'Online resource', url: 'https://www.learnpython.org/' },
  { id: 'project-guide', title: 'BCA Project Report Guide', subject: 'BCA', type: 'PROJECT GUIDE', icon: '▤', color: 'orange', description: 'A useful structure for abstract, objectives, methodology, testing, and conclusion.', size: 'Online resource', url: 'https://www.overleaf.com/learn/latex/How_to_Write_a_Thesis' }
];
const events = [
  { id: 'frontend-workshop', date: '15 OCT', kind: 'WORKSHOP', title: 'Frontend Development Workshop', description: 'Build a responsive web page and practise core HTML, CSS, and JavaScript skills.', place: 'Computer Lab', time: '10:00 AM' },
  { id: 'innovation-day', date: '21 OCT', kind: 'STUDENT ACTIVITY', title: 'Student Innovation Day', description: 'Showcase project ideas, connect with classmates, and share creative solutions.', place: 'Seminar Hall', time: '11:00 AM' },
  { id: 'career-session', date: '28 OCT', kind: 'CAREER', title: 'Career Readiness Session', description: 'Learn practical CV, aptitude, and interview preparation techniques.', place: 'Auditorium', time: '12:00 PM' }
];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1); // Needed when TLS terminates at a trusted reverse proxy.
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
    scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"]
  } }
}));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProduction ? '1h' : 0 }));
const SQLiteStore = SQLiteStoreFactory(session);
app.use(session({
  name: 'campusconnect.sid',
  secret,
  store: new SQLiteStore({ dir: dbDir, db: 'sessions.sqlite', table: 'sessions', concurrentDB: true }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 8 * 60 * 60 * 1000 }
}));
app.use((req, res, next) => {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  res.locals.currentPath = req.path;
  next();
});

function csrfProtection(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const supplied = req.get('x-csrf-token') || '';
  const expected = req.session?.csrfToken || '';
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Your security token expired. Refresh the page and try again.' });
  }
  next();
}
app.use('/api', csrfProtection);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password'], authLimiter);

function safeUser(row) {
  return row ? { id: row.id, name: row.name, email: row.email, course: row.course, createdAt: row.created_at } : null;
}
function requireApiAuth(req, res, next) {
  const user = req.session.userId && db.prepare('SELECT id,name,email,course,created_at,password_hash FROM users WHERE id=?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.', redirect: '/login' });
  req.user = user;
  next();
}
function requirePageAuth(req, res, next) {
  const user = req.session.userId && db.prepare('SELECT id,name,email,course,created_at FROM users WHERE id=?').get(req.session.userId);
  if (!user) return res.redirect('/login');
  req.user = user;
  next();
}
function redirectIfSignedIn(req, res, next) {
  if (req.session.userId) return res.redirect('/overview');
  next();
}
function regenerateSession(req, userId, cb) {
  req.session.regenerate(err => {
    if (err) return cb(err);
    req.session.userId = userId;
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    req.session.save(cb);
  });
}
function cleanText(value, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function validPassword(value) { return typeof value === 'string' && value.length >= 8 && value.length <= 72 && Buffer.byteLength(value, 'utf8') <= 72 && /[A-Za-z]/.test(value) && /\d/.test(value); }

app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/overview');
  return res.render('index', { title: 'CampusConnect' });
});
app.get('/index', (req, res) => res.redirect('/')); 
app.get('/login', redirectIfSignedIn, (req, res) => res.render('login', { title: 'Sign in' }));
app.get('/register', redirectIfSignedIn, (req, res) => res.render('register', { title: 'Create account' }));
app.get('/forgot-password', redirectIfSignedIn, (req, res) => res.render('forgot-password', { title: 'Reset password' }));
app.get('/reset-password', redirectIfSignedIn, (req, res) => {
  const token = cleanText(req.query.token, 256);
  if (!token) return res.redirect('/forgot-password');
  res.render('reset-password', { title: 'Choose a new password', token });
});

app.post('/api/auth/register', (req, res) => {
  const name = cleanText(req.body.name, 80);
  const email = cleanText(req.body.email, 254).toLowerCase();
  const course = cleanText(req.body.course, 120) || 'BCA · Semester 5';
  const password = req.body.password;
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!validPassword(password)) return res.status(400).json({ error: 'Use at least 8 characters, including a letter and a number.' });
  try {
    const result = db.prepare('INSERT INTO users(name,email,course,password_hash) VALUES(?,?,?,?)')
      .run(name, email, course, bcrypt.hashSync(password, 12));
    regenerateSession(req, Number(result.lastInsertRowid), err => {
      if (err) return res.status(500).json({ error: 'Account created, but sign-in could not start. Please sign in.' });
      res.status(201).json({ message: 'Your account is ready.', redirect: '/overview', csrfToken: req.session.csrfToken });
    });
  } catch (err) {
    if (String(err.code).includes('SQLITE_CONSTRAINT_UNIQUE')) return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Could not create your account. Please try again.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!validEmail(email) || !password || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ error: 'Enter your email address and password.' });
  const user = db.prepare('SELECT id,password_hash FROM users WHERE email=? COLLATE NOCASE').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Email or password is incorrect.' });
  regenerateSession(req, user.id, err => {
    if (err) return res.status(500).json({ error: 'Could not start your secure session. Please try again.' });
    res.json({ message: 'Signed in successfully.', redirect: '/overview', csrfToken: req.session.csrfToken });
  });
});

app.post('/api/auth/logout', requireApiAuth, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Could not sign you out. Please try again.' });
    res.clearCookie('campusconnect.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    res.json({ redirect: '/login' });
  });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  const user = db.prepare('SELECT id,email,name FROM users WHERE email=? COLLATE NOCASE').get(email);
  // Always return the same message to avoid revealing whether an account exists.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = Date.now() + 30 * 60 * 1000;
    db.prepare('UPDATE users SET reset_token_hash=?,reset_expires=? WHERE id=?').run(tokenHash, expires, user.id);
    const resetUrl = `${(process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '')}/reset-password?token=${token}`;
    if (process.env.SMTP_HOST && process.env.SMTP_FROM) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: user.email,
          subject: 'Reset your CampusConnect password',
          text: `Hello ${user.name},\n\nUse this secure link to reset your CampusConnect password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
          html: `<p>Hello ${escapeHtml(user.name)},</p><p>Use the link below to reset your CampusConnect password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`
        });
      } catch (err) {
        console.error('Password reset email could not be sent:', err.message);
        if (!isProduction) console.info('Local recovery link:', resetUrl);
      }
    } else if (!isProduction) {
      console.info(`\n[CampusConnect local password reset] ${resetUrl}\n`);
    } else {
      console.error('SMTP is not configured; password reset email cannot be delivered.');
    }
  }
  res.json({ message: 'If an account exists for that email, password reset instructions have been sent.' });
});

app.post('/api/auth/reset-password', (req, res) => {
  const token = cleanText(req.body.token, 256);
  const password = req.body.password;
  if (!token || !validPassword(password)) return res.status(400).json({ error: 'Use at least 8 characters, including a letter and a number.' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = db.prepare('SELECT id FROM users WHERE reset_token_hash=? AND reset_expires>?').get(tokenHash, Date.now());
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or expired. Request a new one.' });
  db.prepare('UPDATE users SET password_hash=?,reset_token_hash=NULL,reset_expires=NULL WHERE id=?').run(bcrypt.hashSync(password, 12), user.id);
  res.json({ message: 'Password updated. Please sign in with your new password.', redirect: '/login' });
});

app.get('/api/auth/me', requireApiAuth, (req, res) => res.json({ user: safeUser(req.user) }));

const pageDefinitions = {
  overview: { title: 'Overview', eyebrow: 'YOUR CAMPUS AT A GLANCE' },
  notices: { title: 'Notice board', eyebrow: 'STAY INFORMED' },
  timetable: { title: 'Class timetable', eyebrow: 'PLAN YOUR DAY' },
  materials: { title: 'Study materials', eyebrow: 'LEARN AT YOUR PACE' },
  events: { title: 'Events & activities', eyebrow: 'CAMPUS LIFE' },
  feedback: { title: 'Help & feedback', eyebrow: "WE'RE LISTENING" },
  profile: { title: 'Your profile', eyebrow: 'PERSONALISE YOUR PORTAL' }
};
function renderPortal(key) {
  return (req, res) => res.render('portal', {
    title: pageDefinitions[key].title,
    pageKey: key,
    pageInfo: pageDefinitions[key],
    user: safeUser(req.user),
    notices,
    classes,
    timetable,
    dayNames,
    materials,
    events,
    eventInterestIds: db.prepare('SELECT event_id FROM event_interests WHERE user_id=?').all(req.user.id).map(r => r.event_id),
    feedbackCount: db.prepare('SELECT COUNT(*) AS count FROM feedback WHERE user_id=?').get(req.user.id).count
  });
}
for (const key of Object.keys(pageDefinitions)) app.get(`/${key}`, requirePageAuth, renderPortal(key));

app.put('/api/profile', requireApiAuth, (req, res) => {
  const name = cleanText(req.body.name, 80);
  const course = cleanText(req.body.course, 120);
  if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  if (course.length < 2) return res.status(400).json({ error: 'Please enter your course and semester.' });
  db.prepare('UPDATE users SET name=?,course=? WHERE id=?').run(name, course, req.user.id);
  res.json({ message: 'Profile saved successfully.', user: safeUser(db.prepare('SELECT id,name,email,course,created_at FROM users WHERE id=?').get(req.user.id)) });
});

app.put('/api/profile/password', requireApiAuth, (req, res) => {
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = req.body.newPassword;
  if (!bcrypt.compareSync(currentPassword, req.user.password_hash)) return res.status(400).json({ error: 'Your current password is incorrect.' });
  if (!validPassword(newPassword)) return res.status(400).json({ error: 'Use at least 8 characters, including a letter and a number.' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(newPassword, 12), req.user.id);
  res.json({ message: 'Password changed successfully.' });
});

app.post('/api/feedback', requireApiAuth, (req, res) => {
  const topic = cleanText(req.body.topic, 80);
  const message = cleanText(req.body.message, 3000);
  if (!topic || message.length < 5) return res.status(400).json({ error: 'Choose a topic and write a message of at least 5 characters.' });
  const result = db.prepare('INSERT INTO feedback(user_id,topic,message) VALUES(?,?,?)').run(req.user.id, topic, message);
  res.status(201).json({ message: 'Thank you. Your feedback has been saved.', id: Number(result.lastInsertRowid) });
});

app.post('/api/events/:eventId/interest', requireApiAuth, (req, res) => {
  const event = events.find(e => e.id === req.params.eventId);
  if (!event) return res.status(404).json({ error: 'That event could not be found.' });
  try {
    db.prepare('INSERT INTO event_interests(user_id,event_id,event_title) VALUES(?,?,?)').run(req.user.id, event.id, event.title);
    return res.status(201).json({ message: `You're registered as interested in ${event.title}.`, interested: true });
  } catch (err) {
    if (String(err.code).includes('SQLITE_CONSTRAINT_UNIQUE')) return res.status(409).json({ error: 'You have already marked interest in this event.', interested: true });
    console.error('Event interest error:', err.message);
    res.status(500).json({ error: 'Could not save your event interest.' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint not found.' });
  res.status(404).render('not-found', { title: 'Page not found' });
});
app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err.message);
  if (res.headersSent) return next(err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  res.status(500).send('Something went wrong. Please try again.');
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const server = app.listen(PORT, () => {
  console.log(`CampusConnect is running at ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  if (!isProduction) console.log('Local mode: accounts and application data are stored in SQLite under', dbDir);
});
function shutdown() {
  server.close(() => { try { db.close(); } finally { process.exit(0); } });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
