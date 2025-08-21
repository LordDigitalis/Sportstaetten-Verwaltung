const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const pdfmake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('@paypal/checkout-server-sdk');
const QRCode = require('qrcode');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const Redis = require('ioredis');
const axios = require('axios');

dotenv.config();
pdfmake.vfs = pdfFonts.pdfMake.vfs;
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.raw({ type: 'application/json', limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

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

const getWeather = async (lat, lng, date) => {
  const cacheKey = `weather:${lat}:${lng}:${date}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  const res = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHERMAP_API_KEY}`);
  const weather = res.data.list.find(f => new Date(f.dt * 1000).toISOString().split('T')[0] === date);
  const result = weather ? { condition: weather.weather[0].main, probability: weather.pop * 100 } : null;
  if (result) await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
  return result;
};

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

cron.schedule('0 0 * * *', async () => {
  const bookings = await prisma.booking.findMany({
    where: { status: 'approved', paymentStatus: 'unpaid', createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
    include: { user: true, room: true },
  });
  for (const booking of bookings) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'cancelled' } });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: booking.user.email,
      subject: booking.user.language === 'de' ? 'Buchung storniert' : 'Booking Cancelled',
      html: `<p>${booking.user.language === 'de' ? 'Ihre Buchung für Raum' : 'Your booking for room'} ${booking.room.name} (ID: ${booking.id}) ${booking.user.language === 'de' ? 'wurde storniert, da keine Zahlung erfolgte.' : 'was cancelled due to non-payment.'}</p>`,
    });
    await prisma.log.create({ data: { type: 'auto_cancel', message: `Buchung ${booking.id} storniert (unbezahlt)` } });
  }
});

cron.schedule('0 * * * *', async () => {
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'approved',
      paymentStatus: 'paid',
      startTime: { gte: new Date(Date.now() + 23 * 60 * 60 * 1000), lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    },
    include: { user: true, room: true },
  });
  for (const booking of bookings) {
    const weather = await getWeather(booking.room.lat, booking.room.lng, booking.startTime.toISOString().split('T')[0]);
    const weatherMsg = weather && weather.probability > 50 ? `${booking.user.language === 'de' ? 'Wetterwarnung' : 'Weather Warning'}: ${weather.condition} (${weather.probability}% ${booking.user.language === 'de' ? 'Wahrscheinlichkeit' : 'probability'})` : '';
    const paymentLink = booking.paymentStatus === 'unpaid' ? `<a href="http://localhost:3000/payment/${booking.id}">${booking.user.language === 'de' ? 'Jetzt bezahlen' : 'Pay now'}</a>` : '';
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: booking.user.email,
      subject: booking.user.language === 'de' ? 'Erinnerung an Ihre Buchung' : 'Booking Reminder',
      html: `<p>${booking.user.language === 'de' ? 'Erinnerung: Ihre Buchung für Raum' : 'Reminder: Your booking for room'} ${booking.room.name} ${booking.user.language === 'de' ? 'beginnt in 24 Stunden' : 'starts in 24 hours'} (${booking.startTime}). ${paymentLink} ${weatherMsg}</p>`,
    });
    if (booking.user.phone) {
      await twilio.messages.create({
        body: `${booking.user.language === 'de' ? 'Erinnerung: Ihre Buchung für' : 'Reminder: Your booking for'} ${booking.room.name} ${booking.user.language === 'de' ? 'beginnt in 24h' : 'starts in 24h'} (${booking.startTime}). ${booking.paymentStatus === 'unpaid' ? 'Bitte bezahlen: http://localhost:3000/payment/' + booking.id : ''} ${weatherMsg}`,
        from: process.env.TWILIO_PHONE,
        to: booking.user.phone,
      });
    }
    await prisma.log.create({ data: { type: 'reminder', message: `Erinnerung für Buchung ${booking.id} gesendet` } });
  }
});

