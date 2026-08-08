# TRPG — Telegram Mini App Text Adventure

**Status:** ✅ Phase 2-3 implementiert (Backend LLM + Frontend-Verbindung)  
**Typ:** Telegram Mini App (WebApp)  
**Stack:** React + Tailwind + Zustand + Framer Motion | Express + better-sqlite3  
**LLM:** MiMo 2.5 Pro (`xiaomi-token-plan/mimo-v2.5-pro`)  
**Domain:** TBD (z.B. `trpg.steppa.online`)

---

## 1. Konzept

AI-gesteuerter Textadventure-Spielleiter als Telegram Mini App. Spieler erstellt einen Charakter, wählt ein Setting, und erlebt eine dynamische Geschichte. Jede Aktion wird durch sichtbare Würfelwürfe aufgelöst — die Erzählung basiert auf dem Würfelergebnis.

### Kernfeatures
- **Spielleiter:** MiMo 2.5 Pro generiert Szenen, NPCs, Dialoge, Kampf-Resolution
- **Würfelsystem:** Sichtbare W20-Animation (Framer Motion), kritisch/Patzer
- **Charakter:** Stats, Klasse, Level, HP, Inventar, Equipment
- **Settings:** Presets (Fantasy, Sci-Fi, Post-Apo, Horror, Cyberpunk) + Custom
- **Input:** 4 Wahlbuttons + optionales Freitext-Feld
- **Persistenz:** Auto-Save via SQLite

---

## 2. Architektur

```
┌─────────────────────────────────────────────┐
│           Telegram Mini App (WebView)        │
│  ┌───────────────────────────────────────┐   │
│  │  React + Tailwind + Zustand           │   │
│  │  ├── CharacterCreator                 │   │
│  │  ├── GameView (Szenen-Text + Buttons) │   │
│  │  ├── DiceRoller (Framer Motion)       │   │
│  │  ├── InventoryPanel                   │   │
│  │  ├── CharacterSheet                   │   │
│  │  └── SettingsSelector                 │   │
│  └──────────────┬────────────────────────┘   │
│                 │ Telegram WebApp SDK         │
└─────────────────┼───────────────────────────┘
                  │ HTTPS
┌─────────────────┼───────────────────────────┐
│  Express Backend │ (Port 3800)               │
│  ├── POST /game/new       → Neues Spiel      │
│  ├── POST /game/action    → Aktion + Würfel  │
│  ├── GET  /game/state     → Aktueller State  │
│  ├── POST /game/save      → Manuelles Save   │
│  ├── GET  /game/load/:id  → Spiel laden      │
│  ├── GET  /game/saves     → Save-Liste       │
│  └── POST /game/char      → Char erstellen   │
│                  │                            │
│  ┌───────────────┴──────────────────────┐    │
│  │  better-sqlite3 (WAL-Mode)           │    │
│  │  ├── saves (GameState JSON)          │    │
│  │  ├── characters (Stats, Inventar)    │    │
│  │  ├── game_log (Verlauf)              │    │
│  │  └── settings (Presets + Custom)     │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  MiMo 2.5 Pro (LLM)                 │    │
│  │  ├── Szenen-Generierung              │    │
│  │  ├── NPC-Dialoge                     │    │
│  │  ├── Kampf-Resolution (nach Wurf)    │    │
│  │  ├── Item/Loot-Generierung           │    │
│  │  └── Klassen-Generierung (Custom)    │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

---

## 3. Datenbank-Schema

### `saves`
```sql
CREATE TABLE saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,           -- Telegram User ID
  name TEXT NOT NULL,              -- Save-Name
  setting TEXT NOT NULL,           -- 'fantasy', 'scifi', 'custom', ...
  setting_config TEXT,             -- JSON: Custom-Setting-Details
  character_id INTEGER REFERENCES characters(id),
  current_scene TEXT,              -- Aktuelle Szenen-Beschreibung
  scene_history TEXT,              -- JSON: Array der letzten N Szenen
  game_state TEXT,                 -- JSON: Flags, Quest-Status, NPCs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `characters`
```sql
CREATE TABLE characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  class_name TEXT NOT NULL,        -- 'Krieger', 'Netrunner', etc.
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  mana INTEGER DEFAULT 0,
  max_mana INTEGER DEFAULT 0,
  stats TEXT NOT NULL,             -- JSON: {str, dex, con, int, wis, cha}
  skills TEXT,                     -- JSON: Array von Skills
  gold INTEGER DEFAULT 0,
  inventory TEXT,                  -- JSON: Array von Items
  equipment TEXT,                  -- JSON: {weapon, armor, shield, acc1, acc2}
  status TEXT DEFAULT 'alive',     -- 'alive', 'dead', 'retired'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `game_log`
```sql
CREATE TABLE game_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id INTEGER REFERENCES saves(id),
  turn_number INTEGER NOT NULL,
  user_action TEXT NOT NULL,       -- Was der User gewählt hat
  dice_roll TEXT,                  -- JSON: {type: 'd20', result: 14, dc: 12, success: true}
  ai_response TEXT NOT NULL,       -- Szenen-Text von AI
  state_changes TEXT,              -- JSON: HP-Änderung, Items erhalten/verloren
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `settings`
```sql
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- 'Fantasy', 'Sci-Fi', ...
  slug TEXT UNIQUE NOT NULL,       -- 'fantasy', 'scifi', ...
  description TEXT,
  classes TEXT NOT NULL,           -- JSON: Array von Klassen-Objekten
  tone TEXT,                       -- 'epic', 'dark', 'humorous', ...
  starting_items TEXT,             -- JSON: Start-Ausrüstung
  is_custom BOOLEAN DEFAULT 0,
  user_id TEXT,                    -- NULL = Preset, sonst Custom
  lore TEXT                        -- Custom-Setting Beschreibung
);
```

---

