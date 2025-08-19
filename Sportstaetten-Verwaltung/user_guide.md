Nutzer- und Anwenderdokumentation für Sportstätten-Verwaltung
Einführung
Diese App ist ein DSGVO-konformes, browserbasiertes Tool zur Verwaltung von Sport- und Veranstaltungsstätten. Es ist benutzerfreundlich, sicher und skalierbar, entwickelt für kommunale Verwaltungen. Features umfassen Buchungsanfragen, Genehmigungen, Rechnungsstellung, Zahlungen (Stripe), Kontaktformulare, öffentliche Transparenz und Mehrsprachigkeit.
Voraussetzungen

Computer mit Internet.
Node.js v20+ (https://nodejs.org/).
Browser (Chrome, Firefox, etc.).
Optional: Docker für Server-Deployment.
Stripe-Konto (Test-Modus) für Zahlungen (https://dashboard.stripe.com/test).

Installation

Repository herunterladen:
Gehe zu https://github.com/LordDigitalis/Sportstaetten-Verwaltung.
Klicke „Code“ → „Download ZIP“.
Entpacke die ZIP in einen Ordner (z. B. Dokumente/Sportstaetten-Verwaltung).


Backend einrichten:
Öffne ein Kommando-Fenster (Windows: cmd, macOS/Linux: Terminal).
Navigiere: cd Pfad/zum/Sportstaetten-Verwaltung/backend.
Installiere: npm install express sqlite3 jsonwebtoken bcryptjs cors dotenv nodemailer pdfmake express-rate-limit helmet stripe.
Kopiere .env.example zu .env und bearbeite:JWT_SECRET=meingeheim123
PORT=5000
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=deine@gmail.com
EMAIL_PASS=dein_gmail_app_passwort
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

Für Gmail: Erstelle ein App-Passwort (Google Konto → Sicherheit → 2-Faktor-Authentifizierung → App-Passwort).Für Stripe: Hole Test-Keys von https://dashboard.stripe.com/test.
Starte: node server.js.


Frontend einrichten:
Öffne ein zweites Kommando-Fenster.
Navigiere: cd Pfad/zum/Sportstaetten-Verwaltung/frontend.
Installiere: npm install react-i18next i18next i18next-browser-languagedetector i18next-http-backend @stripe/react-stripe-js @stripe/stripe-js.
Erstelle .env und füge hinzu:REACT_APP_STRIPE_PUBLIC_KEY=pk_test_...


Starte: npm start (öffnet http://localhost:3000).


Webhooks (lokal):
Installiere Stripe CLI (https://docs.stripe.com/stripe-cli).
Starte: stripe listen --forward-to localhost:5000/webhook.


Admin erstellen:
Registriere einen Nutzer unter http://localhost:3000/register.
Lade DB Browser for SQLite (https://sqlitebrowser.org/).
Öffne backend/bookings.db, Tabelle users, setze role = 'admin' für deinen Nutzer.



Funktionen

Rollen:
Citizen (Bürger): Buchungsanfragen stellen, Features auswählen, eigene Buchungen und Zahlungen sehen.
Admin: Anfragen genehmigen/ablehnen, Räume und Features verwalten, Rechnungen und Logs anzeigen.


Seiten:
/login: Anmeldung.
/register: Registrierung mit DSGVO-Einwilligung.
/public: Öffentlicher Belegungsplan (kein Login nötig).
/request: Buchungsanfrage mit Raum- und Feature-Auswahl.
/calendar: Persönlicher Kalender mit Zahlungsstatus.
/rooms: Räume und Features verwalten (Admin).
/dashboard: Admin-Übersicht mit Buchungen und Logs.
/contact: Kontaktformular.
/payment/:sessionId: Zahlungsseite (Stripe).
/success, /cancel: Zahlungsstatus.


Automatisierungen:
E-Mail-Benachrichtigungen mit Zahlungslinks.
Rechnungen (PDF) mit Feature-Kosten und Zahlungslink.
Datenlöschung nach 1 Jahr (DSGVO).
Mehrsprachigkeit: Deutsch/Englisch.
Zahlungen via Stripe (Testkarte: 4242 4242 4242 4242).



Fehlerbehebung

Server startet nicht: Überprüfe .env und Dependencies (npm install).
E-Mails fehlen: Prüfe Gmail-App-Passwort.
Zahlungen fehlen: Prüfe Stripe-Keys und Webhook (Stripe CLI).
Seite lädt nicht: Stelle sicher, dass Backend (Port 5000) und Frontend (Port 3000) laufen.
Sprache wechselt nicht: Überprüfe translations/de.json und en.json.

Stand: August 2025.