app.post('/register', async (req, res) => {
  const { username, email, password, consent, phone, language } = req.body;
  if (!username || !email || !password || !consent) return res.status(400).json({ message: 'Alle Felder und Einwilligung erforderlich' });
  const hashedPw = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({
      data: { username, email, password: hashedPw, role: 'citizen', phone, language: language || 'de' },
    });
    await prisma.log.create({ data: { type: 'register', message: `Neuer Benutzer: ${email}` } });
    res.status(201).json({ message: 'Registriert' });
  } catch (err) {
    res.status(400).json({ message: 'Benutzer existiert bereits' });
  }
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
  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { room: true, user: true },
  });
  if (!booking) return res.status(404).json({ message: 'Buchung nicht gefunden' });
  const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
  let total = duration * booking.room.pricePerHour;
  const selectedFeatures = JSON.parse(booking.features || '[]');
  let featureNames = [], featureTotal = 0;
  const qrCodeUrl = await generateQRCode(booking, total);
  if (selectedFeatures.length > 0) {
    const featureData = await prisma.feature.findMany({ where: { id: { in: selectedFeatures } } });
    featureData.forEach(f => {
      featureTotal += f.price;
      featureNames.push(f.name);
    });
    total += featureTotal;
  }
  const stripeSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'eur', product_data: { name: `Buchung ${booking.id} - ${booking.room.name}` }, unit_amount: Math.round(total * 100) }, quantity: 1 }],
    mode: 'payment',
    success_url: 'http://localhost:3000/success',
    cancel_url: 'http://localhost:3000/cancel',
    metadata: { booking_id: booking.id.toString() },
  });
  const paypalRequest = new paypal.orders.OrdersCreateRequest();
  paypalRequest.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{ amount: { currency_code: 'EUR', value: total.toFixed(2), breakdown: { item_total: { currency_code: 'EUR', value: total.toFixed(2) } } }, description: `Buchung ${booking.id} - ${booking.room.name}`, custom_id: booking.id.toString() }],
    application_context: { return_url: 'http://localhost:3000/success', cancel_url: 'http://localhost:3000/cancel' },
  });
  const paypalResponse = await paypalClient.execute(paypalRequest);
  const calendarEvent = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: `Buchung ${booking.room.name}`,
      description: `Buchung ID: ${booking.id}, Status: ${booking.status}`,
      start: { dateTime: booking.startTime },
      end: { dateTime: booking.endTime },
    },
  });
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: 'approved', googleEventId: calendarEvent.data.id },
  });
  const docDefinition = {
    content: [
      { text: booking.user.language === 'de' ? 'Rechnung' : 'Invoice', style: 'header' },
      { text: `Buchung ID: ${booking.id}` },
      { text: `Raum: ${booking.room.name}` },
      { text: `Zeit: ${booking.startTime} - ${booking.endTime}` },
      { text: `Features: ${featureNames.join(', ') || (booking.user.language === 'de' ? 'Keine' : 'None')}` },
      { text: `Betrag: ${total.toFixed(2)}€` },
      { text: booking.user.language === 'de' ? 'Zahlungsoptionen:' : 'Payment Options:', style: 'subheader' },
      { text: `Stripe: ${stripeSession.url}`, style: 'link' },
      { text: `PayPal: ${paypalResponse.result.links.find(link => link.rel === 'approve').href}`, style: 'link' },
      { text: booking.user.language === 'de' ? 'Sofortüberweisung:' : 'Instant Transfer:', style: 'subheader' },
      { image: qrCodeUrl, width: 100 },
    ],
    styles: { header: { fontSize: 18, bold: true }, subheader: { fontSize: 14, bold: true }, link: { color: 'blue', decoration: 'underline' } },
  };
  const pdfDoc = pdfmake.createPdfKitDocument(docDefinition, {});
  pdfDoc.pipe(require('fs').createWriteStream(`invoices/${booking.id}.pdf`));
  pdfDoc.end();
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: booking.user.email,
    subject: booking.user.language === 'de' ? 'Buchung genehmigt' : 'Booking Approved',
    html: booking.user.language === 'de'
      ? `<p>Ihre Buchung für Raum ${booking.room.name} ist genehmigt. Betrag: ${total.toFixed(2)}€.</p>
         <p>Zahlungsoptionen:</p>
         <ul>
           <li><a href="${stripeSession.url}">Stripe bezahlen</a></li>
           <li><a href="${paypalResponse.result.links.find(link => link.rel === 'approve').href}">PayPal bezahlen</a></li>
           <li>Sofortüberweisung: Scannen Sie den QR-Code mit Ihrer Bank-App:<br><img src="${qrCodeUrl}" width="100"/></li>
         </ul>`
      : `<p>Your booking for room ${booking.room.name} has been approved. Amount: ${total.toFixed(2)}€.</p>
         <p>Payment options:</p>
         <ul>
           <li><a href="${stripeSession.url}">Pay with Stripe</a></li>
           <li><a href="${paypalResponse.result.links.find(link => link.rel === 'approve').href}">Pay with PayPal</a></li>
           <li>Instant Transfer: Scan the QR code with your banking app:<br><img src="${qrCodeUrl}" width="100"/></li>
         </ul>`,
  });
  await prisma.log.create({ data: { type: 'booking_approve', message: `Buchung ${booking.id} genehmigt, Zahlungslinks gesendet` } });
  res.json({ message: 'Genehmigt, Rechnung generiert', stripeSessionId: stripeSession.id, paypalOrderId: paypalResponse.result.id });
});