## 4. LLM-Prompt-Design

### System-Prompt (Spielleiter)
```
Du bist ein erfahrener Pen & Paper Spielleiter. Du leitest ein Text-Adventure im {setting}-Setting.

REGELN:
- Beschreibe Szenen lebendig und atmosphärisch (3-5 Sätze)
- Gib dem Spieler IMMER 4 Wahlmöglichkeiten als Buttons
- Jede relevante Aktion erfordert einen W20-Wurf
- Bei Würfelwürfen: Beschreibe das Ergebnis narrativ
  - Nat 20: Kritischer Erfolg (episch, bonus Effekt)
  - 15+: Solider Erfolg
  - 10-14: Teilerfolg mit Konsequenz
  - 2-9: Misserfolg mit Konsequenz
  - Nat 1: Patzer (katastrophal, aber spannend)
- Halte Stats und Inventar konsistent
- XP vergeben bei Erfolgen (10-50 je nach Schwierigkeit)
- Tod ist möglich, aber fair (nicht bei Nat 1 im ersten Kampf)

CHARACTER: {name}, {class_name}, Level {level}
STATS: STR {str} DEX {dex} CON {con} INT {int} WIS {wis} CHA {cha}
HP: {hp}/{max_hp} | Mana: {mana}/{max_mana}
INVENTAR: {inventory_summary}
AKTUELLE SZENE: {current_scene}
VERLAUF (letzte 3 Aktionen): {recent_history}

ANTWORT-FORMAT (JSON):
{
  "scene": "Beschreibung der neuen Situation...",
  "choices": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "dice_required": true/false,
  "dice_type": "d20",
  "difficulty_class": 12,
  "skill_used": "STR",
  "combat": {
    "active": true/false,
    "enemies": [{"name": "Goblin", "hp": 12, "max_hp": 12, "ac": 12}],
    "player_initiative": 15,
    "enemy_initiative": 10
  },
  "loot": [{"name": "Heiltrank", "type": "consumable", "effect": "heal_2d4+2", "weight": 0.5}],
  "xp_gained": 25,
  "hp_change": -8,
  "mana_change": 0,
  "gold_change": 15,
  "story_flag": "goblin_camp_cleared",
  "narrative_style": "success" | "failure" | "critical" | "fumble"
}
```

### Action-Prompt (pro Zug)
```
Der Spieler wählt: "{user_action}"
{dice_context}

Generiere die nächste Szene im JSON-Format.
```

---

## 5. Würfelsystem

### Server-seitig
- `crypto.randomInt(1, 21)` für faire W20-Würfe
- Ergebnis + Skill-Bonus vs Difficulty Class (DC)
- JSON-Response mit `dice_roll` Feld

### Client-seitig (Framer Motion)
```
┌─────────────────────────────────────┐
│  DiceRoller Component               │
│                                     │
│  1. Trigger: Server-Response hat    │
│     dice_required = true            │
│                                     │
│  2. Animation Phasen:               │
│     Phase 1 (0-300ms): Shake        │
│       - Würfel-Icon zittert         │
│       - "Würfel rollt..." Text      │
│                                     │
│     Phase 2 (300-800ms): Spin       │
│       - 3D Rotation (rotateY)       │
│       - Farb-Puls (glow)            │
│       - Zahlen flimmern             │
│                                     │
│     Phase 3 (800-1000ms): Landen    │
│       - Bounce-Effekt               │
│       - Ergebnis wird enthüllt      │
│                                     │
│     Phase 4 (1000-1500ms): Reveal   │
│       - Ergebnis groß anzeigen      │
│       - Farb-Code:                  │
│         🟢 Nat 20 (gold + Glitzer)  │
│         🟢 15+ (grün)               │
│         🟡 10-14 (gelb)             │
│         🔴 2-9 (rot)                │
│         💀 Nat 1 (schwarz + Shake)  │
│       - Skill-Bonus wird addiert    │
│       - Gesamtergebnis vs DC        │
│                                     │
│  3. Nach Animation:                 │
│     - Text-Erzählung eingeblendet   │
│     - Stats-Update animiert         │
└─────────────────────────────────────┘
```

### Würfel-Typen
| Typ | Verwendung |
|-----|-----------|
| W20 | Attacken, Skill-Checks, Saves |
| W8 | Schaden (Schwert) |
| W6 | Schaden (Dolch), Heilung |
| W4 | Schaden (Dagger), Kleinzeug |
| W12 | Schaden (Axt) |
| W100 | Prozent-Würfe (selten) |

---

## 6. Frontend-Komponenten

### App.jsx (Router)
```
/           → StartScreen (Neu/Laden)
/create     → CharacterCreator
/game       → GameView (Hauptspiel)
/sheet      → CharacterSheet
/inventory  → InventoryPanel
/settings   → SettingSelector
```

### StartScreen
- Logo + Titel
- "Neues Abenteuer" Button
- "Abenteuer laden" Button (zeigt Save-Liste)
- Letzten Spielstand als Quick-Load

### SettingSelector
- Grid mit Preset-Cards (Icon + Name + Kurzbeschreibung)
- Custom-Setting Card (öffnet Text-Input)
- Bei Custom: Textfeld für Setting-Beschreibung + "Klassen generieren" Button
- Klassen werden von AI generiert und angezeigt

### CharacterCreator
- Name-Input
- Klassen-Auswahl (dynamisch je nach Setting)
- Stats-Würfeln (4d6 Drop Lowest, Framer Motion Animation für jeden Stat)
- Stat-Verteilung: Punkte-System oder Würfel
- Start-Ausrüstung (je nach Klasse)
- Vorschau-Card mit allen Werten

