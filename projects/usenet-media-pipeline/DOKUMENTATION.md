# Usenet Media Pipeline — Technische Dokumentation

**Erstellt:** 2026-06-18
**Letztes Update:** 2026-06-19 06:30
**Server:** vmd190638 (Contabo VPS, 185.217.126.72)
**WireGuard IP:** 192.168.178.204 (Heimnetz)

---

## 1. Übersicht

Automatisierte Usenet-basierte Medien-Pipeline: Suchbegriff → NZB-Suche → Download → Entpacken → Media Server → Streaming im Heimnetz.

```
User (Sonarr / Radarr / Jellyfin App)
    │
    ▼
NZBHydra2 (Meta-Indexer, Port 5076)
    │  ├─ NZBGeek (Primary, 3.500+ Ergebnisse)
    │  └─ NZBIndex Adapter (Fallback, Custom, Port 5077)
    ▼
SABnzbd (Download Client, Port 8080)
    │  └─ Newsgroup Ninja (Binary Server, SSL:563)
    ▼
Sonarr (TV, Port 8989) / Radarr (Movies, Port 7878)
    │  └─ Auto-Rename + Library Management
    ▼
Jellyfin (Media Server, Port 8096)
    │
    ▼
Heimnetz (TV, Phone, Tablet, Browser)
    └─ Zugang via WireGuard: 192.168.178.204
```

---

## 2. Infrastructure

### 2.1 Docker Stack

**Compose-Datei:** `/srv/clawshare/usenet/docker-compose.yml`

| Container | Image | Port | Status | Funktion |
|-----------|-------|------|--------|----------|
| `nzbhydra2` | linuxserver/nzbhydra2:latest | 5076 | ✅ Running | Meta-Indexer (NZB-Suche) |
| `nzbindex-adapter` | Custom (Python 3.12) | 5077 | ✅ Running | NZBIndex API → Newznab Adapter |
| `sabnzbd` | linuxserver/sabnzbd:latest | 8080 | ✅ Running | Usenet Download Client |
| `sonarr` | linuxserver/sonarr:latest | 8989 | ✅ Running | TV-Serien Management |
| `radarr` | linuxserver/radarr:latest | 7878 | ✅ Running | Film Management |
| `jellyfin` | jellyfin/jellyfin:latest | 8096 | ✅ Running (healthy) | Media Server |
| `gerbera` | gerbera/gerbera:latest | — | ❌ Exit 1 | UPnP Server (deaktiviert) |

### 2.2 Verzeichnisstruktur

```
/srv/clawshare/
├── usenet/
│   ├── docker-compose.yml
│   ├── nzbindex-adapter/
│   │   ├── adapter.py              # NZBIndex → Newznab Adapter
│   │   └── Dockerfile
│   ├── config/
│   │   ├── nzbhydra2/nzbhydra.yml
│   │   ├── sabnzbd/sabnzbd.ini
│   │   ├── sonarr/config.xml
│   │   ├── radarr/config.xml
│   │   └── jellyfin/config/
│   └── downloads/
│       ├── complete/
│       └── incomplete/
└── media/
    ├── movies/                     # Radarr → Jellyfin
    └── tv/                         # Sonarr → Jellyfin
```

### 2.3 Netzwerk

Alle Container laufen im Docker Bridge Network `usenet_default`.
Interne Kommunikation über Container-Namen (z.B. `http://sabnzbd:8080`).

**Zugriff aus dem Heimnetz:**
- WireGuard IP: `192.168.178.204`
- Alle Services sind über diese IP + Port erreichbar
- **Keine automatische DLNA/UPnP-Discovery** über WireGuard (siehe Abschnitt 3.6)
- **Lösung:** Jellyfin App mit manueller Server-URL

### 2.4 DLNA/UPnP Status (Stand 19.06.2026)

**Problem:** SSDP-Multicast-Pakete (239.255.255.250:1900) werden von WireGuard nicht ins Fritzbox-LAN propagiert. Multicast-Routing über VPN-Tunnel funktioniert nicht zuverlässig.

