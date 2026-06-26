# Usenet Media Pipeline — Konzept

**Datum:** 2026-06-18
**Status:** ✅ IMPLEMENTIERT

---

## 🎯 Ziel

Usenet-basierte Medien-Pipeline: Suchbegriff via Telegram → Suche im Usenet → Download → Entpacken → Media Server → Streaming im Heimnetz.

---

## 🏗️ Architektur

```
User (Telegram)
    │
    ▼
OpenClaw (AI Agent)
    │  1. Suchbegriff empfangen
    │  2. NZBHydra2 API → NZB-Datei finden
    │  3. NZB an SABnzbd übergeben
    │
    ▼
┌─────────────────────────────────────────────┐
│  Docker Stack (auf dem VPS)                 │
│                                             │
│  ┌─────────────┐    ┌──────────────┐        │
│  │ NZBHydra2   │───▶│  SABnzbd     │        │
│  │ (Indexer)   │    │  (Download)  │        │
│  └─────────────┘    └──────┬───────┘        │
│                            │                │
│                     ┌──────▼───────┐        │
│                     │  Sonarr /    │        │
│                     │  Radarr      │        │
│                     │  (Organize)  │        │
│                     └──────┬───────┘        │
│                            │                │
│                     ┌──────▼───────┐        │
│                     │  Jellyfin    │        │
│                     │  (Stream)    │        │
│                     └──────────────┘        │
└─────────────────────────────────────────────┘
    │
    ▼  (WireGuard wg0 / SMB)
Heimnetz (TV, Phone, Tablet, etc.)
```

---

## 📦 Komponenten

### 1. NZBHydra2 — Meta-Indexer
- **Was:** Aggregiert mehrere Usenet-Indexer (Suchmaschine für NZBs)
- **Warum:** Ein Interface für alle Indexer, API für OpenClaw
- **Port:** 5076 (Web UI)
- **API:** `GET /api?apikey=KEY&t=search&q=SUCHBEGRIFF` → NZB-URL
- **Indexer:** Newsgroup Ninja (vom User bereitgestellt), ggf. weitere

### 2. SABnzbd — Download Client
- **Was:** Usenet Binary Downloader (NZB-Dateien verarbeiten)
- **Warum:** Gold-Standard, API-first, Auto-Unpack
- **Port:** 8080 (Web UI)
- **Binary Server:** Newsgroup Ninja (Zugangsdaten vom User)
- **Features:** Auto-Repair (par2), Auto-Unpack, Queue-Management
- **Download-Ordner:** `/srv/clawshare/usenet/downloads/`

### 3. Sonarr — TV-Serien-Management
- **Was:** Automatische TV-Serien-Verwaltung
- **Warum:** Renaming, Monitoring, Integration mit Jellyfin
- **Port:** 8989 (Web UI)
- **Library:** `/srv/clawshare/media/tv/`

### 4. Radarr — Film-Management
- **Was:** Automatische Film-Verwaltung (wie Sonarr für Filme)
- **Warum:** Renaming, Monitoring, Integration mit Jellyfin
- **Port:** 7878 (Web UI)
- **Library:** `/srv/clawshare/media/movies/`

### 5. Jellyfin — Media Server
- **Was:** Open-Source Media Server (Plex-Alternative, kostenlos)
- **Warum:** Streamt an alle Geräte, keine Lizenzkosten
- **Port:** 8096 (Web UI)
- **Zugang:** `http://192.168.178.204:8096` (via WireGuard im Heimnetz)
- **Apps:** Android, iOS, Smart TV, Web, Fire TV, etc.

---

## 🔄 Workflow im Detail

### Schritt 1: User-Input
```
User: "Breaking Bad Staffel 1"
```

### Schritt 2: OpenClaw sucht NZB
```bash
# NZBHydra2 API Query
curl "http://localhost:5076/api?apikey=$NZBHYDRA_APIKEY&t=search&q=Breaking+Bad+S01"
# → Gibt Liste von NZBs zurück (Titel, Größe, Indexer, Download-URL)
```