### GameView (Hauptspiel)
```
┌─────────────────────────────────────┐
│ 📊 HP: ██████░░ 14/20  ⚡ Mana: 8  │
│ 🗡️ STR:14 DEX:12 CON:13           │
│ 💰 Gold: 45  ⭐ XP: 120  📖 Lvl 3 │
├─────────────────────────────────────┤
│                                     │
│  Der Goblin-Anführer grinst dich    │
│  an und hebt seine rostige Axt...   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     🎲 Würfel Animation     │    │
│  │        [W20: 17]            │    │
│  │     ✅ Erfolg! (DC 12)      │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  [⚔️ Angreifen mit Schwert] │    │
│  │  [🛡️ Verteidigen]           │    │
│  │  [🏃 Fliehen]               │    │
│  │  [🗣️ Verhandeln]            │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Oder schreib selbst...     │    │
│  │  [________________] [Send]  │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│ [🎒 Inventar] [👤 Charakter] [💾]  │
└─────────────────────────────────────┘
```

### DiceRoller (Framer Motion)
- Animated Container mit Würfel-Icon
- Shake → Spin → Bounce → Reveal Phasen
- Ergebnis mit Farb-Code (grün/gelb/rot/gold)
- DC-Vergleich wird angezeigt
- "Kritischer Erfolg!" / "Patzer!" Banner

### InventoryPanel
- Equipment-Slots (Waffe, Rüstung, Schild, 2x Accessoire)
- Backpack-Liste mit Gewicht
- Item-Details (Tooltip/Modal)
- Equip/Unequip/Drop Aktionen
- Gewichtsbalken (STR-basiertes Limit)

### CharacterSheet
- Name, Klasse, Level, XP-Balken
- Stats mit Modifikatoren
- Skills-Liste
- HP/Mana-Balken
- Gold
- Status-Effekte

---

## 7. Backend-API

### `POST /game/new`
```json
// Request
{
  "user_id": "telegram:1400987471",
  "setting": "fantasy",
  "setting_config": null,  // oder Custom-Setting JSON
  "character": {
    "name": "Aldric",
    "class_name": "Krieger",
    "stats": {"str": 16, "dex": 12, "con": 14, "int": 10, "wis": 13, "cha": 11},
    "hp": 24, "max_hp": 24, "mana": 0, "max_mana": 0
  }
}

// Response
{
  "save_id": 1,
  "character_id": 1,
  "opening_scene": "Du stehst vor den verfallenen Ruinen...",
  "choices": ["Betritt die Ruinen", "Umgehe das Lager", "Beobachte aus der Ferne", "Rufe nach jemandem"]
}
```

### `POST /game/action`
```json
// Request
{
  "save_id": 1,
  "action": "Betritt die Ruinen",
  "is_freetext": false
}

// Response
{
  "turn": 2,
  "dice_roll": {"type": "d20", "result": 14, "bonus": 3, "total": 17, "dc": 12, "success": true},
  "scene": "Du schleichst durch die zerfallene Tür...",
  "choices": ["Durchsuche den Tisch", "Öffne die Truhe", "Gehe tiefer in den Keller", "Nimm den Dolch vom Boden"],
  "state_changes": {"hp": -3, "xp": 25, "gold": 15, "items_added": ["Rostiger Dolch"]},
  "combat": null,
  "narrative_style": "success"
}
```

### `GET /game/state`
```json
// Response
{
  "save": { "id": 1, "setting": "fantasy", "current_scene": "...", "turn": 2 },
  "character": { "name": "Aldric", "class_name": "Krieger", "level": 1, "hp": 21, "max_hp": 24, ... },
  "inventory": [{"name": "Rostiger Dolch", "type": "weapon", "damage": "1d4", "weight": 1}],
  "equipment": {"weapon": "Langschwert", "armor": "Leder-Rüstung", ...}
}
```

---

## 8. Setting-Presets

### Fantasy
```json
{
  "name": "Fantasy",
  "slug": "fantasy",
  "description": "Klassisches Mittelalter-Fantasy mit Magie, Drachen und Abenteuern",
  "tone": "epic",
  "classes": [
    {"name": "Krieger", "desc": "Meister der Waffen und Rüstungen", "base_hp": 24, "skills": ["Kampftechnik", "Schildwall"]},
    {"name": "Magier", "desc": "Beherrscher der arkanen Künste", "base_hp": 14, "mana": 20, "skills": ["Feuerball", "Heilung"]},
    {"name": "Schurke", "desc": "Meister des Diebstahls und der Täuschung", "base_hp": 18, "skills": ["Schleichen", "Fallen entschärfen"]},
    {"name": "Ranger", "desc": "Waldläufer und Meister der Fernkampfwaffen", "base_hp": 20, "skills": ["Bogenschuss", "Tierfreund"]},
    {"name": "Kleriker", "desc": "Geweihter Heiler und Dämonenjäger", "base_hp": 20, "mana": 15, "skills": ["Segen", "Untoten-Vertreibung"]}
  ],
  "starting_items": ["Abenteurer-Rucksack", "Tagesration", "Wasserschlauch", "Fackel"]
}
```

### Sci-Fi
```json
{
  "name": "Sci-Fi",
  "slug": "scifi",
  "description": "Weites Weltall, Alien-Zivilisationen, High-Tech-Ausrüstung",
  "tone": "awe",
  "classes": [
    {"name": "Pilot", "desc": "Meister der Raumschiffe und Navigation", "base_hp": 18, "skills": ["Raumschiff-Steuerung", "Notfall-Landung"]},
    {"name": "Techniker", "desc": "Expert für Maschinen und Cybernetik", "base_hp": 16, "skills": ["Hacken", "Reparatur"]},
    {"name": "Söldner", "desc": "Gefechtserprobter Kämpfer", "base_hp": 24, "skills": ["Schusswaffen", "Nahkampf"]},
    {"name": "Psioniker", "desc": "Mentale Kräfte und Telepathie", "base_hp": 14, "mana": 20, "skills": ["Telekinese", "Gedankenlesen"]}
  ],
  "starting_items": ["EVA-Suit", "Plasma-Pistole", "Multitool", "Rationen"]
}
```

