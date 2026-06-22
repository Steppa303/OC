# Updateplan für Reader‑App

**Ziel:**
Behebe die kritischen Usability‑Probleme, die im aktuellen Reader‑Projekt bestehen:
1. **Pause‑Taste (Space‑Bar) für TTS funktioniert nicht zuverlässig.**
2. **Lesezeichen‑Workflow ist defekt – beim Setzen wird kein Bookmark gespeichert bzw. angezeigt.**
3. **E‑Pub‑Dateien werden nur als reiner Fließtext angezeigt – Formatierung (Absätze, Überschriften, Aufzählungen) geht verloren.**
4. **Kapitel, die nur Bild‑Content enthalten, werden mit *"content could not be loaded"* angezeigt. Bilder sollen dargestellt werden.**

---

## Gesamt‑Strategie
- **Analyse → Fix → Test → Docs** in einem einzigen Pull‑Request.
- Jede Issue wird als separater **Sub‑Task** in einem Orchestrator‑Subagenten ausgeführt (max. 15 min pro Sub‑Task).
- Nach jedem Sub‑Task wird ein **Dashboard‑Eintrag** erzeugt (vgl. `TOOL: sessions_spawn`‑Workflow).  
- Der Haupt‑Agent (dieser) orchestriert, sammelt Ergebnisse und schreibt das finale Pull‑Request‑Commit‑Message.

---

## 1️⃣ Pause‑Taste (Space‑Bar) für Voice
| Schritt | Beschreibung | Code‑Datei | Erwartetes Ergebnis |
|--------|--------------|------------|---------------------|
| **1.1** | Prüfen, ob `keydown`‑Handler im Frontend `Space` korrekt auf `dom.playBtn.click()` mappt (bereits vorhanden). | `public/app.js` (Zeile ~320) | Space‑Ereignis wird gefeuert. |
| **1.2** | Sicherstellen, dass `audioEl.pause()` den `isPaused`‑State setzt und UI‑Icon zu *Play* wechselt. Aktuell `pauseAudio()` nur `audioEl.pause(); isPaused = true;`. Das `onpause`‑Event ändert das Icon, aber `isPaused` wird nur dort gesetzt. Ergänze `audioEl.onpause`‑Handler, um `isPaused` = true zu garantieren. | `public/app.js` (Funktion `pauseAudio`, `audioEl.onpause`) | Beim Drücken von Space wird das Icon sofort zu *Play* und keine Fehl‑Zustände. |
| **1.3** | Einheitliche Zustands‑Logik: `isPlaying && !isPaused` → icon *pause*; sonst *play*. Nach `pauseAudio` sofort `dom.playIcon.className = 'icon icon-play'`. | `public/app.js` (`updatePlayerState`) | UI‑Icon spiegelt exakt den Audio‑Zustand. |
| **1.4** | Tests: 1) Play → Space → Pause, 2) Pause → Space → Resume, 3) Stop → Space (neuer Play). Verwende Playwright‑E2E‑Test (`tests/reader.spec.js`). | `tests/reader.spec.js` | Alle drei Szenarien bestehen, keine Fehl‑Logs. |

---

