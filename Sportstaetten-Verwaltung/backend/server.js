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

// Auto-Stornierung nach 48h mit E-Mail
cron.schedule('0 0 * * *', () => {
  db.all(`SELECT b.id, b.room_id, u.email, r.name FROM bookings b JOIN users u ON b.user_id = u.id JOIN rooms r ON b.room_id = r.id WHERE b.status = 'approved' AND b.payment_status = 'unpaid' AND b.created_at < DATETIME('now', '-2 days')`, [], (err, bookings) => {
    if (err) console.error(err);
    bookings.forEach(booking => {
      db.run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [booking.id]);
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: booking.email,
        subject: 'Buchung storniert',
        html: `<p>Ihre Buchung für Raum ${booking.name} (ID: ${booking.id}) wurde storniert, da keine Zahlung erfolgte.</p>`
      }).catch(err => console.error(err));
      db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['auto_cancel', `Buchung ${booking.id} storniert (unbezahlt)`]);
    });
  });
});

// Reminders (E-Mail und SMS)
cron.schedule('0 * * * *', () => {
  db.all(`SELECT b.*, u.email, u.phone, r.name FROM bookings b JOIN users u ON b.user_id = u.id JOIN rooms r ON b.room_id = r.id WHERE b.status = 'approved' AND b.payment_status = 'paid' AND b.start_time BETWEEN DATETIME('now', '+23 hour') AND DATETIME('now', '+24 hour')`, [], (err, bookings) => {
    if (err) console.error(err);
    bookings.forEach(booking => {
      const paymentLink = booking.payment_status === 'unpaid' ? `<a href="http://localhost:3000/payment/${booking.id}">Jetzt bezahlen</a>` : '';
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: booking.email,
        subject: 'Erinnerung an Ihre Buchung',
        html: `<p>Erinnerung: Ihre Buchung für Raum ${booking.name} beginnt in 24 Stunden (${booking.start_time}). ${paymentLink}</p>`
      }).catch(err => console.error(err));
      if (booking.phone) {
        twilio.messages.create({
          body: `Erinnerung: Ihre Buchung für ${booking.name} beginnt in 24h (${booking.start_time}). ${booking.payment_status === 'unpaid' ? 'Bitte bezahlen: http://localhost:3000/payment/' + booking.id : ''}`,
          from: process.env.TWILIO_PHONE,
          to: booking.phone
        }).catch(err => console.error(err));
      }
      db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['reminder', `Erinnerung für Buchung ${booking.id} gesendet`]);
    });
  });
});

// KI-Empfehlungen (verbessert)
const getRoomRecommendations = (userId, callback) => {
  db.all(`SELECT room_id, COUNT(*) as count FROM bookings WHERE user_id = ? GROUP BY room_id ORDER BY count DESC LIMIT 3`, [userId], (err, bookings) => {
    if (err || bookings.length === 0) {
      db.all(`SELECT r.id, r.name, AVG(rev.rating) as avg_rating FROM rooms r LEFT JOIN reviews rev ON r.id = rev.room_id GROUP BY r.id ORDER BY avg_rating DESC LIMIT 3`, [], callback);
    } else {
      const roomIds = bookings.map(b => b.room_id);
      db.all(`SELECT r.id, r.name, AVG(rev.rating) as avg_rating FROM rooms r LEFT JOIN reviews rev ON r.id = rev.room_id WHERE r.id NOT IN (${roomIds.join(',')}) GROUP BY r.id ORDER BY avg_rating DESC LIMIT 3`, [], callback);
    }
  });
};