**Getestete Ansätze (alle gescheitert):**
1. **MiniDLNA auf wg0** — SSDP-Pakete gehen raus (tcpdump bestätigt), erreichen aber das LAN nicht
2. **smcroute** — Konfiguriert für Multicast-Join auf wg0, ändert nichts am Problem
3. **Gerbera (Docker)** — Container startet nicht (Exit 1), keine Bemühungen mehr wert

**Aktuell aktiv (aber nutzlos):**
- MiniDLNA (`systemctl status minidlna`) — läuft auf Port 8200, bound an wg0
- smcroute (`systemctl status smcroute`) — aktiv, aber Multicast geht nicht durch WireGuard

**Fazit:** DLNA/UPnP über WireGuard ist tot. Jellyfin-App ist die einzig sinnvolle Lösung.

---

## 3. Service-Konfiguration

### 3.1 SABnzbd

**Zugang:** `http://192.168.178.204:8080`
**API Key:** `ff9a61fe645f4e989477b2842d66b8ba`

**Usenet Server (Newsgroup Ninja):**
| Feld | Wert |
|------|------|
| Host | `news-nl.newsgroup.ninja` |
| Port | `563` (SSL) |
| Connections | `50` |
| User | `steppa@tuta.io` |

**Config:** `/srv/clawshare/usenet/config/sabnzbd/sabnzbd.ini`

### 3.2 NZBHydra2

**Zugang:** `http://192.168.178.204:5076`
**API Key:** `6JKUHIE6HHUJK46H4151PMDMME`

**Indexer:**

| Indexer | Host | Priorität | Ergebnisse (Test) |
|---------|------|-----------|-------------------|
| **NZBGeek** | `https://api.nzbgeek.info` | 100 (Primary) | ~3.500 |
| **NZBIndex-Adapter** | `http://nzbindex-adapter:5077` | 0 (Fallback) | ~860 |

**NZBGeek API Key:** `IQyoR1TxOWUDBsJkwqjZldsSMHC8UfJj`

**Config:** `/srv/clawshare/usenet/config/nzbhydra2/nzbhydra.yml`

### 3.3 Sonarr (TV-Serien)

**Zugang:** `http://192.168.178.204:8989`
**API Key:** `536a0a31419540838dfdc4890b035098`

- Indexer: NZBHydra2 (`http://nzbhydra2:5076/api`)
- Download Client: SABnzbd (`http://sabnzbd:8080`)
- TV Library: `/srv/clawshare/media/tv` (Host) → `/tv` (Container)
- Kategorien: 5000-5080 (TV)

### 3.4 Radarr (Filme)

**Zugang:** `http://192.168.178.204:7878`
**API Key:** `12b10ba8e90e4eeb9b59034efdf938ea`

- Indexer: NZBHydra2 (`http://nzbhydra2:5076/api`)
- Download Client: SABnzbd (`http://sabnzbd:8080`)
- Movie Library: `/srv/clawshare/media/movies` (Host) → `/movies` (Container)
- Kategorien: 2000-2080 (Movies)

### 3.5 Jellyfin

**Zugang:** `http://192.168.178.204:8096`
**User:** `root`
**Passwort:** (leer → sofort über Web UI ändern!)

**Libraries:**
- **Movies** → `/media/movies` (Container) → `/srv/clawshare/media/movies`
- **TV Shows** → `/media/tv` (Container) → `/srv/clawshare/media/tv`

**Apps für Endgeräte:**
- **Fire TV** → Amazon App Store → "Jellyfin" → Server-URL manuell eingeben
- Android / iOS → jeweiliger App Store
- Smart TV (Samsung/LG) → eigene Apps verfügbar
- Browser → `http://192.168.178.204:8096`

**⚠️ Wichtig — Keine automatische Discovery:**
Jellyfin nutzt UDP-Multicast (Port 7359) für automatische Servererkennung im LAN.
Das funktioniert **nicht** über WireGuard. Server muss **manuell** verbunden werden:

1. Jellyfin App öffnen
2. "Add Server" oder "Verbinden mit Server"
3. URL eingeben: `http://192.168.178.204:8096`
4. Login: `root` / (Passwort)
5. App merkt sich die Verbindung (einmalig)