### Post-Apo
```json
{
  "name": "Post-Apokalypse",
  "slug": "postapo",
  "description": "Die Welt nach dem Kollaps. Überleben ist alles.",
  "tone": "grim",
  "classes": [
    {"name": "Überlebender", "desc": "Abgehärteter Überlebenskünstler", "base_hp": 22, "skills": ["Fellhandwerk", "Wasser finden"]},
    {"name": "Scavenger", "desc": "Meister der Müllsuche und Improvisation", "base_hp": 18, "skills": ["Plündern", "Flicken"]},
    {"name": "Scharfschütze", "desc": "Präzise aus der Distanz", "base_hp": 20, "skills": ["Scharfschuss", "Tarnung"]},
    {"name": "Mechaniker", "desc": "Lässt alles wieder laufen", "base_hp": 18, "skills": ["Fahrzeug-Reparatur", "Waffen-Mod"]}
  ],
  "starting_items": ["Flickzeug", "Messer", "Wasserflasche", "Konservendose"]
}
```

### Horror
```json
{
  "name": "Horror",
  "slug": "horror",
  "description": "Düstere Atmosphäre, übernatürliche Bedrohungen, Überleben",
  "tone": "terrifying",
  "classes": [
    {"name": "Ermittler", "desc": "Aufklärer okkulter Verbrechen", "base_hp": 18, "skills": ["Ermittlung", "Verhör"]},
    {"name": "Okkultist", "desc": "Kenner dunkler Rituale", "base_hp": 14, "mana": 18, "skills": ["Ritual", "Schutzkreis"]},
    {"name": "Überlebender", "desc": "Hat schon Schlimmes erlebt", "base_hp": 22, "skills": ["Flucht", "Verstecken"]},
    {"name": "Arzt", "desc": "Mediziner in einer Welt ohne Logik", "base_hp": 16, "skills": ["Erste Hilfe", "Anatomie"]}
  ],
  "starting_items": ["Taschenlampe", "Notizbuch", "Erste-Hilfe-Set", "Talisman"]
}
```

### Cyberpunk
```json
{
  "name": "Cyberpunk",
  "slug": "cyberpunk",
  "description": "Neon, Megakonzerne, Cyberware, Straßenkriminalität",
  "tone": "noir",
  "classes": [
    {"name": "Netrunner", "desc": "Hacker im Cyberspace", "base_hp": 14, "mana": 22, "skills": ["Hacken", "ICE-Brecher"]},
    {"name": "Solo", "desc": "Profikiller und Leibwächter", "base_hp": 24, "skills": ["Feuerwaffen", "Nahkampf"]},
    {"name": "Techie", "desc": "Technik-Experte und Erfinder", "base_hp": 18, "skills": ["Waffen-Mod", "Cyberware"]},
    {"name": "Fixer", "desc": "Informant und Händler", "base_hp": 18, "skills": ["Kontakte", "Schwarzmarkt"]}
  ],
  "starting_items": ["Cyberdeck", "Pistole", "Smartphone", "100 Eddies"]
}
```

---

## 9. UI/UX Design

### Farbschema (Dark Theme)
- **Background:** `#0a0a0f` (Deep Dark)
- **Card BG:** `#1a1a2e` mit Glassmorphism
- **Primary:** `#6366f1` (Indigo)
- **Success:** `#22c55e` (Green)
- **Danger:** `#ef4444` (Red)
- **Gold (Crit):** `#f59e0b` (Amber)
- **Text:** `#e2e8f0` (Light Gray)
- **Accent:** Setting-abhängig (Fantasy=Gold, Sci-Fi=Cyan, Horror=Red, Cyberpunk=Pink)

### Animationen (Framer Motion)
- **Seitenwechsel:** Slide transitions
- **Würfel:** Shake → Spin → Bounce → Reveal
- **Stats-Update:** Zähler-Animation (Hochzählen)
- **HP-Balken:** Smooth Width-Transition
- **Item-Erhalt:** Slide-in von oben mit Glow
- **Level-Up:** Fullscreen Flash + Partikel
- **Buttons:** Hover-Scale, Tap-Scale-Down
- **Text:** Typewriter-Effekt für Szenen-Text

### Mobile-First
- Touch-Targets mind. 44px
- Swipe für Inventar/Charakter Sheet
- Bottom Navigation Bar
- Vollbild-optimiert für Telegram WebApp

---

## 10. Implementierungs-Reihenfolge

### Phase 1: Grundgerüst (Tag 1)
1. Projekt-Setup (Vite + React + Tailwind + Framer Motion)
2. Express Backend + SQLite Schema
3. Telegram Mini App SDK Integration
4. Basic Routing (Start/Create/Game)

### Phase 2: Charakter-Erstellung (Tag 2)
1. SettingSelector mit Presets
2. CharacterCreator (Stats-Würfeln, Klasse wählen)
3. Custom-Setting mit AI-Klassen-Generierung
4. DB: Character + Setting speichern

### Phase 3: Game Loop (Tag 3-4)
1. GameView Layout (Szene + Buttons + Freitext)
2. LLM-Integration (Spielleiter-Prompt)
3. Action-Handler (User-Aktion → AI-Response)
4. State-Management (Zustand Store)

### Phase 4: Würfel-System (Tag 4)
1. Server-seitiges Würfeln (crypto.randomInt)
2. DiceRoller Komponente (Framer Motion Animationen)
3. W20 mit Farb-Code + DC-Vergleich
4. Integration in Game Loop

### Phase 5: Inventar & Charakter (Tag 5)
1. InventoryPanel (Equipment + Backpack)
2. CharacterSheet (Stats, Skills, Level)
3. Item-Effekte (Heilung, Schaden, Buffs)
4. Stat-Updates nach Aktionen

