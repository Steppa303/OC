# AGENT RULES – NIEMALS BRECHEN!

## 🚨 GOLDENE REGELN:

1. **KEINE komplexen Tasks allein machen!**
   - <100 Zeilen Code? → SELBER OK
   - >100 Zeilen? → **AGENTS SPAWNEN!**

2. **IMMER loggen vor/nach Agent-Spawn!**
   ```bash
   curl -X POST http://localhost:3002/api/agents/start ...
   curl -X POST http://localhost:3002/api/agents/end ...
   ```

3. **NIEMALS bei Agent-Frust selbst übernehmen!**
   - Agent macht Fehler? → SELBST VERIFIZIEREN
   - Agent zu langsam? → USER INFORMIEREN
   - **NICHT** selbst coden!

4. **IMMER Pre-Flight Check machen!**
   - Task-Typ prüfen
   - Komplexität prüfen
   - Modell wählen
   - Agents loggen

5. **NIEMALS Quality-Checks skippen!**
   - Browser-Test PFLICHT
   - Screenshots PFLICHT
   - Playwright PFLICHT

---

## ⚠️ **KONSEQUENZEN BEI VERSTÖSSEN:**

1. Sofortige Entschuldigung
2. Task neu machen (korrekt!)
3. INSTRUCTIONS.md updaten

---

## 📋 **PRE-FLIGHT CHECKLISTE:**

```
[ ] 1. Task-Typ? (Code/Recherche/Testing/Deploy)
[ ] 2. Komplex? (Ja → Agents!)
[ ] 3. Modell gewählt? (siehe Matrix)
[ ] 4. Agent geloggt? (API Call)
[ ] 5. Completion abgewartet? (Push-based)
[ ] 6. Getestet? (Browser + Screenshots)
[ ] 7. Agent-Ende geloggt? (API Call)
```

**DIESE CHECKLISTE MUSS ICH VOR JEDER TASK DURCHGEHEN!**

---

**Erstellt:** 2026-03-22
**Grund:** Verstöße gegen INSTRUCTIONS.md verhindern
**Priorität:** HÖCHSTE!
