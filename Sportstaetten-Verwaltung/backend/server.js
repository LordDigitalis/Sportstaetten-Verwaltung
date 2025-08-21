const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const pdfmake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');
const QRCode = require('qrcode');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

dotenv.config();
pdfmake.vfs = pdfFonts.pdfMake.vfs;
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/json', limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const db = new sqlite3.Database('./bookings.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT, phone TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY, name TEXT, capacity INTEGER, price_per_hour REAL, lat REAL, lng REAL)`);
  db.run(`CREATE TABLE IF NOT EXISTS features (id INTEGER PRIMARY KEY, room_id INTEGER, name TEXT, price REAL, FOREIGN KEY(room_id) REFERENCES rooms(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, room_id INTEGER, user_id INTEGER, start_time DATETIME, end_time DATETIME, status TEXT DEFAULT 'pending', features TEXT, payment_status TEXT DEFAULT 'unpaid', payment_method TEXT, google_event_id TEXT, FOREIGN KEY(room_id) REFERENCES rooms(id), FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY, room_id INTEGER, user_id INTEGER, rating INTEGER, comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(room_id) REFERENCES rooms(id), FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, type TEXT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`DELETE FROM bookings WHERE end_time < DATETIME('now', '-1 year')`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings (room_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_features_room_id ON features (room_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_room_id ON reviews (room_id)`);
});

const paypalClient = new paypal.core.PayPalHttpClient(new paypal.core.SandboxEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
));

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

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const googleAuth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/calendar']
});

const calendar = google.calendar({ version: 'v3', auth: googleAuth });

const generateQRCode = async (booking, total) => {
  const qrData = `BCD
001
1
SCT
${process.env.BIC}
${booking.name}
${process.env.IBAN}
EUR${total.toFixed(2)}
CHAR
Buchung ${booking.id}`;
  return await QRCode.toDataURL(qrData);
};

// Auto-Stornierung nach 48h
cron.schedule('0 0 * * *', () => {
  db.all(`SELECT id FROM bookings WHERE status = 'approved' AND payment_status = 'unpaid' AND created_at < DATETIME('now', '-2 days')`, [], (err, bookings) => {
    if (err) console.error(err);
    bookings.forEach(booking => {
      db.run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [booking.id]);
      db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['auto_cancel', `Buchung ${booking.id} storniert (unbezahlt)`]);
    });
  });
});

// Reminders (E-Mail und SMS)
cron.schedule('0 * * * *', () => {
  db.all(`SELECT b.*, u.email, u.phone, r.name FROM bookings b JOIN users u ON b.user_id = u.id JOIN rooms r ON b.room_id = r.id WHERE status = 'approved' AND payment_status = 'paid' AND start_time BETWEEN DATETIME('now', '+23 hour') AND DATETIME('now', '+24 hour')`, [], (err, bookings) => {
    if (err) console.error(err);
    bookings.forEach(booking => {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: booking.email,
        subject: 'Erinnerung an Ihre Buchung',
        html: `<p>Erinnerung: Ihre Buchung für Raum ${booking.name} beginnt in 24 Stunden (${booking.start_time}).</p>`
      }).catch(err => console.error(err));
      if (booking.phone) {
        twilio.messages.create({
          body: `Erinnerung: Ihre Buchung für ${booking.name} beginnt in 24h (${booking.start_time}).`,
          from: process.env.TWILIO_PHONE,
          to: booking.phone
        }).catch(err => console.error(err));
      }
      db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['reminder', `Erinnerung für Buchung ${booking.id} gesendet`]);
    });
  });
});

// ... (Rest des Codes für /bookings/approve, /reviews, /recommendations, etc.)

app.listen(process.env.PORT || 5000, () => console.log('Server running'));