### Phase 6: Polish & Deploy (Tag 6)
1. Save/Load System
2. Game-Log (Verlauf anzeigen)
3. Level-Up System
4. Caddy + PM2 Deployment
5. Telegram Mini App Testing

---

## 11. Technische Details

### Telegram Mini App Integration
```javascript
// index.html
<script src="https://telegram.org/js/telegram-web-app.js"></script>

// App.jsx
const tg = window.Telegram.WebApp;
tg.expand();  // Vollbild
tg.ready();   // Bereit signalisieren

// User-Daten
const user = tg.initDataUnsafe.user;  // {id, first_name, username}
const userId = `telegram:${user.id}`;

// Haptic Feedback
tg.HapticFeedback.impactOccurred('medium');  // Bei Würfelwurf
tg.HapticFeedback.notificationOccurred('success');  // Bei Erfolg

// Main Button (für Aktionen)
tg.MainButton.setText('Würfeln!');
tg.MainButton.show();
tg.MainButton.onClick(() => rollDice());
```

### Zustand Store
```javascript
// store.js
const useGameStore = create((set, get) => ({
  // Character
  character: null,
  setCharacter: (char) => set({ character: char }),
  updateHP: (delta) => set((s) => ({
    character: { ...s.character, hp: Math.max(0, s.character.hp + delta) }
  })),

  // Spiel
  saveId: null,
  currentScene: '',
  choices: [],
  turn: 0,

  // Würfel
  diceResult: null,
  diceRolling: false,
  setDiceResult: (result) => set({ diceResult: result, diceRolling: false }),
  startDiceRoll: () => set({ diceRolling: true, diceResult: null }),

  // Inventar
  inventory: [],
  equipment: { weapon: null, armor: null, shield: null, acc1: null, acc2: null },
  addItem: (item) => set((s) => ({ inventory: [...s.inventory, item] })),

  // UI
  showInventory: false,
  showCharSheet: false,
  toggleInventory: () => set((s) => ({ showInventory: !s.showInventory })),
}));
```

---

## 12. Abhängigkeiten

### Frontend
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "framer-motion": "^11.0.0",
    "zustand": "^4.5.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

### Backend
```json
{
  "dependencies": {
    "express": "^4.19.0",
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5"
  }
}
```

---

## 13. Deployment

- **Port:** 3800
- **PM2-Name:** `trpg`
- **Domain:** `trpg.steppa.online` (Caddy reverse_proxy)
- **Caddy:** SPA-Fallback + API-Proxy

```caddy
trpg.steppa.online {
    handle /api/* {
        reverse_proxy localhost:3800
    }
    handle {
        root * /root/.local/.openclaw/workspace/projects/trpg/dist
        try_files {path} /index.html
        file_server
    }
}
```

---

_Plan erstellt: 2026-07-28 ~21:06_

---

## 14. Implementierungs-Log (Phase 2-3)

**Datum:** 2026-07-28 ~21:30
**Status:** ✅ Abgeschlossen

### Was wurde implementiert:

#### Backend LLM-Integration (`server/routes/game.js`)
- MiMo 2.5 Pro via OpenRouter API (`xiaomi-token-plan/mimo-v2.5-pro`)
- `callLLM()` Helper mit OpenRouter-kompatibler API
- `parseLLMJson()` — robuster JSON-Parser (direct, code-block, brace-match)
- System-Prompt aus HANDOVER.md Section 4 (Spielleiter-Prompt)
- `/game/action`: User-Aktion → LLM-Call → JSON parsen → DB updaten
- `/game/new`: Opening-Scene wird vom LLM generiert
- Fallback bei LLM-Fehler: generische aber funktionale Antworten
- State-Changes (HP, Mana, Gold, XP, Items) werden automatisch angewendet
- Level-Up basiert auf XP (alle 100 XP = +1 Level)
- Scene-History wird mitgeführt (letzte 10 Szenen)

#### Frontend-Verbindung
- `GameView.jsx`: `handleChoice` → `/game/action` mit Dice-Animation, State-Updates
- `StartScreen.jsx`: Lädt Saves, "Weiterspielen"-Button für letzten Stand
- `CharacterCreator.jsx`: Ruft `/game/new` auf (war schon verbunden)
- `SettingSelector.jsx`: Lädt Settings vom Backend (war schon verbunden)
- Store (`store.js`): Bereits vollständig (setScene, setChoices, updateCharacter, etc.)

#### DiceRoller-Animation (`src/components/DiceRoller.jsx`)
- Framer Motion Phasen: Shake (300ms) → Spin (flickernde Zahlen) → Bounce → Reveal
- Farb-Code: Nat 20 (gold+glow), 15+ (grün), 10-14 (gelb), 2-9 (rot), Nat 1 (schwarz)
- Glow-Effekt bei kritischen Erfolgen/Patzern
- Skill- und DC-Anzeige
- Reset nach 3 Sekunden

#### Telegram Mini App SDK
- `App.jsx`: `tg.expand()` + `tg.ready()` + User-Extraktion (bereits vorhanden)
- `GameView.jsx`: Haptic Feedback bei Aktionen, Würfeln, Erfolg/Misserfolg
- `StartScreen.jsx`: Haptic bei Button-Klicks

#### Save/Load
- StartScreen lädt Saves automatisch
- "Weiterspielen" Button für letzten Spielstand
- Save-Liste bei mehreren Saves

### Dateien geändert:
- `server/routes/game.js` — Komplett neu geschrieben (LLM-Integration)
- `src/components/GameView.jsx` — Backend-Verbindung + History
- `src/components/StartScreen.jsx` — Save-Loading + Weiterspielen
- `src/components/DiceRoller.jsx` — Framer Motion Animation
- `src/components/Layout.jsx` — Import-Fix

### Build:
- `npm run build` erfolgreich (326 KB JS, 19 KB CSS)
- Server startet auf Port 3800