app.post('/bookings/:id/refund', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') return res.status(403).json({ message: 'Nur Admins oder Manager' });
  const booking = await prisma.booking.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { user: true, room: true },
  });
  if (!booking || booking.paymentStatus !== 'paid') return res.status(400).json({ message: 'Buchung nicht bezahlt oder nicht gefunden' });
  const duration = (new Date(booking.endTime) - new Date(booking.startTime)) / (1000 * 60 * 60);
  let total = duration * booking.room.pricePerHour;
  const selectedFeatures = JSON.parse(booking.features || '[]');
  if (selectedFeatures.length > 0) {
    const featureData = await prisma.feature.findMany({ where: { id: { in: selectedFeatures } } });
    total += featureData.reduce((sum, f) => sum + f.price, 0);
  }
  if (booking.paymentMethod === 'stripe') {
    const refund = await stripe.refunds.create({ payment_intent: booking.paymentIntentId });
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'refunded' } });
  } else if (booking.paymentMethod === 'paypal') {
    const request = new paypal.payments.CapturesRefundRequest(booking.paymentIntentId);
    request.requestBody({ amount: { currency_code: 'EUR', value: total.toFixed(2) } });
    await paypalClient.execute(request);
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: 'refunded' } });
  } else if (booking.paymentMethod === 'klarna') {
    // TODO: Klarna Rückerstattung (Edge-Case für Teilrückerstattungen)
    return res.status(501).json({ message: 'Klarna Rückerstattung noch nicht implementiert' });
  }
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: booking.user.email,
    subject: booking.user.language === 'de' ? 'Rückerstattung erfolgreich' : 'Refund Successful',
    html: `<p>${booking.user.language === 'de' ? 'Ihre Rückerstattung für Buchung' : 'Your refund for booking'} ${booking.id} (${booking.room.name}, ${total.toFixed(2)}€) ${booking.user.language === 'de' ? 'wurde verarbeitet.' : 'has been processed.'}</p>`,
  });
  await prisma.log.create({ data: { type: 'refund', message: `Rückerstattung für Buchung ${booking.id} (${total.toFixed(2)}€)` } });
  res.json({ message: 'Rückerstattung erfolgreich' });
});