## 2️⃣ Lesezeichen‑Workflow
| Schritt | Beschreibung | Code‑Datei | Erwartetes Ergebnis |
|--------|--------------|------------|---------------------|
| **2.1** | Backend‑Endpoint `POST /api/bookmarks/:id` akzeptiert bereits `chapterIndex` + `progress`. Prüfen, ob DB‑Schema `bookmarks` einen eindeutigen `book_id`‑Index hat (für Upsert). Wenn nicht, Index hinzufügen, um Race‑Conditions zu vermeiden. | `db.js` (Schema‑Definition) | `UNIQUE(book_id)` oder `ON CONFLICT REPLACE`.
| **2.2** | Frontend: Beim Klick auf Bookmark‑Button wird `progress` = scrollTop/height berechnet. Aktuell wird `isNaN(progress) ? 0 : progress` verwendet – fine. Aber UI‑Icon wird erst nach einem **GET**‑Aufruf aktualisiert. Füge ein **optimistisches Update**: sofort `dom.bookmarkIcon.className = 'icon icon-bookmark-check'` und fallback bei Fehler. | `public/app.js` (Bookmark‑Click‑Handler) |
| **2.3** | Beim Laden eines Buchs (`loadBook`) muss das gespeicherte Bookmark aus dem GET‑Response gesetzt werden (`currentChapterIndex = bm.chapter_index`). Zusätzlich `saveProgress` sollte `chapterIndex` = bm.chapter_index übernehmen, wenn kein Scroll‑Progress vorhanden ist. | `public/app.js` (loadBook, saveProgress) |
| **2.4** | Einheitliche Feldnamen: Backend sendet `chapter_index`, Frontend verwendet `chapterIndex`. Prüfen, ob JSON‑Parser das camelCase‑Mapping automatisch macht – falls nicht, im Frontend `bm.chapter_index` umbenennen. | `public/app.js` (updateBookmarkIcon) |
| **2.5** | Tests: Setze Bookmark, lade Buch neu, prüfe, dass Icon und Kapitel‑Index korrekt sind. | `tests/reader.spec.js` |

---

## 3️⃣ Verbesserte Text‑Formatierung für EPUBs
| Schritt | Beschreibung | Code‑Datei | Erwartetes Ergebnis |
|--------|--------------|------------|---------------------|
| **3.1** | Im `epub-parser.js` statt komplettem `textContent`‑Export eine **HTML‑Fragment‑Export** implementieren. Entferne nur `script`, `style`, `nav`, aber belasse `<p>`, `<h1‑h3>`, `<ul>/<ol>/<li>` und `<img>` erhalten. |
| **3.2** | Statt `cleanText = body ? body.textContent.replace(/\s+/g, ' ').trim() : ''` jetzt `cleanHTML = body.innerHTML.trim()` und anschließend mit `sanitize-html` (oder einfacher Regex) unerwünschte Tags entfernen, aber Grundstruktur behalten. |
| **3.3** | Frontend: `formatChapterText` anpassen, sodass wenn `chapter.text` bereits **HTML** enthält, es unverändert (oder leicht escaped) gerendert wird. Entferne das komplette Zeilen‑Split‑Logik, setze stattdessen `dom.contentArea.innerHTML = chapter.html || fallbackHTML`. |
| **3.4** | Füge Option `preserveFormatting: true` zum `parseEpub`‑Return‑Objekt hinzu, damit Aufrufer wählen können. Standard‑Frontend nutzt es. |
| **3.5** | Tests: Laden eines EPUBs mit Überschriften, Listen und Absätzen. Prüfe, dass im DOM die entsprechenden `<h2>`, `<ul>`, `<p>` vorkommen. |

---

## 4️⃣ Bild‑Kapitel korrekt darstellen
| Schritt | Beschreibung | Code‑Datei | Erwartetes Ergebnis |
|--------|--------------|------------|---------------------|
| **4.1** | Während `parseEpub` jedes Kapitel verarbeitet, **extrahiere `<img>`‑Tags** aus dem XHTML. Für jedes `src`‑Attribut:   - Pfad relativ zum OPF‑Verzeichnis auflösen.   - Bild‑Datei aus dem ZIP lesen (`zip.readFile`).   - Base64‑Kodierung erzeugen (`data:image/<ext>;base64,…`).   - `src` im HTML‑Fragment ersetzen. |
| **4.2** | Wenn ein Kapitel **keinen lesbaren Text** enthält, aber mindestens ein Bild, setze `text` → `''` und zusätzlich ein Feld `html` mit dem Bild‑Tag. Frontend rendert das HTML, sodass das Bild sichtbar ist. |
| **4.3** | Für Kapitel, die ausschließlich Text‑Platzhalter wie *"Content could not be loaded"* enthalten, setze `html` = `'<p class="error">Content could not be loaded</p>'`. |
| **4.4** | Frontend‑Anpassung: In `loadChapter` prüfe, ob `chapters[index].html` existiert → `dom.contentArea.innerHTML = chapters[index].html`; sonst `formatChapterText(chapters[index].text)`. |
| **4.5** | Tests: EPUB mit Bild‑Kapitel (z. B. Graphic‑Novel). Stellen sicher, dass das Bild im Reader sichtbar ist und nicht als Fehler‑Placeholder erscheint. |

