const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const pdfmake = require('pdfmake');
const fs = require('fs');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./bookings.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY, name TEXT, capacity INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, room_id INTEGER, user_id INTEGER, start_time DATETIME, end_time DATETIME, status TEXT DEFAULT 'pending', FOREIGN KEY(room_id) REFERENCES rooms(id), FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`DELETE FROM bookings WHERE end_time < DATETIME('now', '-1 year')`);
});

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthenticated' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Register
app.post('/register', async (req, res) => {
  const { username, email, password, consent } = req.body;
  if (!consent) return res.status(400).json({ message: 'Consent required (DSGVO)' });
  const hashedPw = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'citizen')`, [username, email, hashedPw], (err) => {
    if (err) return res.status(400).json({ message: 'User exists' });
    res.status(201).json({ message: 'Registered' });
  });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });
});

// Rooms get
app.get('/rooms', (req, res) => {
  db.all(`SELECT * FROM rooms`, [], (err, rows) => {
    res.json(rows);
  });
});

// Public bookings
app.get('/public/bookings', (req, res) => {
  db.all(`SELECT * FROM bookings WHERE status = 'approved'`, [], (err, rows) => {
    res.json(rows);
  });
});

// Booking request
app.post('/bookings/request', authenticate, (req, res) => {
  if (req.user.role !== 'citizen') return res.status(403).json({ message: 'Forbidden' });
  const { room_id, start_time, end_time } = req.body;
  db.get(`SELECT * FROM bookings WHERE room_id = ? AND status = 'approved' AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))`, 
    [room_id, end_time, start_time, start_time, end_time, start_time, end_time], (err, conflict) => {
    if (conflict) return res.status(409).json({ message: 'Conflict' });
    db.run(`INSERT INTO bookings (room_id, user_id, start_time, end_time, status) VALUES (?, ?, ?, ?, 'pending')`, [room_id, req.user.id, start_time, end_time], async (err) => {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'admin@email.com',
        subject: 'Neue Buchungsanfrage',
        text: `Anfrage für Raum ${room_id} von ${start_time} bis ${end_time}.`
      });
      res.status(201).json({ message: 'Request sent' });
    });
  });
});

// Approve booking
app.put('/bookings/:id/approve', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  db.get(`SELECT * FROM bookings WHERE id = ?`, [req.params.id], async (err, booking) => {
    if (!booking) return res.status(404).json({ message: 'Not found' });
    db.run(`UPDATE bookings SET status = 'approved' WHERE id = ?`, [req.params.id]);
    db.get(`SELECT email FROM users WHERE id = ?`, [booking.user_id], async (err, user) => {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Buchung genehmigt',
        text: `Ihre Buchung für Raum ${booking.room_id} ist genehmigt.`
      });
      const docDefinition = {
        content: [
          { text: 'Rechnung', style: 'header' },
          { text: `Buchung ID: ${booking.id}` },
          { text: `Raum: ${booking.room_id}` },
          { text: `Zeit: ${booking.start_time} - ${booking.end_time}` },
          { text: 'Betrag: 50€' }
        ],
        styles: { header: { fontSize: 18, bold: true } }
      };
      const printer = new pdfmake({});
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      if (!fs.existsSync('invoices')) fs.mkdirSync('invoices');
      pdfDoc.pipe(fs.createWriteStream(`invoices/${booking.id}.pdf`));
      pdfDoc.end();
      res.json({ message: 'Approved, invoice generated' });
    });
  });
});

// Reject booking
app.put('/bookings/:id/reject', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  db.run(`UPDATE bookings SET status = 'rejected' WHERE id = ?`, [req.params.id]);
  res.json({ message: 'Rejected' });
});

// Invoice download
app.get('/invoices/:id', authenticate, (req, res) => {
  const file = `invoices/${req.params.id}.pdf`;
  res.download(file);
});

// Contact
app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  transporter.sendMail({
    from: email,
    to: process.env.EMAIL_USER,
    subject: 'Kontaktanfrage',
    text: `${name}: ${message}`
  }).then(() => res.json({ message: 'Sent' }));
});

// Admin dashboard
app.get('/admin/dashboard', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  db.all(`SELECT * FROM bookings`, [], (err, bookings) => {
    res.json({ bookings });
  });
});

// User bookings
app.get('/bookings', authenticate, (req, res) => {
  db.all(`SELECT * FROM bookings WHERE user_id = ?`, [req.user.id], (err, rows) => {
    res.json(rows);
  });
});

// Add room
app.post('/rooms', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { name, capacity } = req.body;
  db.run(`INSERT INTO rooms (name, capacity) VALUES (?, ?)`, [name, capacity], (err) => {
    res.status(201).json({ message: 'Room added' });
  });
});

// DSGVO mydata
app.get('/mydata', authenticate, (req, res) => {
  db.get(`SELECT username, email FROM users WHERE id = ?`, [req.user.id], (err, data) => {
    res.json(data);
  });
});

app.delete('/mydata', authenticate, (req, res) => {
  db.run(`DELETE FROM users WHERE id = ?`, [req.user.id]);
  db.run(`DELETE FROM bookings WHERE user_id = ?`, [req.user.id]);
  res.json({ message: 'Data deleted (DSGVO)' });
});

app.listen(process.env.PORT || 5000, () => console.log('Server running'));