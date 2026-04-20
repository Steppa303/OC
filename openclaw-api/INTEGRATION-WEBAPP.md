# OpenClaw Web-App Integration

Komplette Anleitung zur Integration der React Web-App mit dem OpenClaw REST API Server.

---

## 📋 ÜBERBLICK

```
┌─────────────────┐      HTTP POST       ┌──────────────────┐
│   React Web App │ ──────────────────→  │  OpenClaw Server │
│   (localhost)   │    JSON: command     │  (localhost:8000)│
│                 │    + parameters      │                  │
└─────────────────┘ ← ────────────────── └──────────────────┘
                     JSON: status + data
```

---

## 🔧 SCHRITT 1: SERVER URL ANPASSEN

### In der React Web-App:

**Datei:** `App.tsx` (oder wo `serverUrl` definiert ist)

```typescript
// OLD (Zeile ~90):
const [serverUrl, setServerUrl] = useState('http://localhost:8080/api/command');

// NEW:
const [serverUrl, setServerUrl] = useState('http://localhost:8000/api/command');
```

**ODER** in den Einstellungen der App eintragen:
- Öffne die App
- Klicke auf Settings (Zahnrad)
- Trage ein: `http://localhost:8000/api/command`
- Speichern

---

## 🔧 SCHRITT 2: SERVER STARTEN

```bash
cd /root/.openclaw/workspace/openclaw-api

# Dependencies installieren (falls noch nicht geschehen)
pip install -r requirements.txt

# Server starten
python3 main.py
```

**Erwartete Ausgabe:**
```
INFO:     Starting OpenClaw REST API Server...
INFO:     Host: 0.0.0.0
INFO:     Port: 8000
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## 🔧 SCHRITT 3: CORS KONFIGURIEREN

### Für Development (lokales Testing):

**In `.env`:**
```bash
CORS_ORIGINS=*
```

### Für Production:

**In `.env`:**
```bash
# Trage die URL deiner Web-App ein
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-app.com
```

**Server neu starten nach Änderung!**

---

## 🔧 SCHRITT 4: COMMAND MAPPING TESTEN

### Verfügbare Commands:

| Web-App Command | Server Command | Beschreibung |
|-----------------|----------------|--------------|
| `GRAB` | `greifen` | Greifer schließen |
| `GRIP` | `greifen` | Greifer schließen |
| `GREIFEN` | `greifen` | Greifer schließen |
| `MOVE` | `bewegen` | Arm bewegen |
| `BEWEGEN` | `bewegen` | Arm bewegen |
| `RELEASE` | `release` | Greifer öffnen |
| `STATUS` | `status` | Status abfragen |
| `SCAN` | `scan` | Umgebung scannen |
| `STOP` | `stop` | Not-Halt |

### Test mit curl:

```bash
# GRAB Command
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{"command": "GRAB", "parameters": {"position": 50}}'

# MOVE Command
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{"command": "MOVE", "parameters": {"x": 50, "y": 0, "z": -25}}'

# STATUS Command
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{"command": "STATUS"}'
```

---

## 🔧 SCHRITT 5: WEB-APP TESTEN

### 1. Server starten
```bash
cd /root/.openclaw/workspace/openclaw-api
python3 main.py
```

### 2. Web-App starten
```bash
cd /path/to/webapp
npm install
npm run dev
```

### 3. Im Browser testen:
1. Öffne `http://localhost:5173` (oder deine App URL)
2. Klicke auf Settings (Zahnrad)
3. Trage Server URL ein: `http://localhost:8000/api/command`
4. Gib Command ein: "Greife den Gegenstand"
5. App sollte Command an Server senden

---

## 📊 REQUEST/RESPONSE FLOW

### 1. User Input:
```
"Greife den Gegenstand bei Position 50"
```

### 2. Gemini AI → Function Call:
```json
{
  "name": "send_openclaw_command",
  "args": {
    "command": "GRAB",
    "parameters": {
      "position": 50
    }
  }
}
```

### 3. Web-App → Server:
```bash
POST http://localhost:8000/api/command
Content-Type: application/json

{
  "command": "GRAB",
  "parameters": {
    "position": 50
  }
}
```

### 4. Server Response:
```json
{
  "status": "success",
  "message": "Greifer positioniert: 50%",
  "data": {
    "position": 50,
    "speed": 50,
    "force": 50,
    "action": "grip"
  }
}
```

### 5. App zeigt Ergebnis:
```
✅ Befehl ausgeführt
Greifer positioniert: 50%
```

---

## 🔐 AUTHENTIFIZIERUNG (OPTIONAL)

### Server konfigurieren:

**In `.env`:**
```bash
AUTH_ENABLED=true
API_KEY=your-secret-key-here
```

### In Web-App eintragen:

1. Settings öffnen
2. API Key eintragen: `your-secret-key-here`
3. Speichern

**App sendet dann:**
```
Authorization: Bearer your-secret-key-here
```

---

## 🐛 TROUBLESHOOTING

### CORS Error im Browser

**Fehler:**
```
Access to fetch at 'http://localhost:8000/api/command' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

**Lösung:**
1. Server `.env` prüfen: `CORS_ORIGINS=*` (für Testing)
2. Server neu starten
3. Browser Cache leeren (Strg+F5)

### Connection Refused

**Fehler:**
```
Verbindungsfehler: Connection refused
```

**Lösung:**
1. Server läuft? `curl http://localhost:8000/health`
2. Falsche Port? Server nutzt Port 8000, nicht 8080!
3. Firewall prüfen

### 401 Unauthorized

**Fehler:**
```
Unauthorized: Invalid or missing API key
```

**Lösung:**
1. Server: `AUTH_ENABLED=false` (wenn keine Auth gewünscht)
2. ODER: API Key in App Settings eintragen

### Unknown Command

**Fehler:**
```
Unknown command: GRAB
```

**Lösung:**
1. Command Mapping prüfen (siehe Tabelle oben)
2. Server nutzt case-insensitive Commands (GRAB = grab = Grab)

---

## 📝 CHECKLISTE FÜR PRODUCTION

- [ ] Server URL in App auf Production-Server ändern
- [ ] CORS auf spezifische Domains beschränken
- [ ] API Key Auth aktivieren
- [ ] HTTPS für Server konfigurieren
- [ ] Environment Variables sicher speichern
- [ ] Logging aktivieren
- [ ] Error Handling testen
- [ ] Load Testing durchführen

---

## 🎯 NEXT STEPS

1. ✅ Server starten
2. ✅ Web-App URL anpassen (8000 statt 8080)
3. ✅ CORS testen
4. ✅ Commands testen (GRAB, MOVE, STATUS)
5. ✅ Hardware-Integration implementieren

---

**🦾 VIEL ERFOLG MIT DER INTEGRATION!** 🖤