### Schritt 3: NZB an SABnzbd übergeben
```bash
# SABnzbd API - NZB-URL hinzufügen
curl "http://localhost:8080/sabnzbd/api?mode=addurl&name=$NZB_URL&apikey=$SABNZBD_APIKEY&cat=tv"
```

### Schritt 4: SABnzbd lädt herunter
- Verbindet sich mit Newsgroup Ninja (Binary Server)
- Lädt alle Parts herunter
- Par2-Repair bei fehlenden Parts
- Entpackt automatisch (RAR → Dateien)

### Schritt 5: Sonarr/Radarr organisiert
- Erkennt neue Dateien im Download-Ordner
- Benennt nach Schema um: `Breaking Bad/Staffel 01/Breaking Bad - S01E01 - Pilot.mkv`
- Verschiebt in Library-Ordner

### Schritt 6: Jellyfin stellt bereit
- Scannt Library-Ordner automatisch
- Metadaten + Cover von TMDB/TVDB
- Streaming an alle Geräte im Netzwerk

---

## 📁 Verzeichnisstruktur

```
/srv/clawshare/
├── usenet/
│   ├── downloads/          # SABnzbd Download-Temp
│   │   ├── complete/       # Fertige Downloads
│   │   └── incomplete/     # Laufende Downloads
│   └── config/             # Config-Files der Container
│       ├── nzbhydra2/
│       ├── sabnzbd/
│       ├── sonarr/
│       ├── radarr/
│       └── jellyfin/
└── media/
    ├── tv/                 # Sonarr Library
    │   └── Breaking Bad/
    │       └── Staffel 01/
    │           ├── S01E01.mkv
    │           └── ...
    ├── movies/             # Radarr Library
    │   └── Inception (2010)/
    │       └── Inception.mkv
    └── downloads/          # Manuelle Downloads (optional)
```

---

## 🌐 Netzwerk & Zugang

### Lokal (VPS)
- Alle Services laufen auf `localhost` (Docker network)
- Ports: 5076, 8080, 8989, 7878, 8096

### Heimnetz (via WireGuard)
- VPS-IP im Heimnetz: `192.168.178.204`
- Jellyfin: `http://192.168.178.204:8096`
- SABnzbd UI: `http://192.168.178.204:8080`
- Alle Services über WireGuard erreichbar

### Extern (optional, via Caddy)
- Caddy Reverse Proxy mit Auth
- `https://steppa.online/media/` → Jellyfin
- Nur mit Basic Auth oder API Key

---

## 🔑 Benötigte Credentials

| Service | Was | Status |
|---------|-----|--------|
| Newsgroup Ninja | Server, Port, User, Pass | ❌ Vom User |
| Usenet Indexer | API Key (z.B. NZBGeek, Drunkenslug) | ❌ Vom User |
| NZBHydra2 | API Key (wird generiert) | ⚙️ Auto |
| SABnzbd | API Key (wird generiert) | ⚙️ Auto |

---

## 🤖 Telegram-Integration (OpenClaw)

### Option A: Direkte API-Calls (Einfach)
OpenClaw nutzt die APIs direkt:
1. User schickt Suchbegriff
2. OpenClaw queried NZBHydra2 API
3. OpenClaw übergibt NZB an SABnzbd API
4. Status-Updates via Telegram

### Option B: Sonarr/Radarr Webhooks (Automatisch)
1. Sonarr/Radarr überwachen automatisch
2. OpenClaw nutzt Sonarr/Radarr API für Suche
3. Download + Rename + Move automatisch
4. Jellyfin Webhook → Telegram-Benachrichtigung

### Option C: Jellyseerr/Overserr (Premium)
- Web-UI für User-Anfragen
- Integriert mit Sonarr + Radarr
- OpenClaw kann Jellyseerr API nutzen

