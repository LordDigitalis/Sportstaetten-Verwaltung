# Nutzer- und Anwenderdokumentation für Sportstätten-Verwaltung

## Einführung
Dieses Tool ist ein DSGVO-konformes Buchungssystem für Hallen, Veranstaltungsorte oder Räume. Es ist schlank, userfreundlich und performant, mit Features wie Buchungsanfragen, Genehmigungen, automatisierter Rechnungsstellung, Kontaktformularen und öffentlicher Transparenz für Bürger. Es orientiert sich an ähnlichen Systemen wie thewebmob.de, aber ist open-source und anpassbar.

## Systemvoraussetzungen
- Node.js v20+.
- Browser (Chrome, Firefox, etc.).
- Optionale: E-Mail-Server für Benachrichtigungen (z. B. Gmail SMTP).

## Installation und Start
1. Klone das Repo oder unzip die Dateien.
2. **Backend**:
   - Navigiere zu `backend/`.
   - Installiere Dependencies: `npm install express sqlite3 jsonwebtoken bcryptjs cors dotenv nodemailer pdfmake`.
   - Kopiere `.env.example` zu `.env` und fülle die Werte (JWT_SECRET, EMAIL_*).
   - Starte: `node server.js` (läuft auf Port 5000).
3. **Frontend**:
   - Navigiere zu `frontend/`.
   - Installiere Dependencies: `npm install react react-dom react-scripts react-router-dom fullcalendar @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction axios`.
   - Starte: `npm start` (läuft auf Port 3000).
4. Öffne `http://localhost:3000` im Browser.
5. Erstelle einen Admin: Registriere einen User, dann editiere die DB (z. B. mit SQLite Browser): Setze `role = 'admin'` für den User.

## Rollen und Funktionen
Das System unterscheidet Rollen: Citizen (Bürger), User (Standard) und Admin.

### Allgemeine Funktionen
- **Registrierung (/register)**: Erstelle Konto mit Username, E-Mail, Passwort und DSGVO-Einwilligung.
- **Login (/login)**: Melde dich an.
- **Datenschutz (/mydata)**: Siehe/lösche deine Daten (über API, integrierbar in UI bei Bedarf).
- **Kontaktformular (/contact)**: Sende Anfragen per E-Mail (public, kein Login nötig).
- **Öffentlicher Kalender (/public)**: Zeige genehmigte Belegungen (Transparenz für Bürger).

### Funktionen für Citizen (Bürger)
- **Buchungsanfrage stellen (/request)**: Wähle Raum-ID, Start- und Endzeit. Anfrage wird an Admin gesendet (per E-Mail), Status: Pending.
- **Eigene Buchungen ansehen (/calendar)**: Kalender-View mit FullCalendar, zeigt deine Buchungen (inkl. Status).
- **Rechnung herunterladen**: Nach Genehmigung per Link in der UI oder API.

### Funktionen für Admin
- **Dashboard (/dashboard)**: Übersicht über alle Buchungen/Anfragen. Genehmige/ablehne Pending-Anfragen (automatisiert E-Mail und Rechnung als PDF).
- **Räume verwalten (/rooms)**: Liste Räume, füge neue hinzu (Name, Kapazität).
- **Rechnungen generieren**: Automatisch bei Genehmigung (PDF mit Details, herunterladbar).

## Automatisierte Prozesse
- Konfliktprüfung bei Buchungen (keine Überlappungen).
- E-Mail-Benachrichtigungen bei Anfragen, Genehmigungen, Ablehnungen.
- Automatische Datenlöschung (alte Buchungen nach 1 Jahr, DSGVO).
- Rechnungsstellung: PDF-Generierung mit Basis-Details (anpassbar).

## Userfreundlichkeit und Performanz
- Intuitive UI mit React und FullCalendar (responsiv, mobilfreundlich).
- Asynchrone APIs für schnelle Ladezeiten.
- Keine Installation nötig (web-basiert).

## Troubleshooting
- **Fehler bei Start**: Überprüfe Dependencies und .env.
- **E-Mails nicht gesendet**: Überprüfe SMTP-Konfig (z. B. allow less secure apps in Gmail).
- **DB-Probleme**: `bookings.db` wird automatisch erstellt; lösche sie für Reset.
- **Sicherheit**: In Prod nutze HTTPS und Rate-Limiting.
- **Erweiterungen**: Füge Features wie Zahlungen oder Multi-User hinzu.

## DSGVO-Konformität
- Minimale Datensammlung.
- Explizite Einwilligungen.
- Löschrechte implementiert.
- Siehe `privacy.md` für Details.

Stand: 13. August 2025. Feedback? Kontaktiere uns!