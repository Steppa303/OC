# 🦞 EntertainBernd – Chat-UX Konzept

**Was will der Bot?** Du schreibst einen Suchbegriff → ich wühl das Usenet durch → du klickst auf das was du willst → landet bei SABnzbd → automatisch in Google Drive.

---

## 1. Der Flow – Kurzfassung

```
/start
  └→ Config-Menü (Medientyp, Sprache, Quelle)
       └→ "🔍 Los, suchen!"
            └→ Bot sagt: "Suchbegriff eingeben:"
                 └→ User tippt → API holt 100 Treffer mit cat= Filter
                      └→ Bot zeigt 10 beste an
                           ├→ [Zahl] → Detail-Ansicht → Download
                           ├→ Filter per Bot-Menü /filter
                           └→ [➡️] → nächste 10
```

**Kein Inline-Keyboard-Wahnsinn mehr.** Filter laufen übers Bot-Menü (`/filter`), nicht über 20 Buttons unterm Ergebnis.

---

## 2. Bot-Menü statt Button-Flut

### Das Problem aktuell
Nach ner Suche haben wir:
```
[1] [2] [3] [4] [5]
[6] [7] [8] [9] [10]
[⬅️] [Seite 1/3] [➡️]
[🇩🇪 DE] [🇬🇧 EN] [🌐 Alle]
[🌐 Geek] [🔧 Hydra] [🔀 Beide]
```

Das sind ~15 Buttons. Aufm iPhone sieht das aus wie'n Ziffernblock für Blinde. Plus Telegram erlaubt nur 8 Buttons pro Row in der Höhe bevor es zugeklappt wird.

### Die Lösung: Bot-Menü + / Slash-Commands

Telegram hat ein natives Bot-Menü (der Button links neben dem Eingabefeld). Da packen wir rein:

```
📋 Mein Menü
├── /start       – Neue Suche konfigurieren
├── /filter      – Sprache & Quelle filtern (aktuell: DE)
├── /media       – Medientyp wechseln (aktuell: Film/Serie)
├── /queue       – Downloads anzeigen
└── /watch       – Watchlist verwalten
```

**So läuft's:**
1. User sucht → 100 Ergebnisse werden geholt, 10 angezeigt
2. Filter läuft **nicht** über Inline-Keyboard, sondern über `/filter`:
   - `/filter` zeigt: "Aktuell: 🇩🇪 DE | 🌐 Geek+Hydra"
   - Mit Inline-Buttons **nur für diese eine Kategorie** (max 3 Buttons)
   - Nach Auswahl: Ergebnis-Liste neu anzeigen (aus dem Cache, kein API-Call)
3. `/media` wechselt den Medientyp:
   - "Aktuell: 🎬 Film/Serie. Neuen Typ wählen:"
   - `[🎵 Audio] [📚 Bücher] [🎮 Games] [📦 Alle]`
   - Nach Auswahl: **neuer API-Call** (weil cat= anders sein muss)

**Vorteil:** Ergebnis-Ansicht hat nur noch maximal 6-8 Buttons:
```
[1] [2] [3] [4] [5]
[6] [7] [8] [9] [10]
[⬅️] [Seite 1/10] [➡️]
[📋 Filter: DE, Beide]
```

Der Filter-Button öffnet kein Callback, sondern ist nur ein Hinweis "drück /filter um zu ändern" – oder ein einziger Button der `/filter` triggert.

---

## 3. 100 Treffer suchen, 10 anzeigen

### Warum?
Suchst du "Star Wars" mit `cat=2000,5000` (Film+Serie) und filterst dann auf "Deutsch" – wenn nur 10 Ergebnisse da sind, bleibt vielleicht 1 übrig. Mit 100 Ergebnissen im Cache haben Filter **Futter**.

### Wie?
```python
MAX_RESULTS = 100     # API holt 100
PAGE_SIZE = 10         # Anzeige 10 pro Seite
```

