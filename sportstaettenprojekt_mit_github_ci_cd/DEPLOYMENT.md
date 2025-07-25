# Deployment-Anleitung

## Voraussetzungen

- Docker und Docker Compose installiert
- `.env`-Datei mit den Umgebungsvariablen

## Lokaler Start

```bash
docker compose up --build
```

## Produktion

1. Passe Umgebungsvariablen in der `.env`-Datei an
2. Baue das Projekt:
```bash
docker compose -f docker-compose.yml build
```
3. Starte im Hintergrund:
```bash
docker compose -f docker-compose.yml up -d
```

## Datenbank migrieren

```bash
npx prisma migrate deploy
```

## Weitere Hinweise

- Stelle sicher, dass Ports 3000 (App) und 5432 (Postgres) freigegeben sind.
- Nutze `docker compose logs -f` zur Überwachung.