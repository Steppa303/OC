# OpenClaw REST API Server

REST API für OpenClaw Hardware-Steuerung. Empfängt Steuerbefehle von einer Web-App und reicht sie an die OpenClaw-Hardware weiter.

---

## 📋 INHALTSVERZEICHNIS

1. [Features](#features)
2. [Installation](#installation)
3. [Konfiguration](#konfiguration)
4. [Starten](#starten)
5. [API Endpoints](#api-endpoints)
6. [Beispiel-Requests](#beispiel-requests)
7. [Testen](#testen)
8. [Erweitern](#erweitern)

---

## ✨ FEATURES

- ✅ **REST API** - POST /api/command Endpoint
- ✅ **CORS Support** - Browser-freundlich mit Preflight
- ✅ **JSON Format** - Clean request/response format
- ✅ **API Key Auth** - Optional, konfigurierbar
- ✅ **Command Routing** - Saubere Handler-Struktur
- ✅ **Logging** - Umfassende Request-Logs
- ✅ **Error Handling** - Saubere Fehlermeldungen
- ✅ **FastAPI** - Modern, schnell, auto-documented

---

## 📦 INSTALLATION

### 1. Dependencies installieren

```bash
cd /root/.openclaw/workspace/openclaw-api

# Virtuelle Umgebung erstellen (empfohlen)
python3 -m venv venv
source venv/bin/activate

# Dependencies installieren
pip install -r requirements.txt
```

### 2. Konfiguration

Bearbeiten Sie `.env` nach Bedarf:

```bash
nano .env
```

**Wichtigste Einstellungen:**

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `PORT` | 8000 | Server Port |
| `CORS_ORIGINS` | * | Erlaubte Origins |
| `AUTH_ENABLED` | false | API Key Auth an/aus |
| `API_KEY` | - | API Key (wenn Auth an) |

---

## 🚀 STARTEN

### Development (mit Auto-Reload)

```bash
python main.py
# ODER
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Mit virtueller Umgebung

```bash
source venv/bin/activate
python main.py
```

---

## 🔌 API ENDPOINTS

### POST /api/command

**Execute OpenClaw command**

**Request:**
```json
{
  "command": "greifen",
  "parameters": {
    "position": 50,
    "speed": 75,
    "force": 60
  }
}
```

**Response (Success):**
```json
{
  "status": "success",
  "message": "Greifer positioniert: 50%",
  "data": {
    "position": 50,
    "speed": 75,
    "force": 60,
    "action": "grip"
  }
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Invalid position",
  "error": "Position must be 0-100"
}
```

**Headers (wenn Auth enabled):**
```
Authorization: Bearer your-api-key-here
```

---

### GET /health

**Health check**

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "auth_enabled": false,
  "cors_origins": "*"
}
```

---

### GET /

**API information**

**Response:**
```json
{
  "name": "OpenClaw REST API",
  "version": "1.0.0",
  "endpoints": {...},
  "docs": "/docs"
}
```

---

## 📖 BEISPIEL-REQUESTS

### 1. Greifer steuern

```bash
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "greifen",
    "parameters": {
      "position": 75,
      "speed": 80,
      "force": 60
    }
  }'
```

### 2. Arm bewegen

```bash
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "bewegen",
    "parameters": {
      "x": 50,
      "y": -25,
      "z": 10,
      "speed": 50
    }
  }'
```

### 3. Not-Halt

```bash
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "stop"
  }'
```

### 4. Status abfragen

```bash
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "status"
  }'
```

### 5. Mit Authentifizierung

```bash
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-api-key-here" \
  -d '{
    "command": "greifen",
    "parameters": {
      "position": 50
    }
  }'
```

---

## 🧪 TESTEN

### 1. Health Check

```bash
curl http://localhost:8000/health
```

### 2. API Documentation

Öffne im Browser:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### 3. CORS Preflight Test

```bash
curl -X OPTIONS http://localhost:8000/api/command \
  -H "Origin: http://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

Erwartete Headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization
```

### 4. Auth Test

```bash
# Ohne Key (sollte 401 geben wenn AUTH_ENABLED=true)
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -d '{"command": "status"}'

# Mit korrektem Key
curl -X POST http://localhost:8000/api/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-api-key-here" \
  -d '{"command": "status"}'
```

---

## 🔧 ERWEITERN

### Neuer Command Handler

1. **Neue Datei erstellen** in `commands/`:

```python
# commands/mycommand.py
from .base import BaseCommandHandler, CommandResult

class MyCommandHandler(BaseCommandHandler):
    async def execute(self, parameters):
        # Implement command logic
        return CommandResult(success=True, message="Done")
```

2. **In main.py registrieren:**

```python
from commands.mycommand import MyCommandHandler

# In execute_command():
handlers = {
    "greifen": OpenClawCommandHandler(),
    "mycommand": MyCommandHandler(),
}
```

### Hardware Integration

Ersetze die Platzhalter-Funktionen in `commands/openclaw.py`:

```python
async def greifen(self, params):
    # TODO: Replace with actual hardware control
    # Example:
    from openclaw.hardware import ClawController
    
    controller = ClawController()
    await controller.grip(
        position=params.get("position", 50),
        speed=params.get("speed", 50),
        force=params.get("force", 50)
    )
    
    return CommandResult(success=True, message="Gripped!")
```

---

## 📊 VARIABLEN-ÜBERSICHT

### config.py Settings

| Variable | Typ | Standard | Beschreibung |
|----------|-----|----------|--------------|
| `HOST` | str | 0.0.0.0 | Server bind address |
| `PORT` | int | 8000 | Server port |
| `DEBUG` | bool | true | Debug mode (auto-reload) |
| `CORS_ORIGINS` | str | * | Allowed CORS origins |
| `CORS_ALLOW_METHODS` | str | POST,OPTIONS | Allowed HTTP methods |
| `CORS_ALLOW_HEADERS` | str | Content-Type,Authorization | Allowed headers |
| `API_KEY` | str | None | API key for auth |
| `AUTH_ENABLED` | bool | false | Enable/disable auth |

### CommandRequest Model

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `command` | str | Command name (required) |
| `parameters` | dict | Command parameters (optional) |

### CommandResponse Model

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `status` | str | "success" or "error" |
| `message` | str | Response message |
| `data` | dict | Response data |
| `error` | str | Error message (if failed) |

---

## 🐛 TROUBLESHOOTING

### CORS Error im Browser

**Problem:** "Access-Control-Allow-Origin" header missing

**Lösung:**
1. Prüfe `CORS_ORIGINS` in `.env`
2. Setze auf `*` für Testing
3. Server neu starten

### 401 Unauthorized

**Problem:** API key wird abgelehnt

**Lösung:**
1. Prüfe `AUTH_ENABLED` in `.env`
2. Setze korrekten `API_KEY`
3. Sende Header: `Authorization: Bearer <key>`

### Command nicht gefunden

**Problem:** "Unknown command: xyz"

**Lösung:**
1. Prüfe verfügbare Commands in `/docs`
2. Command-Name korrekt schreiben (case-insensitive)
3. Handler in `commands/openclaw.py` prüfen

---

## 📝 LICENSE

MIT License - Feel free to use and modify!

---

## 🎯 NEXT STEPS

1. ✅ Server starten
2. ✅ API testen mit curl
3. ✅ Web-App integrieren
4. ✅ Hardware-Controller implementieren
5. ✅ Production deployment

---

**Viel Erfolg mit deinem OpenClaw! 🦾**