### 3.6 DLNA/UPnP (deprecated — nur zu Dokumentationszwecken)

**MiniDLNA** ist aktiv, aber **funktional nutzlos** über WireGuard:

- **Config:** `/etc/minidlna.conf`
- **Port:** 8200 (bound an `wg0`)
- **Service:** `systemctl status minidlna`
- **smcroute:** `systemctl status smcroute` (Multicast-Routing)

**Warum es nicht funktioniert:**
SSDP-Multicast (239.255.255.250:1900) wird von WireGuard encapsulated als Unicast-Paket an den Peer (Fritzbox). Die Fritzbox leitet diese Pakete **nicht** ins lokale LAN weiter. Kein Relay-Konfigurationsweg gefunden.

**Aufräumen (wenn gewünscht):**
```bash
systemctl stop minidlna smcroute
systemctl disable minidlna smcroute
docker rm gerbera
```

---

## 4. API Referenz

### 4.1 NZBHydra2 (Newznab-kompatibel)

```bash
# Suche
curl "http://localhost:5076/api?apikey=***&t=search&q=SUCHBEGRIFF"

# TV-Suche (TVDB ID)
curl "http://localhost:5076/api?apikey=***&t=tvsearch&tvdbid=81189&season=1&ep=1"

# Film-Suche (IMDB ID)
curl "http://localhost:5076/api?apikey=***&t=movie&imdbid=tt0468569"

# JSON Output
curl "http://localhost:5076/api?apikey=***&t=search&q=test&o=json"
```

### 4.2 SABnzbd

```bash
# Queue
curl "http://localhost:8080/api?mode=queue&output=json&apikey=***"

# NZB-URL hinzufügen
curl "http://localhost:8080/api?mode=addurl&name=URL&apikey=***"

# Server-Status
curl "http://localhost:8080/api?mode=server_stats&output=json&apikey=***"
```

### 4.3 Sonarr / Radarr

```bash
# Serie suchen (Sonarr)
curl "http://localhost:8989/api/v3/series/lookup?term=breaking+bad" -H "X-Api-Key: ***"

# Film suchen (Radarr)
curl "http://localhost:7878/api/v3/movie/lookup?term=inception" -H "X-Api-Key: ***"
```

---

## 5. NZBIndex Adapter (Custom)

**Problem:** NZBIndex hat seine API von Newznab-XML auf eigene JSON-API umgestellt.
**Lösung:** Custom Python-Adapter als Übersetzer.

| Komponente | Endpoint |
|------------|----------|
| NZBIndex Suche | `GET https://nzbindex.com/api/search?q=...` → JSON |
| NZBIndex Download | `GET https://nzbindex.com/api/download/{id}.nzb` → NZB XML |
| Adapter Suche | `GET http://localhost:5077/api?t=search&q=...` → Newznab XML |
| Adapter Download | `GET http://localhost:5077/api/download/{id}.nzb` → NZB XML |
| Adapter Caps | `GET http://localhost:5077/api?t=caps` → Newznab Caps XML |

**Quellcode:** `/srv/clawshare/usenet/nzbindex-adapter/adapter.py`

```bash
# Rebuild
cd /srv/clawshare/usenet && docker compose build nzbindex-adapter && docker compose up -d nzbindex-adapter
```

---

## 6. Betrieb

### 6.1 Starten / Stoppen

```bash
cd /srv/clawshare/usenet
docker compose up -d       # Alle starten
docker compose down        # Alle stoppen
docker compose restart     # Alle neustarten
docker restart sabnzbd     # Einzeln neustarten
docker logs -f sabnzbd     # Live-Logs
```

### 6.2 Updates

```bash
cd /srv/clawshare/usenet
docker compose pull        # Images aktualisieren
docker compose up -d       # Container neu erstellen
```

### 6.3 Backup

```bash
tar czf /root/usenet-backup-$(date +%Y%m%d).tar.gz \
  /srv/clawshare/usenet/docker-compose.yml \
  /srv/clawshare/usenet/config/ \
  /srv/clawshare/usenet/nzbindex-adapter/ \
  /root/.openclaw/workspace/.secrets/usenet.env
```

