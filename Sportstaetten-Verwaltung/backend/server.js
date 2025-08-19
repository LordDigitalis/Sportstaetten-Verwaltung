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

dotenv.config();
pdfmake.vfs = pdfFonts.pdfMake.vfs;
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/json', limit: '10mb' })); // Für Stripe Webhooks
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const db = new sqlite3.Database('./bookings.db');
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, role TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY, name TEXT, capacity INTEGER, price_per_hour REAL)`);
  db.run(`CREATE TABLE IF NOT EXISTS features (id INTEGER PRIMARY KEY, room_id INTEGER, name TEXT, price REAL, FOREIGN KEY(room_id) REFERENCES rooms(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, room_id INTEGER, user_id INTEGER, start_time DATETIME, end_time DATETIME, status TEXT DEFAULT 'pending', features TEXT, payment_status TEXT DEFAULT 'unpaid', FOREIGN KEY(room_id) REFERENCES rooms(id), FOREIGN KEY(user_id) REFERENCES users(id))`);
  db.run(`CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, type TEXT, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`DELETE FROM bookings WHERE end_time < DATETIME('now', '-1 year')`);
});

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

app.post('/register', async (req, res) => {
  const { username, email, password, consent } = req.body;
  if (!username || !email || !password || !consent) return res.status(400).json({ message: 'Alle Felder und Einwilligung erforderlich' });
  const hashedPw = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'citizen')`, [username, email, hashedPw], (err) => {
    if (err) return res.status(400).json({ message: 'Benutzer existiert bereits' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['register', `Neuer Benutzer: ${email}`]);
    res.status(201).json({ message: 'Registriert' });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email und Passwort erforderlich' });
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Ungültige Anmeldedaten' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['login', `Login: ${email}`]);
    res.json({ token });
  });
});

app.get('/rooms', (req, res) => {
  db.all(`SELECT * FROM rooms`, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(rows);
  });
});

app.get('/features/:room_id', (req, res) => {
  db.all(`SELECT * FROM features WHERE room_id = ?`, [req.params.room_id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(rows);
  });
});

app.post('/features', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const { room_id, name, price } = req.body;
  if (!room_id || !name || price < 0) return res.status(400).json({ message: 'Alle Felder erforderlich, Preis nicht negativ' });
  db.run(`INSERT INTO features (room_id, name, price) VALUES (?, ?, ?)`, [room_id, name, price], (err) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['feature_add', `Feature hinzugefügt: ${name} für Raum ${room_id}`]);
    res.status(201).json({ message: 'Feature hinzugefügt' });
  });
});

app.get('/public/bookings', (req, res) => {
  db.all(`SELECT b.*, r.name FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE status = 'approved'`, [], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(rows);
  });
});

app.post('/bookings/request', authenticate, (req, res) => {
  if (req.user.role !== 'citizen') return res.status(403).json({ message: 'Nur Bürger dürfen anfragen' });
  const { room_id, start_time, end_time, features } = req.body;
  if (!room_id || !start_time || !end_time) return res.status(400).json({ message: 'Alle Felder erforderlich' });
  db.get(`SELECT * FROM bookings WHERE room_id = ? AND status = 'approved' AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?) OR (start_time >= ? AND start_time < ?))`, 
    [room_id, end_time, start_time, start_time, end_time, start_time, end_time], (err, conflict) => {
    if (conflict) return res.status(409).json({ message: 'Zeitkonflikt' });
    db.run(`INSERT INTO bookings (room_id, user_id, start_time, end_time, status, features, payment_status) VALUES (?, ?, ?, ?, 'pending', ?, 'unpaid')`, 
      [room_id, req.user.id, start_time, end_time, JSON.stringify(features || [])], async (err) => {
      if (err) return res.status(500).json({ message: 'Serverfehler' });
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'admin@email.com',
        subject: 'Neue Buchungsanfrage',
        html: `<p>Anfrage für Raum ${room_id} von ${start_time} bis ${end_time}, Features: ${features ? features.join(', ') : 'Keine'}.</p>`
      }).catch(() => res.status(500).json({ message: 'E-Mail-Fehler' }));
      db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['booking_request', `Anfrage für Raum ${room_id}, User ${req.user.id}`]);
      res.status(201).json({ message: 'Anfrage gesendet' });
    });
  });
});

app.put('/bookings/:id/approve', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  db.get(`SELECT b.*, r.name, r.price_per_hour FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE b.id = ?`, [req.params.id], async (err, booking) => {
    if (!booking) return res.status(404).json({ message: 'Buchung nicht gefunden' });
    db.run(`UPDATE bookings SET status = 'approved' WHERE id = ?`, [req.params.id]);
    db.get(`SELECT email FROM users WHERE id = ?`, [booking.user_id], async (err, user) => {
      const duration = (new Date(booking.end_time) - new Date(booking.start_time)) / (1000 * 60 * 60);
      let total = duration * booking.price_per_hour;
      const selectedFeatures = JSON.parse(booking.features || '[]');
      let featureNames = [];
      let featureTotal = 0;
      if (selectedFeatures.length > 0) {
        db.all(`SELECT name, price FROM features WHERE id IN (${selectedFeatures.join(',')})`, [], async (err, featureData) => {
          featureData.forEach(f => {
            featureTotal += f.price;
            featureNames.push(f.name);
          });
          total += featureTotal;
          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
              price_data: {
                currency: 'eur',
                product_data: { name: `Buchung ${booking.id} - ${booking.name}` },
                unit_amount: Math.round(total * 100),
              },
              quantity: 1,
            }],
            mode: 'payment',
            success_url: 'http://localhost:3000/success',
            cancel_url: 'http://localhost:3000/cancel',
            metadata: { booking_id: booking.id.toString() }
          });
          const docDefinition = {
            content: [
              { text: 'Rechnung', style: 'header' },
              { text: `Buchung ID: ${booking.id}` },
              { text: `Raum: ${booking.name}` },
              { text: `Zeit: ${booking.start_time} - ${booking.end_time}` },
              { text: `Features: ${featureNames.join(', ') || 'Keine'}` },
              { text: `Betrag: ${total.toFixed(2)}€` },
              { text: `Zahlungslink: ${session.url}`, style: 'link' }
            ],
            styles: { header: { fontSize: 18, bold: true }, link: { color: 'blue', decoration: 'underline' } }
          };
          const pdfDoc = pdfmake.createPdfKitDocument(docDefinition, {});
          if (!fs.existsSync('invoices')) fs.mkdirSync('invoices');
          pdfDoc.pipe(fs.createWriteStream(`invoices/${booking.id}.pdf`));
          pdfDoc.end();
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Buchung genehmigt',
            html: `<p>Ihre Buchung für Raum ${booking.name} ist genehmigt. Betrag: ${total.toFixed(2)}€. <a href="${session.url}">Jetzt bezahlen</a></p>`
          }).catch(() => {});
          db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['booking_approve', `Buchung ${booking.id} genehmigt, Zahlungslink gesendet`]);
          res.json({ message: 'Genehmigt, Rechnung generiert', sessionId: session.id });
        });
      } else {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'eur',
              product_data: { name: `Buchung ${booking.id} - ${booking.name}` },
              unit_amount: Math.round(total * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: 'http://localhost:3000/success',
          cancel_url: 'http://localhost:3000/cancel',
          metadata: { booking_id: booking.id.toString() }
        });
        const docDefinition = {
          content: [
            { text: 'Rechnung', style: 'header' },
            { text: `Buchung ID: ${booking.id}` },
            { text: `Raum: ${booking.name}` },
            { text: `Zeit: ${booking.start_time} - ${booking.end_time}` },
            { text: `Features: Keine` },
            { text: `Betrag: ${total.toFixed(2)}€` },
            { text: `Zahlungslink: ${session.url}`, style: 'link' }
          ],
          styles: { header: { fontSize: 18, bold: true }, link: { color: 'blue', decoration: 'underline' } }
        };
        const pdfDoc = pdfmake.createPdfKitDocument(docDefinition, {});
        if (!fs.existsSync('invoices')) fs.mkdirSync('invoices');
        pdfDoc.pipe(fs.createWriteStream(`invoices/${booking.id}.pdf`));
        pdfDoc.end();
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: 'Buchung genehmigt',
          html: `<p>Ihre Buchung für Raum ${booking.name} ist genehmigt. Betrag: ${total.toFixed(2)}€. <a href="${session.url}">Jetzt bezahlen</a></p>`
        }).catch(() => {});
        db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['booking_approve', `Buchung ${booking.id} genehmigt, Zahlungslink gesendet`]);
        res.json({ message: 'Genehmigt, Rechnung generiert', sessionId: session.id });
      }
    });
  });
});

app.put('/bookings/:id/reject', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  db.run(`UPDATE bookings SET status = 'rejected' WHERE id = ?`, [req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['booking_reject', `Buchung ${req.params.id} abgelehnt`]);
    res.json({ message: 'Abgelehnt' });
  });
});

app.get('/invoices/:id', authenticate, (req, res) => {
  const file = `invoices/${req.params.id}.pdf`;
  if (!fs.existsSync(file)) return res.status(404).json({ message: 'Rechnung nicht gefunden' });
  res.download(file);
});

app.post('/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ message: 'Alle Felder erforderlich' });
  transporter.sendMail({
    from: email,
    to: process.env.EMAIL_USER,
    subject: 'Kontaktanfrage',
    html: `<p>${name}: ${message}</p>`
  }).then(() => {
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['contact', `Kontaktanfrage von ${email}`]);
    res.json({ message: 'Gesendet' });
  }).catch(() => res.status(500).json({ message: 'E-Mail-Fehler' }));
});

app.get('/admin/dashboard', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  db.all(`SELECT b.*, r.name FROM bookings b JOIN rooms r ON b.room_id = r.id`, [], (err, bookings) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json({ bookings });
  });
});

app.get('/logs', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  db.all(`SELECT * FROM logs ORDER BY created_at DESC`, [], (err, logs) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(logs);
  });
});

app.get('/bookings', authenticate, (req, res) => {
  db.all(`SELECT b.*, r.name FROM bookings b JOIN rooms r ON b.room_id = r.id WHERE user_id = ?`, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(rows);
  });
});

app.post('/rooms', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const { name, capacity, price_per_hour } = req.body;
  if (!name || !capacity || price_per_hour < 0) return res.status(400).json({ message: 'Alle Felder erforderlich, Preis nicht negativ' });
  db.run(`INSERT INTO rooms (name, capacity, price_per_hour) VALUES (?, ?, ?)`, [name, capacity, price_per_hour], (err) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['room_add', `Raum hinzugefügt: ${name}`]);
    res.status(201).json({ message: 'Raum hinzugefügt' });
  });
});

app.get('/mydata', authenticate, (req, res) => {
  db.get(`SELECT username, email FROM users WHERE id = ?`, [req.user.id], (err, data) => {
    if (err) return res.status(500).json({ message: 'Serverfehler' });
    res.json(data);
  });
});

app.delete('/mydata', authenticate, (req, res) => {
  db.run(`DELETE FROM users WHERE id = ?`, [req.user.id]);
  db.run(`DELETE FROM bookings WHERE user_id = ?`, [req.user.id]);
  db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['data_delete', `Daten gelöscht für User ${req.user.id}`]);
  res.json({ message: 'Daten gelöscht (DSGVO)' });
});

app.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
    const bookingId = event.data.object.metadata.booking_id;
    db.run(`UPDATE bookings SET payment_status = 'paid' WHERE id = ?`, [bookingId], (err) => {
      if (err) console.error(err);
      db.run(`INSERT INTO logs (type, message) VALUES (?, ?)`, ['payment', `Zahlung erfolgreich für Buchung ${bookingId}`]);
    });
  }
  res.json({ received: true });
});

app.listen(process.env.PORT || 5000, () => console.log('Server running'));