### Nächste Schritte (Phase 4-6):
- Inventar-Panel mit Equip/Unequip
- CharacterSheet vollständig
- Game-Log anzeigen
- Level-Up Animation
- Caddy + PM2 Deployment
- Telegram Mini App Testing

---

## 15. Implementierungs-Log (Phase 4-6)

**Datum:** 2026-07-28 ~21:36
**Status:** ✅ Abgeschlossen

### Was wurde implementiert:

#### InventoryPanel Verbesserungen (`src/components/InventoryPanel.jsx`)
- **Equip/Unequip:** Klick auf Item im Backpack → Equip in richtigen Slot (type-basiert: weapon→weapon, armor→armor, shield→shield, rest→acc1/acc2)
- **Drop:** Trash2-Button pro Item im Backpack
- **Item-Details:** Expand/Collapse mit ChevronDown — zeigt Schaden, Effekt, Gewicht, Beschreibung
- **Equipment-Slot Klick → Unequip:** Klick auf besetzten Slot → Item zurück in Rucksack
- **Visuelles Feedback:** Besetzte Slots mit Primary-Border, ArrowRightLeft-Icon

#### GameLog Komponente (`src/components/GameLog.jsx`) — NEU
- Zeigt die letzten 20 Turns als Timeline mit vertikaler Linie
- Jeder Eintrag: Turn-Nummer + User-Aktion + gekürzter Szenen-Text
- Farb-Code: grüner/roter Timeline-Dot + CheckCircle2/XCircle für Erfolg/Misserfolg
- Dice-Ergebnis (W20 + Bonus) wird angezeigt
- State-Changes (XP, HP, Gold) als Badges
- Wird als Slide-Over Panel (rechts) in Layout.jsx eingebaut
- Neuer Button in Bottom-Nav: “📖 Log”
- Lädt Log-Einträge vom Backend via `GET /game/log/:saveId`

#### LevelUpOverlay (`src/components/LevelUpOverlay.jsx`) — NEU
- Fullscreen Overlay mit Framer Motion (Spring-Animation)
- “LEVEL UP!” Text mit Gold-Gradient + Glow-Effekt (CSS filter drop-shadow)
- Glow-Hintergrund (Gold-Blur-Circle)
- Sparkles-Icons animiert
- Zeigt neuen Level, HP, Mana, XP
- Auto-dismiss nach 3.5 Sekunden oder Klick
- In Layout.jsx als globaler Overlay integriert

#### GameView Verbesserungen (`src/components/GameView.jsx`)
- **Level-Change Detection:** XP-Änderung wird inline berechnet, setLevelUp(true) wenn Level steigt
- **Game-Log Integration:** addLogEntry() nach jeder Aktion
- **Collapsed History:** Nach 5+ Szenen werden ältere ausgeblendet, “X ältere Szenen anzeigen” Button mit ChevronDown
- ChevronDown Import hinzugefügt

#### Store erweitert (`src/store.js`)
- `gameLog: []` Array + `setGameLog` / `addLogEntry`
- `showLog: false` + `toggleLog` (schließt andere Panels)
- `levelUp: false` + `setLevelUp`
- `closeAllPanels` schließt jetzt auch showLog
- `resetGame` räumt gameLog + levelUp auf

#### API erweitert (`src/lib/api.js`)
- `getGameLog: (saveId) => request(`/game/log/${saveId}`)`

#### Backend: Game-Log Endpoint (`server/routes/game.js`)
- `GET /game/log/:saveId` — gibt die letzten 20 game_log Einträge zurück (neueste zuerst)
- JSON-Parsing für dice_roll und state_changes Felder

#### Layout Verbesserungen (`src/components/Layout.jsx`)
- Log-Button in Bottom-Nav (ScrollText-Icon, “Log” Label)
- Slide-Over Panel für GameLog (rechts, wie Inventory)
- LevelUpOverlay als globaler Overlay
- Neue Imports: ScrollText, GameLog, LevelUpOverlay

### Dateien geändert:
- `src/components/InventoryPanel.jsx` — Komplett neu geschrieben (Equip/Unequip/Drop/Details)
- `src/components/GameLog.jsx` — NEU
- `src/components/LevelUpOverlay.jsx` — NEU
- `src/components/GameView.jsx` — Level-Change + Log + Collapsed History
- `src/components/Layout.jsx` — Log-Button + Slide-over + LevelUpOverlay
- `src/store.js` — gameLog, showLog, levelUp
- `src/lib/api.js` — getGameLog
- `server/routes/game.js` — GET /game/log/:saveId
- `ecosystem.config.cjs` — NEU (PM2 Config)

### Build:
- `npm run build` erfolgreich (340 KB JS, 23 KB CSS)
- PM2 Ecosystem-Datei erstellt

### Deployment:
```bash
# PM2 starten
pm2 start ecosystem.config.cjs
pm2 save

# Caddy-Config (in Caddyfile einfügen):
trpg.steppa.online {
    handle /api/* {
        reverse_proxy localhost:3800
    }
    handle {
        root * /root/.local/.openclaw/workspace/projects/trpg/dist
        try_files {path} /index.html
        file_server
    }
}
```

---

## 16. Story Engine + World Legacy

**Datum:** 2026-07-29
**Status:** ✅ Implementiert

### Was wurde implementiert:

#### Konzept
Die bisherige Random-Scene-Generierung wurde in ein strukturiertes Story-System mit persistentem World-State umgewandelt. Jedes Spiel kann jetzt in einer "Welt" stattfinden, die über mehrere Spielstände hinweg existiert.

#### Architektur