### 6.4 Monitoring

```bash
# Container Status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Disk Usage
df -h /srv/clawshare/
du -sh /srv/clawshare/usenet/downloads/ /srv/clawshare/media/
```

---

## 7. Troubleshooting

### 7.1 SABnzbd: "Host not allowed"
```bash
sed -i 's/host_whitelist = .*/host_whitelist = localhost,127.0.0.1,sabnzbd,/' \
  /srv/clawshare/usenet/config/sabnzbd/sabnzbd.ini
docker restart sabnzbd
```

### 7.2 NZBHydra2: Indexer disabled nach Fehler
```bash
CONFIG=$(curl -s "http://localhost:5076/internalapi/config")
echo "$CONFIG" | python3 -c "
import sys,json; d=json.load(sys.stdin)
for i in d['indexers']: i['disabledUntil']=None
json.dump(d, open('/tmp/c.json','w'), indent=2)"
curl -X PUT "http://localhost:5076/internalapi/config" -H "Content-Type: application/json" -d @/tmp/c.json
```

### 7.3 NZBHydra2: Config geht bei Restart verloren
Config direkt in YAML editieren, nicht nur via API:
```bash
vi /srv/clawshare/usenet/config/nzbhydra2/nzbhydra.yml
docker restart nzbhydra2
```

### 7.4 NZBHydra2: Enum-Fehler (TVDBID vs TVDB)
NZBHydra2 v8.x erwartet: `TVDB`, `IMDB`, `TMDB`, `TVMAZE` (nicht `TVDBID`, `IMDBID`, etc.)

### 7.5 Jellyfin: Nicht erreichbar aus dem Heimnetz
- Prüfen ob WireGuard aktiv: `wg show wg0` (latest handshake < 2 Min)
- Manuell verbinden: `http://192.168.178.204:8096`
- Keine automatische Discovery über WireGuard!

### 7.6 Jellyfin App auf Fire TV
1. Fire TV → App Store → "Jellyfin" suchen → installieren
2. App öffnen → "Add Server"
3. URL eingeben: `http://192.168.178.204:8096`
4. Login: `root` / (Passwort)
5. Fertig — Cover-Art, Suche, Untertitel, Transcoding alles inklusive

---

## 8. Erweiterungen

- [ ] Caddy Reverse Proxy für externen Zugang (HTTPS + Auth)
- [ ] Telegram-Bot Integration (Suche via Chat)
- [ ] 4K/UHD Profile in Sonarr/Radarr
- [ ] Automatische Disk-Cleanup bei <10GB frei
- [ ] Weitere Indexer (Drunkenslug, NZB.su)
- [ ] Overseerr/Jellyseerr für User-Anfragen
- [ ] MiniDLNA/smcroute aufräumen (nicht mehr benötigt)
- [ ] Gerbera Container entfernen (`docker rm gerbera`)
- [ ] Jellyfin Passwort setzen (aktuell leer!)
- [ ] Fritzbox Mediaserver deaktivieren (nicht mehr benötigt)

---

## 9. Credentials

| Service | User | API Key / Passwort |
|---------|------|--------------------|
| Newsgroup Ninja | steppa@tuta.io | ngn#Jungle68 |
| NZBGeek | — | IQyoR1TxOWUDBsJkwqjZldsSMHC8UfJj |
| NZBHydra2 | — | 6JKUHIE6HHUJK46H4151PMDMME |
| SABnzbd | — | ff9a61fe645f4e989477b2842d66b8ba |
| Sonarr | — | 536a0a31419540838dfdc4890b035098 |
| Radarr | — | 12b10ba8e90e4eeb9b59034efdf938ea |
| Jellyfin | root | (leer → Web UI setzen!) |

**Credentials-Datei:** `/root/.openclaw/workspace/.secrets/usenet.env`

---

_Dokumentation: 2026-06-19 06:30 — DLNA/UPnP-Sektion aktualisiert, Fire TV Jellyfin App als Standard-Lösung dokumentiert, Gerbera als deprecated markiert_