---

## Orchestrator‑Sub‑Agent‑Plan (Taskflow)
```
Task: "Reader‑App Updateplan Umsetzen"
Model: qwen3.6-plus (maximales Reasoning)
Sub‑Agents:
  1. pause‑fixer   → tidy pause‑logic, add tests
  2. bookmark‑fixer → DB‑index, optimistic UI, tests
  3. formatter‑enhancer → modify epub‑parser, adjust frontend, tests
  4. image‑handler → extend parser for img, frontend render, tests
```
Jeder Sub‑Agent bekommt ein eigenes `taskName` (z. B. `pause-fix`, `bookmark-fix` …) und einen Timeout von **10 Min** (kleiner als Gesamtlaufzeit). Nach jedem Sub‑Agent wird `sessions_yield()` benutzt, das Ergebnis wird ins Dashboard gepusht (`POST /api/agents/end`).

---

## Implementation‑Roadmap (innerhalb des Repos)
1. **Branch anlegen:** `git checkout -b update/reader‑fixes`
2. **Datenbank‑Schema‑Patch:**
   ```bash
   apply_patch <<'PATCH'
*** Begin Patch
*** Update File: projects/reader-app/db.js
@@
   CREATE TABLE IF NOT EXISTS bookmarks (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     book_id TEXT NOT NULL,
@@
   );
*** End Patch
PATCH
   ```
   *Füge einen eindeutigen Index auf `book_id` hinzu (nachträglich).*
3. **Parser‑Erweiterungen** (`epub-parser.js`):
   - Bild‑Extraktion + Base64‑Einbettung
   - HTML‑Export statt reiner Text
   - `preserveFormatting`‑Flag
4. **Frontend‑Änderungen** (`public/app.js`):
   - `loadChapter` nutzt `chapter.html` falls vorhanden.
   - Optimistisches Bookmark‑Icon‑Update.
   - `pauseAudio` und `audioEl.onpause` synchronisieren `isPaused`.
5. **Tests** (`tests/reader.spec.js`):
   - Neue Playwright‑Szenarien für Pause‑Taste, Bookmark‑Persistenz, Format‑Erhaltung und Bild‑Kapitel.
   - CI‑Pipeline prüft `npm test`.
6. **CI‑Update:** In `package.json` ggf. `test`‑Script erweitern, CI‑Cache leeren.
7. **Dokumentation:** README‑Abschnitt *Known Issues → Fixed* ergänzen, Changelog‑Eintrag.
8. **Pull‑Request erstellen**, Review intern, Merge und Deploy (`pm2 restart reader-app`).

---

## Acceptance Criteria
- **Pause‑Taste** funktioniert zuverlässig in allen gängigen Browser‑Umgebungen; UI‑Icon wechselt sofort.
- **Lesezeichen** werden beim Klick gespeichert, bleiben nach einem Neuladen erhalten und das Icon zeigt `bookmark-check` an.
- **E‑Pub‑Render** zeigt Überschriften, Absätze und Listen mit korrekter HTML‑Struktur (keine blandes Fließtext‑Blob).
- **Bild‑Kapitel** zeigen das Bild (Base64‑embedded) anstelle von *"content could not be loaded"*.
- Alle neuen und geänderten Funktionen sind durch automatisierte Playwright‑Tests abgedeckt und laufen in CI ohne Fehler.

---

*Hinweis:* Der Plan ist bewusst granular, damit ein **Coding‑Agent** (z. B. `qwen3.6-plus`) die einzelnen Sub‑Tasks in parallelisierten, kurzen Runs erledigen kann. Jeder Sub‑Task darf nicht länger als 10 Min dauern, damit das System‑Timeout von 15 Min nicht überschritten wird.