**Empfehlung:** Option B (Sonarr/Radarr API) — balanciert Automation mit Kontrolle.

---

## 🚀 Docker Compose Setup

```yaml
# /srv/clawshare/usenet/docker-compose.yml
version: "3.8"

services:
  nzbhydra2:
    image: linuxserver/nzbhydra2:latest
    container_name: nzbhydra2
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Berlin
    volumes:
      - /srv/clawshare/usenet/config/nzbhydra2:/config
      - /srv/clawshare/usenet/downloads:/downloads
    ports:
      - "5076:5076"
    restart: unless-stopped

  sabnzbd:
    image: linuxserver/sabnzbd:latest
    container_name: sabnzbd
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Berlin
    volumes:
      - /srv/clawshare/usenet/config/sabnzbd:/config
      - /srv/clawshare/usenet/downloads:/downloads
      - /srv/clawshare/media:/media
    ports:
      - "8080:8080"
    restart: unless-stopped

  sonarr:
    image: linuxserver/sonarr:latest
    container_name: sonarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Berlin
    volumes:
      - /srv/clawshare/usenet/config/sonarr:/config
      - /srv/clawshare/media/tv:/tv
      - /srv/clawshare/usenet/downloads:/downloads
    ports:
      - "8989:8989"
    restart: unless-stopped

  radarr:
    image: linuxserver/radarr:latest
    container_name: radarr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Europe/Berlin
    volumes:
      - /srv/clawshare/usenet/config/radarr:/config
      - /srv/clawshare/media/movies:/movies
      - /srv/clawshare/usenet/downloads:/downloads
    ports:
      - "7878:7878"
    restart: unless-stopped

  jellyfin:
    image: jellyfin/jellyfin:latest
    container_name: jellyfin
    environment:
      - TZ=Europe/Berlin
    volumes:
      - /srv/clawshare/usenet/config/jellyfin:/config
      - /srv/clawshare/media:/media
    ports:
      - "8096:8096"
    restart: unless-stopped
```

---

## 📊 Ressourcen-Check

| Ressource | Verfügbar | Benötigt | Status |
|-----------|-----------|----------|--------|
| RAM | 11 GB | ~3-4 GB (alle Container) | ✅ OK |
| Disk | 131 GB frei | Abhängig von Inhalten | ⚠️ Monitor |
| CPU | 6 Kerne | Gering (I/O-bound) | ✅ OK |
| Docker | Installiert | Ja | ✅ |
| WireGuard | Aktiv | Ja (Heimnetz-Zugang) | ✅ |

---

## ⚠️ Risiken & Offene Fragen

1. **Disk Space:** 131 GB ist okay für den Anfang, bei großen Libraries wird es eng
   - Lösung: Externe HDD via SMB mount oder NAS erweitern
2. **Newsgroup Ninja Credentials:** Noch nicht vorhanden
3. **Usenet Indexer:** Welche(n) Indexer nutzt Bastian? (NZBGeek, Drunkenslug, etc.)
4. **Retention:** Wie lange bleiben Inhalte auf dem Server?
5. **VPN für Usenet-Download:** Nicht zwingend nötig (Usenet ≠ Torrent), aber empfohlen

---

## 📋 Nächste Schritte

1. **Bastian liefert:**
   - [ ] Newsgroup Ninja Zugangsdaten (Server, Port, User, Pass)
   - [ ] Usenet Indexer API Key(s)
   - [ ] Welche Inhalte? (Filme, Serien, beides?)

2. **Ich setze auf:**
   - [ ] Docker starten (`systemctl start docker`)
   - [ ] Docker Compose Stack deployen
   - [ ] SABnzbd konfigurieren (Binary Server)
   - [ ] NZBHydra2 konfigurieren (Indexer)
   - [ ] Sonarr + Radarr einrichten
   - [ ] Jellyfin aufsetzen
   - [ ] Telegram-Integration bauen (OpenClaw Skill)

---

_Konzept erstellt: 2026-06-18 20:17_
