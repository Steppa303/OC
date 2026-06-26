# Usenet Media Pipeline — Handover

**Datum:** 2026-06-19 06:30
**Status:** ✅ Produktiv (6/7 Container laufen, Gerbera deaktiviert)

---

## 1. Was ist das?

Komplette Usenet-Media-Pipeline auf dem VPS. Filme und Serien werden automatisch gesucht, heruntergeladen, entpackt und über Jellyfin im Heimnetz bereitgestellt. Zugriff im Heimnetz über WireGuard (192.168.178.204) via Jellyfin App.

---

## 2. Sofort starten

### Schritt 1: Jellyfin auf Fire TV einrichten (2 Min)
1. Fire TV → App Store → **"Jellyfin"** suchen → installieren
2. App öffnen → "Add Server"
3. URL eingeben: `http://192.168.178.204:8096`
4. Login: `root` / (leer → **sofort in der Web-UI ändern!**)
5. Fertig — Cover-Art, Suche, Untertitel, Transcoding inklusive

⚠️ **Keine automatische Erkennung!** Server muss manuell verbunden werden (einmalig).
Browser-Zugang: `http://192.168.178.204:8096`

### Schritt 2: Erste Serie (Sonarr)
1. `http://192.168.178.204:8989`
2. Series → Add New → Suche → Root Folder `/tv` → Add
3. Sonarr sucht automatisch und lädt über SABnzbd herunter

### Schritt 3: Ersten Film (Radarr)
1. `http://192.168.178.204:7878`
2. Movies → Add New → Suche → Root Folder `/movies` → Add
3. Radarr sucht automatisch und lädt über SABnzbd herunter

### Schritt 4: In Jellyfin schauen
Downloads erscheinen automatisch in Jellyfin nach dem Scan (alle 60 Min oder manuell).

---

## 3. Web UIs

| Service | URL | Wofür |
|---------|-----|-------|
| **Jellyfin** | `http://192.168.178.204:8096` | Streamen (TV, Phone, Browser) |
| **Sonarr** | `http://192.168.178.204:8989` | Serien verwalten |
| **Radarr** | `http://192.168.178.204:7878` | Filme verwalten |
| **SABnzbd** | `http://192.168.178.204:8080` | Download-Queue |
| **NZBHydra2** | `http://192.168.178.204:5076` | NZB-Suche |

Alle via WireGuard (192.168.178.204) im Heimnetz erreichbar.

---

## 4. Container-Status (Stand 19.06.2026)

| Container | Status | Anmerkung |
|-----------|--------|-----------|
| jellyfin | ✅ Running (healthy) | Media Server |
| sonarr | ✅ Running | TV-Serien |
| radarr | ✅ Running | Filme |
| sabnzbd | ✅ Running | Download Client |
| nzbhydra2 | ✅ Running | Meta-Indexer |
| nzbindex-adapter | ✅ Running | NZBIndex Fallback |
| gerbera | ❌ Exit 1 | UPnP Server — **nicht mehr benötigt** |

---

## 5. Credentials

```
Jellyfin:     root / (leer → sofort ändern!)
NZBGeek:      IQyoR1TxOWUDBsJkwqjZldsSMHC8UfJj
NZBHydra2:    6JKUHIE6HHUJK46H4151PMDMME
SABnzbd:      ff9a61fe645f4e989477b2842d66b8ba
Sonarr:       536a0a31419540838dfdc4890b035098
Radarr:       12b10ba8e90e4eeb9b59034efdf938ea
Usenet:       steppa@tuta.io / ngn#Jungle68 @ news-nl.newsgroup.ninja:563
```

---

## 6. Alltag

1. Serie/Film in Sonarr/Radarr hinzufügen
2. Automatische Suche → NZB über NZBHydra2/NZBGeek
3. Download über SABnzbd (Newsgroup Ninja)
4. Auto-Rename + Verschieben in Library
5. Jellyfin stellt bereit → Streamen

**Jellyfin Apps:** Fire TV (App Store), Android, iOS, Smart TV, Browser

---

## 7. Wartung

| Aufgabe | Befehl |
|---------|--------|
| Status prüfen | `docker ps` |
| Alle neustarten | `cd /srv/clawshare/usenet && docker compose restart` |
| Einzelne neustarten | `docker restart <name>` |
| Logs | `docker logs -f <name>` |
| Disk prüfen | `df -h /srv/clawshare/` |
| Updates | `cd /srv/clawshare/usenet && docker compose pull && docker compose up -d` |
| DLNA/UPnP aufräumen | `systemctl stop minidlna smcroute && systemctl disable minidlna smcroute && docker rm gerbera` |

---

## 8. Bekannte Issues

| Problem | Lösung |
|---------|--------|
| SABnzbd "host not allowed" | `host_whitelist` in sabnzbd.ini erweitern |
| NZBHydra2 Indexer disabled | Config via API re-enablen (siehe Doku) |
| NZBHydra2 Config verloren nach Restart | YAML direkt editieren |
| Jellyfin nicht sichtbar im LAN | Manuell verbinden: `http://192.168.178.204:8096` |
| NZBIndex liefert keine NZBs | NZBIndex Adapter als Fallback aktiv |
| DLNA/UPnP funktioniert nicht über WireGuard | Erwartetes Verhalten — Jellyfin App verwenden |
| Gerbera startet nicht (Exit 1) | Nicht mehr relevant — kann entfernt werden |

---

## 9. Dateien

| Datei | Zweck |
|-------|-------|
| `/srv/clawshare/usenet/docker-compose.yml` | Docker Stack |
| `/srv/clawshare/usenet/nzbindex-adapter/adapter.py` | NZBIndex Adapter |
| `/srv/clawshare/usenet/config/` | Service-Konfigs |
| `/root/.openclaw/workspace/.secrets/usenet.env` | Credentials |
| `/etc/minidlna.conf` | MiniDLNA Config (deprecated) |
| `/etc/smcroute.conf` | smcroute Config (deprecated) |
| `projects/usenet-media-pipeline/DOKUMENTATION.md` | Technische Doku |
| `projects/usenet-media-pipeline/HANDOVER.md` | Diese Datei |
| `projects/usenet-media-pipeline/KONZEPT.md` | Architektur-Konzept |

---

## 10. Nächste Schritte

- [ ] **Jellyfin Passwort setzen** — aktuell leer, Sicherheitsrisiko!
- [ ] **Fire TV Jellyfin App testen** — Verbindung mit `http://192.168.178.204:8096`
- [ ] **Fritzbox Mediaserver deaktivieren** — nicht mehr benötigt, spart Ressourcen
- [ ] **MiniDLNA/smcroute/Gerbera aufräumen** — tote Infrastruktur entfernen
- [ ] Erste Serie/Film downloaden und in Jellyfin verifizieren
- [ ] Optional: Caddy Reverse Proxy für externen Zugang (HTTPS)

---

_Handover: 2026-06-19 06:30 — DLNA-Experimente dokumentiert, Jellyfin App als Standard-Lösung, Aufräumen-Todos hinzugefügt_
