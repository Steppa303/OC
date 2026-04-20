# Gemini Long-Prompt Integration

Anleitung zur Unterstützung von Gemini's natürlichen Sprach-Prompts.

---

## 📋 ÜBERBLICK

### Altes Format (Legacy):
```json
{
  "command": "GREIFEN",
  "parameters": {
    "position": 50
  }
}
```

### Neues Format (Gemini Long Prompts):
```json
{
  "instruction": "Fahre den Greifarm 10cm nach vorne, scanne den Bereich nach roten Objekten und greife das erste gefundene Objekt vorsichtig.",
  "context": {}
}
```

---

## 🔧 SERVER KONFIGURATION

### Port ändern (auf 8080 für Gemini-App):

**In `.env`:**
```bash
PORT=8080
```

### CORS für Web-App freigeben:

**In `.env`:**
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

---

## 📖 SUPPORT FORMATS

Der Server unterstützt **BEIDE** Formate parallel:

### Format 1: Natural Language (Gemini)

```json
POST /api/command
{
  "instruction": "Greife das rote Objekt",
  "context": {
    "object_color": "red",
    "action": "grab"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Instruction received and queued for execution",
  "data": {
    "instruction": "Greife das rote Objekt",
    "context": {...},
    "mode": "natural_language",
    "queued": true
  },
  "received_instruction": "Greife das rote Objekt"
}
```

### Format 2: Direct Command (Legacy)

```json
POST /api/command
{
  "command": "GREIFEN",
  "parameters": {
    "position": 50,
    "speed": 75
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Greifer positioniert: 50%",
  "data": {
    "position": 50,
    "speed": 75,
    "force": 50,
    "action": "grip"
  }
}
```

---

## 🧪 TESTEN

### Test mit Natural Language:

```bash
curl -X POST http://localhost:8080/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Fahre den Arm 10cm nach vorne und greife vorsichtig",
    "context": {
      "movement": "forward",
      "distance_cm": 10,
      "action": "grab",
      "force": "gentle"
    }
  }'
```

### Test mit Direct Command:

```bash
curl -X POST http://localhost:8080/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "BEWEGEN",
    "parameters": {
      "x": 10,
      "y": 0,
      "z": 0,
      "speed": 50
    }
  }'
```

---

## 🔄 IMPLEMENTIERUNGS-OPTIONEN

### Option A: Agent mit NLU (Empfohlen)

Der OpenClaw Agent versteht natürliche Sprache selbst:

```python
async def process_instruction(self, instruction, context):
    # Agent interprets natural language
    # Example: Use LLM to parse instruction
    parsed = await self.llm.parse(instruction)
    
    # Execute parsed commands
    for action in parsed.actions:
        await self.execute_action(action)
    
    return CommandResult(success=True, message="Instruction executed")
```

### Option B: Rule-Based Parser

Server extrahiert Commands aus Instruction:

```python
async def process_instruction(self, instruction, context):
    instruction_lower = instruction.lower()
    
    # Simple keyword matching
    if "greif" in instruction_lower:
        return await self.greifen(context)
    elif "beweg" in instruction_lower:
        return await self.bewegen(context)
    elif "stop" in instruction_lower:
        return await self.stop()
    
    return CommandResult(success=False, error="Could not parse instruction")
```

### Option C: Forward to External Service

Instruction an externen AI-Service forwarden:

```python
async def process_instruction(self, instruction, context):
    # Forward to LLM service
    response = await requests.post(
        "https://your-llm-service.com/parse",
        json={"instruction": instruction, "context": context}
    )
    
    parsed_commands = response.json()["commands"]
    
    # Execute parsed commands
    for cmd in parsed_commands:
        await self.execute(cmd)
    
    return CommandResult(success=True, message="Executed")
```

---

## 📊 REQUEST FLOW

```
User (Natural Language)
    ↓
Gemini AI (interprets & creates instruction)
    ↓
Web App (sends JSON)
    ↓
OpenClaw Server (receives instruction)
    ↓
┌─────────────────────────────────┐
│  process_instruction()          │
│  1. Log instruction             │
│  2. Parse/Interpret             │
│  3. Execute on Hardware         │
│  4. Return result               │
└─────────────────────────────────┘
    ↓
Response to Web App
    ↓
User sees result
```

---

## 🔐 AUTHENTIFIZIERUNG

### Server konfigurieren:

**In `.env`:**
```bash
AUTH_ENABLED=true
API_KEY=your-secret-key
```

### Web-App sendet:

```javascript
fetch('http://localhost:8080/api/command', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-secret-key'
  },
  body: JSON.stringify({
    instruction: "Greife das Objekt",
    context: {}
  })
})
```

---

## 🐛 TROUBLESHOOTING

### "Missing 'instruction' or 'command' field"

**Problem:** Request hat weder instruction noch command

**Lösung:** Mindestens eines der Felder muss vorhanden sein!

### CORS Error

**Problem:** Browser blockiert Request

**Lösung:**
```bash
# In .env:
CORS_ORIGINS=*  # Für Testing
# ODER
CORS_ORIGINS=http://localhost:5173  # Spezifische URL
```

### Port Conflict

**Problem:** Port 8080 bereits belegt

**Lösung:**
```bash
# In .env ändern:
PORT=8000  # Anderen Port verwenden
```

---

## ✅ CHECKLISTE

- [ ] Server Port auf 8080 gesetzt
- [ ] CORS für Web-App URL konfiguriert
- [ ] `instruction` Feld wird akzeptiert
- [ ] `context` Feld wird akzeptiert
- [ ] Legacy `command` Format funktioniert noch
- [ ] Auth konfiguriert (optional)
- [ ] Tests bestanden

---

## 🎯 NEXT STEPS

1. ✅ Server mit Port 8080 starten
2. ✅ Natural Language Instruction testen
3. ✅ Hardware-Integration implementieren
4. ✅ LLM-Parsing hinzufügen (optional)

---

**🦾 READY FOR GEMINI LONG PROMPTS!** 🖤