app.post('/register', async (req, res) => {
  const { username, email, password, consent, phone } = req.body;
  if (!username || !email || !password || !consent) return res.status(400).json({ message: 'Alle Felder und Einwilligung erforderlich' });
  const hashedPw = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, email, password, role, phone) VALUES (?, ?, ?, 'citizen', ?)`, [username, email, hashedPw, phone || null], (err) => {
    if (err) return res.status(400).json({ message: 'Benutzer existiert bereits' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['register', `Neuer Benutzer: ${email}`]);
    res.status(201).json({ message: 'Registriert' });
  });
});

app.post('/auth/google', authenticate, async (req, res) => {
  try {
    const token = req.body.access_token;
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    res.json({ message: 'Google Calendar verbunden' });
  } catch (err) {
    res.status(500).json({ message: 'Google Auth fehlgeschlagen' });
  }
});

app.put('/bookings/:id/approve', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ message: 'Nur Admins oder Manager' });
  db.get(`SELECT b.*, r.name, r.price_per_hour FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`, [req.params.id], async (err, booking) => {
    if (!booking) return res.status(404).json({ message: 'Buchung nicht gefunden' });
    db.get(`SELECT email, language FROM users WHERE id = ?`, [booking.user_id], async (err, user) => {
      const duration = (new Date(booking.end_time) - new Date(booking.start_time)) / (1000 * 60 * 60);
      let total = duration * booking.price_per_hour;
      const selectedFeatures = JSON.parse(booking.features || '[]');
      let featureNames = [], featureTotal = 0;
      const qrCodeUrl = await generateQRCode(booking, total);
      const language = user.language || 'de';
      if (selectedFeatures.length > 0) {
        db.all(`SELECT name, price FROM features WHERE id IN (${selectedFeatures.join(',')})`, [], async (err, featureData) => {
          featureData.forEach(f => {
            featureTotal += f.price;
            featureNames.push(f.name);
          });
          total += featureTotal;
          const stripeSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price_data: { currency: 'eur', product_data: { name: `Buchung ${booking.id} - ${booking.name}` }, unit_amount: Math.round(total * 100) }, quantity: 1 }],
            mode: 'payment',
            success_url: 'http://localhost:3000/success',
            cancel_url: 'http://localhost:3000/cancel',
            metadata: { booking_id: booking.id.toString() }
          });
          const paypalRequest = new paypal.orders.OrdersCreateRequest();
          paypalRequest.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{ amount: { currency_code: 'EUR', value: total.toFixed(2), breakdown: { item_total: { currency_code: 'EUR', value: total.toFixed(2) } } }, description: `Buchung ${booking.id} - ${booking.name}`, custom_id: booking.id.toString() }],
            application_context: { return_url: 'http://localhost:3000/success', cancel_url: 'http://localhost:3000/cancel' }
          });
          const paypalResponse = await paypalClient.execute(paypalRequest);
          const calendarEvent = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: `Buchung ${booking.name}`,
              description: `Buchung ID: ${booking.id}, Status: ${booking.status}`,
              start: { dateTime: booking.start_time },
              end: { dateTime: booking.end_time }
            }
          });
          db.run(`UPDATE bookings SET status = 'approved', google_event_id = ? WHERE id = ?`, [calendarEvent.data.id, req.params.id]);
          const docDefinition = {
            content: [
              { text: language === 'de' ? 'Rechnung' : 'Invoice', style: 'header' },
              { text: `Buchung ID: ${booking.id}` },
              { text: `Raum: ${booking.name}` },
              { text: `Zeit: ${booking.start_time} - ${booking.end_time}` },
              { text: `Features: ${featureNames.join(', ') || (language === 'de' ? 'Keine' : 'None')}` },
              { text: `Betrag: ${total.toFixed(2)}€` },
              { text: language === 'de' ? 'Zahlungsoptionen:' : 'Payment Options:', style: 'subheader' },
              { text: `Stripe: ${stripeSession.url}`, style: 'link' },
              { text: `PayPal: ${paypalResponse.result.links.find(link => link.rel === 'approve').href}`, style: 'link' },
              { text: language === 'de' ? 'Sofortüberweisung:' : 'Instant Transfer:', style: 'subheader' },
              { image: qrCodeUrl, width: 100 }
            ],
            styles: { header: { fontSize: 18, bold: true }, subheader: { fontSize: 14, bold: true }, link: { color: 'blue', decoration: 'underline' } }
          };
          const pdfDoc = pdfmake.createPdfKitDocument(docDefinition, {});
          if (!fs.existsSync('invoices')) fs.mkdirSync('invoices');
          pdfDoc.pipe(fs.createWriteStream(`invoices/${booking.id}.pdf`));
          pdfDoc.end();
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: language === 'de' ? 'Buchung genehmigt' : 'Booking Approved',
            html: language === 'de'
              ? `<p>Ihre Buchung für Raum ${booking.name} ist genehmigt. Betrag: ${total.toFixed(2)}€.</p>
                 <p>Zahlungsoptionen:</p>
                 <ul>
                   <li><a href="${stripeSession.url}">Stripe bezahlen</a></li>
                   <li><a href="${paypalResponse.result.links.find(link => link.rel === 'approve').href}">PayPal bezahlen</a></li>
                   <li>Sofortüberweisung: Scannen Sie den QR-Code mit Ihrer Bank-App:<br><img src="${qrCodeUrl}" width="100"/></li>
                 </ul>`
              : `<p>Your booking for room ${booking.name} has been approved. Amount: ${total.toFixed(2)}€.</p>
                 <p>Payment options:</p>
                 <ul>
                   <li><a href="${stripeSession.url}">Pay with Stripe</a></li>
                   <li><a href="${paypalResponse.result.links.find(link => link.rel === 'approve').href}">Pay with PayPal</a></li>
                   <li>Instant Transfer: Scan the QR code with your banking app:<br><img src="${qrCodeUrl}" width="100"/></li>
                 </ul>`
          }).catch(() => {});
          db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['booking_approve', `Buchung ${booking.id} genehmigt, Zahlungslinks gesendet`]);
          res.json({ message: 'Genehmigt, Rechnung generiert', stripeSessionId: stripeSession.id, paypalOrderId: paypalResponse.result.id });
        });
      } else {
        // ... (Ähnlicher Code ohne Features)
      }
    });
  });
});

app.post('/reviews', authenticate, (req, res) => {
  const { room_id, rating, comment } = req.body;
  if (!room_id || !rating || rating < 1 || rating > 5 || (comment && comment.length > 500)) return res.status(400).json({ message: 'Ungültige Bewertung oder Kommentar zu lang' });
  db.run(`INSERT INTO reviews (room_id, user_id, rating, comment) VALUES (?, ?, ?, ?)`, [room_id, req.user.id, rating, comment || ''], (err) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['review', `Bewertung für Raum ${room_id} von User ${req.user.id}`]);
    res.status(201).json({ message: 'Bewertung gespeichert' });
  });
});

app.get('/reviews/:room_id', (req, res) => {
  db.all(`SELECT r.*, u.username FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.room_id = ?`, [req.params.room_id], (err, reviews) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    db.get(`SELECT AVG(rating) as avg_rating FROM reviews WHERE room_id = ?`, [req.params.room_id], (err, result) => {
      res.json({ reviews, avg_rating: result.avg_rating || 0 });
    });
  });
});

app.get('/recommendations', authenticate, (req, res) => {
  getRoomRecommendations(req.user.id, (err, rooms) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(rooms);
  });
});

app.get('/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  db.all(`SELECT id, username, email, role FROM users`, [], (err, users) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(users);
  });
});

app.put('/users/:id/role', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const { role } = req.body;
  if (!['admin', 'manager', 'citizen'].includes(role)) return res.status(400).json({ message: 'Ungültige Rolle' });
  db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['role_update', `Rolle für User ${req.params.id} zu ${role} geändert`]);
    res.json({ message: 'Rolle aktualisiert' });
  });
});

app.listen(process.env.PORT || 5000, () => console.log('Server running'));