```
┌─────────────────────────────────────────────────┐
│              Story Engine Layer                   │
│                                                  │
│  ┌──────────────────┐  ┌───────────────────┐    │
│  │  Arc-Templates   │  │  Story Engine     │    │
│  │  (15 Arcs)       │  │  server/engine/   │    │
│  │  3 pro Setting   │  │  story.js         │    │
│  └────────┬─────────┘  └────────┬──────────┘    │
│           │                     │                │
│  ┌────────▼─────────────────────▼──────────┐    │
│  │  LLM-Prompts mit Story-Kontext          │    │
│  │  - Arc-Struktur (Akte, Key Beats)       │    │
│  │  - World-State (NPCs, Locations, etc.)  │    │
│  │  - Anti-Repetition (letzte 5 Szenen)    │    │
│  └────────┬────────────────────────────────┘    │
│           │                                      │
│  ┌────────▼────────────────────────────────┐    │
│  │  story_update in LLM-Response           │    │
│  │  → processStoryUpdate()                 │    │
│  │  → NPC/Location/Event/Faction Updates   │    │
│  └────────┬────────────────────────────────┘    │
│           │                                      │
│  ┌────────▼────────────────────────────────┐    │
│  │  SQLite: worlds, world_npcs,            │    │
│  │  world_locations, world_events,         │    │
│  │  world_factions                          │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

#### DB-Schema (neue Tabellen)

- **worlds** — id, setting_slug, name, world_state (JSON), created_at, updated_at
- **world_npcs** — id, world_id, name, role, personality (JSON), status, attitude, location, backstory
- **world_locations** — id, world_id, name, description, type, state, connections (JSON), discovered
- **world_events** — id, world_id, save_id, turn_number, event_type, description, impact (JSON)
- **world_factions** — id, world_id, name, description, power_level, attitude, leader_npc_id, territory (JSON)
- **saves** — world_id (nullable FK, via Migration)

#### Arc-Templates (`server/data/arcs.js`)

15 Arcs total, 3 pro Setting:

| Setting | Arc 1 | Arc 2 | Arc 3 |
|---------|-------|-------|-------|
| Fantasy | Die Schattenschmiede | Der Letzte Thron | Die Pest der Vergessenheit |
| Sci-Fi | Das Signal | Schatten der Kolonie | Maschinenherz |
| Post-Apo | Die letzte Brücke | Die Farm | Der Funkturm |
| Horror | Die Stille | Spiegelbild | Der Sammler |
| Cyberpunk | Neon-Blut | Ghost in the Net | Straßenkrieg |

Jeder Arc hat: premise, antagonist_template, 3 Akte mit key_beats und tension_range, twist_options, side_quest_hooks.

#### Story Engine (`server/engine/story.js`)

- `selectArc(setting, worldState)` — wählt passenden Arc (random aus Kandidaten)
- `generateWorldSeed(setting, arc)` — LLM generiert Locations, NPCs, Factions, World-Name
- `createWorld(settingSlug, arcId)` — erstellt Welt + persistiert NPCs/Locations/Factions in DB
- `buildStoryContext(worldId)` — holt kompletten World-State
- `formatStoryContextForPrompt(ctx)` — formatiert für LLM-Prompt
- `processStoryUpdate(worldId, saveId, turnNumber, llmResponse)` — extrahiert story_update und persistiert Änderungen
- `advanceAct(worldId)` — prüft ob Akt-Wechsel nötig (Tension-Schwelle)
- `getWorldHistory(worldId)` — formatiert World-Events

#### LLM-Prompt-Erweiterungen (`server/routes/game.js`)

**Opening-Prompt:**
- Enthält Arc-Template (Name, Premise, Antagonist, Act 1 Key Beats)
- LLM liefert `story_update` mit initial NPCs, Locations, Events

**Action-Prompt:**
- Kompletter Story-Kontext (Arc, Akt, Tension, NPCs mit Attitudes, Locations, Factions, Events)
- Anti-Repetition: Letzte 5 Szenen-Typen (Kampf/Dialog/Erkundung/Erzählung)
- LLM liefert `story_update` mit NPC/Location/Event/Quest/Faction Updates

**Story-Update Verarbeitung:**
- Nach jedem Turn: `processStoryUpdate()` → NPC-Status, Locations, Events, Factions, Quests, Tension
- `advanceAct()` prüft Akt-Wechsel
- `world_state` wird mit an Frontend zurückgegeben

#### World-Management API (`server/routes/worlds.js`)

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/api/worlds/arcs/:settingSlug` | GET | Arc-Liste für Setting |
| `/api/worlds/setting/:settingSlug` | GET | Welten für Setting |
| `/api/worlds` | POST | Neue Welt erstellen |
| `/api/worlds/:worldId` | GET | Welt-Details |
| `/api/worlds/:worldId/history` | GET | World-Events Timeline |
| `/api/worlds/:worldId/npcs` | GET | NPC-Liste |
| `/api/worlds/:worldId/locations` | GET | Location-Liste |

#### Frontend

**SettingSelector.jsx:**
- 3-Schritt-Flow: Setting → Welt-Auswahl → Arc-Auswahl
- Zeigt existierende Welten (Name, Arc, Akte, Tension, Spielanzahl)
- "Neue Welt" Button → Arc-Auswahl (3 Arcs + "Zufällig")
- Navigiert zu CharacterCreator mit worldId im State

**CharacterCreator.jsx:**
- Akzeptiert worldId aus Navigation-State
- Übergibt world_id an createGame API
- Lädt World-Daten nach Game-Erstellung

**GameView.jsx:**
- Story-Kontext-Bar: Akt-Nummer, Tension-Balken, Quest-Anzahl
- Aktive Quest-Badges unter der Bar
- World-State wird aus Action-Response aktualisiert
- Lädt World-State beim Game-Start (falls existierend)

**WorldHistory.jsx (NEU):**
- 4 Tabs: Events (Timeline), NPCs, Locations, Factions
- Events als Timeline mit Icons (Skull, Handshake, Search, etc.)
- NPCs mit Status-Badges, Attitude-Bar, Expand für Backstory
- Locations mit discovered/state Indicators
- Factions mit Power-Level-Bar und Attitude