app.get('/export/bookings', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const bookings = await prisma.booking.findMany({ include: { user: true, room: true } });
  const csv = ['id,room,user,start_time,end_time,status,payment_status,payment_method'];
  bookings.forEach(b => {
    csv.push(`${b.id},${b.room.name},${b.user.username},${b.startTime},${b.endTime},${b.status},${b.paymentStatus},${b.paymentMethod || ''}`);
  });
  res.header('Content-Type', 'text/csv');
  res.attachment('bookings.csv');
  res.send(csv.join('\n'));
});

app.get('/export/reviews', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const reviews = await prisma.review.findMany({ include: { user: true, room: true } });
  const csv = ['id,room,user,rating,comment,created_at'];
  reviews.forEach(r => {
    csv.push(`${r.id},${r.room.name},${r.user.username},${r.rating},${r.comment.replace(/,/g, ';')},${r.createdAt}`);
  });
  res.header('Content-Type', 'text/csv');
  res.attachment('reviews.csv');
  res.send(csv.join('\n'));
});

app.get('/analytics', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const { startDate, endDate, roomId } = req.query;
  const bookings = await prisma.booking.findMany({
    where: {
      startTime: { gte: new Date(startDate), lte: new Date(endDate) },
      ...(roomId && { roomId: parseInt(roomId) }),
    },
    include: { room: true },
  });
  const totalRevenue = bookings.reduce((sum, b) => {
    const duration = (new Date(b.endTime) - new Date(b.startTime)) / (1000 * 60 * 60);
    let total = duration * b.room.pricePerHour;
    const features = JSON.parse(b.features || '[]');
    if (features.length > 0) {
      total += features.reduce(async (sum, fId) => {
        const f = await prisma.feature.findUnique({ where: { id: fId } });
        return sum + (f?.price || 0);
      }, 0);
    }
    return sum + (b.paymentStatus === 'paid' ? total : 0);
  }, 0);
  const bookingCount = bookings.length;
  const bookingsByRoom = bookings.reduce((acc, b) => {
    acc[b.room.name] = (acc[b.room.name] || 0) + 1;
    return acc;
  }, {});
  res.json({ totalRevenue, bookingCount, bookingsByRoom });
});

app.get('/recommendations', authenticate, async (req, res) => {
  const cacheKey = `recommendations:${req.user.id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));
  const bookings = await prisma.booking.groupBy({
    by: ['roomId'],
    where: { userId: req.user.id },
    _count: { roomId: true },
    orderBy: { _count: { roomId: 'desc' } },
    take: 3,
  });
  let rooms;
  if (bookings.length === 0) {
    rooms = await prisma.room.findMany({
      include: { reviews: { select: { rating: true } } },
      take: 3,
      orderBy: { reviews: { _avg: { rating: 'desc' } } },
    });
  } else {
    const roomIds = bookings.map(b => b.roomId);
    rooms = await prisma.room.findMany({
      where: { id: { notIn: roomIds } },
      include: { reviews: { select: { rating: true } } },
      take: 3,
      orderBy: { reviews: { _avg: { rating: 'desc' } } },
    });
  }
  const result = rooms.map(r => ({
    id: r.id,
    name: r.name,
    avg_rating: r.reviews.length > 0 ? r.reviews.reduce((sum, rev) => sum + rev.rating, 0) / r.reviews.length : 0,
  }));
  await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
  res.json(result);
});

app.get('/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, role: true } });
  res.json(users);
});

app.put('/users/:id/role', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Nur Admins' });
  const { role } = req.body;
  if (!['admin', 'manager', 'citizen'].includes(role)) return res.status(400).json({ message: 'Ungültige Rolle' });
  await prisma.user.update({ where: { id: parseInt(req.params.id) }, data: { role } });
  await prisma.log.create({ data: { type: 'role_update', message: `Rolle für User ${req.params.id} zu ${role} geändert` } });
  res.json({ message: 'Rolle aktualisiert' });
});

app.listen(process.env.PORT || 5000, () => console.log('Server running'));