- `search_all(query, cat)` holt 100 von Hydra + 100 von Geek → merged + dedupliziert → max 100
- `ctx.user_data["last_results"]` speichert alle 100
- `ctx.user_data["page_size"] = 10` – Anzeige nur 10
- Filter arbeiten auf dem 100er Cache
- Pagination: 10 Seiten bei 100 Treffern

### Edge Cases
- **Weniger als 10 Treffer:** Kein Problem, wird normal angezeigt
- **Filter reduziert auf < 10:** Auch ok, zeigt was übrig ist
- **Session-Timeouts:** `ctx.user_data` fliegt nach ~24h Inaktivität weg – dann einfach neu suchen
- **Telegram 4096 Zeichen:** 10 Ergebnisse + Metadaten = ~2000 Zeichen. 100 Ergebnisse formatiert wären ~20.000 Zeichen – deswegen nur 10 anzeigen, der Rest ist im Cache

---

## 4. Die Komponenten

### 4.1 Config-Menü (`/start`)

```
⚙️ EntertainBernd – Suche konfigurieren
🎬 Film/Serie | 🌐 Alle Sprachen | 🔀 Beide Quellen

[🎬 Film/Serie] [🎵 Audio] [📚 Bücher] [🎮 Games] [📦 Alle]
[🇩🇪 DE] [🇬🇧 EN] [🌐 Alle]
[🌐 Geek] [🔧 Hydra] [🔀 Beide]
[🔍 Los, suchen!]
```

Config bleibt im `ctx.user_data["config"]` bis `/start` neu gedrückt wird. Suchen hintereinander mit gleichen Einstellungen möglich.

### 4.2 Ergebnis-Ansicht

```
🔍 42/100 Treffer für: star wars

 1. 🌐 Geek 🎬 Film · 10.0 GB · Star Wars: The Mandalorian and Grogu 2026
 2. 🔧 Hydra 📺 Serie · 850 MB · Star Wars Rebels S04E22 German
 3. 🌐 Geek 🎬 Film · 4.7 GB · Star Wars: Episode VII – The Force Awakens
...
10. 🔧 Hydra 📺 Serie · 1.2 GB · The Book of Boba Fett S01E05

[1] [2] [3] [4] [5] [6] [7] [8] [9] [10]
[⬅️] [Seite 1/10] [➡️]
```

**Keine Filter-Buttons in der Ergebnis-Ansicht.** Nur Zahlen + Pagination.

**Filter leben im Bot-Menü:**
- `/filter` → Sprache + Quelle umschalten (arbeitet auf Cache)
- `/media` → Medientyp wechseln (neuer API-Call nötig)

**Der "📋" Button im Inline-Keyboard** (oder `/filter`) öffnet ein kompaktes Filter-Menü:

```
🔍 Filter (42/100 Treffer)

Sprache: [🇩🇪 DE] [🇬🇧 EN] [🌐 Alle]
Quelle:  [🌐 Geek] [🔧 Hydra] [🔀 Beide]
[🔄 Anwenden]
```

Nach "Anwenden": Ergebnis-Liste neu anzeigen mit gefilterten Daten.

### 4.3 Detail-View

```
📄 Star Wars: Episode VII – The Force Awakens
🎬 Film | 🌐 Geek
📦 4.7 GB | 🇩🇪 DE | 2015

[⬇️ Download] [❤️ Merken] [🔙 Zurück]
```

- "❤️ Merken" = in persönliche Watchlist (kommt später)
- "🔙 Zurück" zur Ergebnis-Liste (Seite + Filter bleiben)

### 4.4 Bot-Menü (Telegram native)

Per `BotFather` oder `set_my_commands`:

```
/start   – Neue Suche, Config ändern
/filter  – Sprache & Quelle filtern
/media   – Medientyp wechseln
/queue   – Laufende Downloads anzeigen
/watch   – Watchlist verwalten (coming soon)
```