**Layout.jsx:**
- "Welt" Button in Bottom-Nav (nur wenn worldId gesetzt)
- Slide-over Panel für WorldHistory

**Store (store.js):**
- worldId, worldState, quests, tension, currentAct, arcName
- setWorld, updateQuest, updateTension, updateCurrentAct
- showWorld, toggleWorld

**API (api.js):**
- getWorlds, createWorld, getWorld, getWorldHistory, getWorldNPCs, getWorldLocations, getArcs

#### Backward-Compatibilität
- `world_id` in saves ist nullable — alte Saves ohne Welt funktionieren weiterhin
- Keine breaking changes in bestehenden API-Endpoints
- Fallback-World-Seed wenn LLM fehlschlägt
- story_update wird nur verarbeitet wenn vorhanden

#### Build
- `npm run build` erfolgreich (359 KB JS, 26 KB CSS)
- Server startet und Migration wird automatisch ausgeführt

#### Dateien geändert:
- `server/db.js` — 5 neue Tabellen + Migration für world_id in saves
- `server/data/arcs.js` — NEU (15 Arc-Templates)
- `server/engine/story.js` — NEU (Story Engine)
- `server/routes/worlds.js` — NEU (World API)
- `server/routes/game.js` — LLM-Prompts erweitert, Story-Update Processing
- `server/index.js` — Worlds-Route registriert
- `src/components/SettingSelector.jsx` — 3-Schritt-Flow mit Welt-Auswahl
- `src/components/CharacterCreator.jsx` — worldId Support
- `src/components/GameView.jsx` — Story-Kontext-Bar, World-State Updates
- `src/components/WorldHistory.jsx` — NEU (World-History-Panel)
- `src/components/Layout.jsx` — Welt-Button + Slide-over
- `src/store.js` — World-State Variablen
- `src/lib/api.js` — World-Endpoints

---

## 17. Story Journal — Detailliertes Logging

**Datum:** 2026-07-29
**Status:** ✅ Implementiert

### Zweck
Jeder Turn wird detailliert geloggt, um Stories nachträglich analysieren und evaluieren zu können. Das Journal enthält den kompletten LLM-Prompt, die rohe Response, alle State-Changes und Metadaten.

### Datenbank

**Tabelle: `story_journal`**
```sql
CREATE TABLE story_journal (
  id, save_id, world_id, turn_number,
  system_prompt, user_prompt,            -- Kompletter LLM-Prompt
  llm_raw_response, llm_parsed_response, -- Rohe + geparste LLM-Response
  story_update_processed, state_diff,    -- Was sich geändert hat
  player_action, is_freetext,             -- Was der Spieler getan hat
  dice_roll, dice_success,               -- Würfelergebnis
  scene_type, narrative_style,           -- Klassifizierung
  act_before, act_after,                 -- Akt-Wechsel
  tension_before, tension_after,         -- Tension-Verlauf
  quests_snapshot,                        -- Quest-State nach dem Turn
  created_at
);
```

### Scene Types (auto-klassifiziert)
- `kampf` — Kampfszenen
- `dialog` — NPC-Interaktion
- `erkundung` — Erkundung/Entdeckung
- `rätsel` — Puzzles
- `sozial` — Handel/Handelsinteraktion
- `erzählung` — Narrativ/Allgemein
- `opening` — Eröffnungsszene

### State-Diff (pro Turn)
Jeder Journal-Eintrag enthält einen `state_diff` der genau dokumentiert was sich geändert hat:
```json
{
  "tension": { "from": 20, "to": 35 },
  "act": { "from": 1, "to": 2 },
  "quest_changes": [{ "name": "Quest", "status": "completed" }],
  "npc_changes": [{ "name": "NPC", "status": "dead" }],
  "location_changes": [{ "name": "Ort", "state": "zerstört" }],
  "faction_changes": [{ "name": "Fraktion", "power_level": 80 }],
  "events_created": [{ "type": "death", "description": "..." }],
  "flags_set": { "king_dead": true }
}
```

### API-Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `/api/game/journal/:saveId` | GET | Volles Journal für einen Save (mit Prompts) |
| `/api/game/journal/:saveId?prompts=false` | GET | Journal ohne Prompts (kleiner) |
| `/api/game/journal/:saveId/summary` | GET | Zusammenfassung + Statistiken |
| `/api/game/journal/world/:worldId` | GET | Journal für eine ganze Welt (alle Saves) |

### Query-Parameter
- `limit` (default 100, max 500)
- `offset` (default 0)
- `prompts` (true/false, default true) — Prompts ein/ausschließen

### Statistiken (Summary-Endpoint)
```json
{
  "scenes": [...],
  "stats": {
    "total_turns": 42,
    "success_rate": 67,
    "scene_types": { "kampf": 12, "dialog": 15, "erkundung": 10 },
    "narrative_styles": { "success": 20, "failure": 12, "critical": 5 },
    "act_distribution": { "1": 15, "2": 18, "3": 9 }
  }
}
```

### Nutzung für Story-Evaluation
1. `/api/game/journal/:saveId` laden
2. Jeder Eintrag zeigt: Player-Action → LLM-Prompt → LLM-Response → State-Changes
3. `state_diff` zeigt genau was der LLM-Response bewirkt hat
4. `scene_type` + `narrative_style` für Muster-Analyse
5. `act_before/after` + `tension_before/after` für Spannungskurve

### Dateien
- `server/engine/story-logger.js` — NEU (Logging-Modul)
- `server/db.js` — story_journal Tabelle + Indizes
- `server/routes/game.js` — Logging in /new + /action, Journal-Endpoints

---

_Plan erstellt: 2026-07-28 ~21:06. Story Engine implementiert: 2026-07-29. Story Journal: 2026-07-29._