Das ist **immer sichtbar** – User muss sich nix merken.

---

## 5. Technische Änderungen

| Was | Aktuell | Neu |
|-----|---------|-----|
| `MAX_RESULTS` | 10 | 100 |
| `PAGE_SIZE` | 10 | 10 (bleibt) |
| Filter-Position | Inline-Keyboard in Ergebnis | `/filter` Command + kompaktes Inline-Menü |
| Media-Type-Wechsel | Inline-Keyboard | `/media` Command |
| Bot-Menü | Nicht gesetzt | `/start`, `/filter`, `/media`, `/queue`, `/watch` |
| `handle_search()` | Sucht 10, zeigt 10 | Sucht 100, zeigt 10 |
| Filter-Betrieb | Alle Filter clientseitig | Sprache/Quelle clientseitig (Cache), Media-Type neuer API-Call |

### Neue Handler

```python
CommandHandler("filter", cmd_filter)      # Filter-Menü anzeigen
CommandHandler("media", cmd_media)        # Medientyp wechseln
CommandHandler("queue", cmd_queue)        # SABnzbd Queue
CommandHandler("watch", cmd_watch)        # Watchlist (später)
```

### Filter-Callbacks (kompakt)

```python
# Statt filter_lang_de, filter_lang_en, filter_lang_all, filter_source_geek, ...
# Nur noch 2 Gruppen:
CallbackQueryHandler(filter_apply, pattern=r"^flt_")   # flt_lang_de, flt_source_geek
```

### MAX_RESULTS = 100

Einzige Änderung: Konstante hochsetzen. Die API unterstützt `limit=100`. Merge + Dedup bleibt gleich. `last_results` wird größer, aber das ist nur Python-in-memory, kein Performance-Problem.

---

## 6. Telegram-Limits (Real Talk)

| Limit | Wert | Problem? |
|-------|------|----------|
| Nachricht Zeichen | 4096 | 10 Ergebnisse + Meta = ~2000 Zeichen. Safe. |
| Inline-Keyboard Buttons | max 100 | Wir haben ~13. Ok. |
| Callback-Data | max 64 Bytes | `detail_42` = 9 Bytes. Safe. |
| Bot-Menü Einträge | max 8 | Wir haben 5. Passt. |
| `ctx.user_data` Lebensdauer | ~24h | Kein Persistenz. Nach nem Tag ist der Cache weg. |
| API `limit=100` | Wird unterstützt | Hydra + Geek liefern beide 100. |

---

## 7. Was noch fehlt (TODOs)

- [ ] **`/media` Command** – Medientyp wechseln triggert neuen API-Call
- [ ] **`/filter` Command** – Kompaktes Filter-Menü, arbeitet auf Cache
- [ ] **MAX_RESULTS auf 100** – Einzeiler, aber testen ob Hydra/Geek mitspielen
- [ ] **Bot-Menü setzen** – Per `BotFather` oder `bot.set_my_commands()`
- [ ] **`/queue` Command** – SABnzbd Status abrufen
- [ ] **`/watch` Command** – Watchlist (Cron-Job, Benachrichtigungen)
- [ ] **Session-Timeout-Handling** – `ctx.user_data` leer → freundliche Meldung + neustart

---

## 8. TL;DR

- **Bot-Menü statt Button-Flut** – `/filter`, `/media`, `/queue` als Slash-Commands, immer sichtbar
- **100 Treffer API, 10 anzeigen** – Filter haben Futter, Pagination sinnvoll
- **Detail-View + Download** bleibt gleich, funktioniert
- **Kein Inline-Keyboard-Wahnsinn** mehr in der Ergebnis-Ansicht – nur Zahlen + Pagination
- **Filter leben separat** – kompaktes Inline-Menü nur für die aktuelle Aktion, nicht permanent

---

*Stand: 2026-07-09. Rewrite von chatux.md – weniger Gelaber, mehr SubstanZ.*