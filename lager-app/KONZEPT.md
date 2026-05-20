# Lagerbestands-WebApp – Technisches Konzept

## 1. App-Übersicht & Zielgruppe

### Was ist das?
Eine mobile-first WebApp zur digitalen Lagerverwaltung, die den manuellen Aufwand für Inventur und Bestandsführung radikal reduziert. Der Kern: Ein intelligenter Excel-Import, der beliebige Tabellenstrukturen versteht, und ein Quick-Adjust-System, das Bestandsänderungen in 2–3 Klicks ermöglicht.

### Zielgruppe
- Kleine bis mittlere Unternehmen mit physischem Warenlager
- Handwerksbetriebe, Büros, Werkstätten, Einzelhandel
- Teams ohne dedizierte IT-Abteilung (Low-Tech-Affinität)
- Nutzer, die bereits mit Excel arbeiten, aber mehr Struktur und Mobilität brauchen

### Kernversprechen
- **Kein manueller Dateneingabe-Marathon:** Excel hochladen → AI parst → Inventar ist da.
- **Bestandsänderung so einfach wie eine SMS:** Artikel antippen, Menge eingeben, fertig.
- **Mobile First:** Funktioniert auf dem Smartphone im Lager genauso gut wie am Desktop.

---

## 2. Feature-Beschreibungen

### 2.1 Excel-Import mit intelligenter AI-Analyse

**Problem:** Jede Firma hat ihre eigene Excel-Struktur. Spalten heißen "Artikel", "Produkt", "Ware", "Name" oder "Bezeichnung". Mengen stehen mal als Zahl, mal mit Einheit ("50 Stk."), mal in einer kombinierten Spalte ("Kugelschreiber blau – 200").

**Lösung:** Ein mehrstufiger Parsing-Pipeline, die strukturelle Muster erkennt und semantisch zuordnet.

#### Ablauf:
1. **Datei-Upload:** User lädt `.xlsx` oder `.xls` hoch.
2. **Sheet-Auswahl:** Bei mehreren Sheets wählt der User das relevante aus (oder AI schlägt das wahrscheinlichste vor).
3. **Strukturanalyse (AI-Parsing):**
   - **Header-Erkennung:** Die erste nicht-leere Zeile wird als Header-Kandidat analysiert.
   - **Spalten-Semantik-Classification:** Jede Spalte wird anhand ihres Headers und ihrer Datenwerte klassifiziert:
     - `ARTICLE_NAME`: Enthält Text, hohe Varianz, keine reinen Zahlen.
     - `QUANTITY`: Enthält numerische Werte oder Zahlen mit Einheiten.
     - `UNIT`: Optionale Spalte mit Einheiten (Stk., kg, m, etc.).
     - `IMAGE_REF`: Enthält Dateinamen, URLs oder Base64-Strings.
     - `CATEGORY`, `LOCATION`, `PRICE`: Weitere optionale Metadaten.
   - **Datenbereinigung:**
     - Entfernt Leerzeichen, normalisiert Groß/Kleinschreibung.
     - Extrahiert reine Zahlen aus Strings wie "50 Stk." → `50`.
     - Erkennt kombinierte Felder ("Kugelschreiber – 200") und splittet sie.
4. **Vorschau & Korrektur:** User sieht eine Tabelle mit zugeordneten Spalten und kann bei Fehlzuordnungen manuell korrigieren (Dropdown pro Spalte: "Diese Spalte ist...").
5. **Import bestätigen:** Daten werden in die Datenbank geschrieben.

### 2.2 Bilder aus Excel übernehmen

**Herausforderung:** Excel speichert Bilder nicht in Zellen, sondern als Overlay-Objekte. Einfache CSV-Exports verlieren sie.

**Strategie:**
- **Szenario A – Bilder als Dateinamen/URLs in einer Zelle:**
  - Wenn eine Spalte als `IMAGE_REF` erkannt wird (enthält `.jpg`, `.png`, `http://`), wird der Pfad/URL übernommen.
  - Bei lokalen Pfaden: User muss Bilder separat hochladen oder in einen Cloud-Ordner legen.
- **Szenario B – Bilder embedded in Excel:**
  - Beim Parsen der `.xlsx`-Datei (mit Bibliothek wie `xlsx` + `jszip`) werden embedded Images extrahiert.
  - Jedes Bild wird einer Zeile zugeordnet basierend auf seiner Position (welche Zelle es überlappt).
  - Bilder werden als Base64 oder in einen Blob-Storage hochgeladen und mit der Artikel-ID verknüpft.
- **Fallback:** Wenn keine Zuordnung möglich ist, wird ein Platzhalter-Icon angezeigt.

### 2.3 Automatisiertes Inventar-Befüllen

Nach dem Parsing und der Bestätigung:
- Jeder erkannte Artikel wird als Datensatz in der Datenbank angelegt.
- Felder: `id`, `name`, `quantity`, `unit`, `category`, `location`, `image_url`, `created_at`, `updated_at`.
- Duplikatsprüfung: Wenn ein Artikel mit gleichem Namen bereits existiert, wird der User gefragt: Überschreiben, Zusammenführen oder Ignorieren?
- Das Inventar ist sofort live und可通过 Mobile App zugänglich.

### 2.4 Low-Barrier Bestandsanpassung (Quick-Adjust)

**Ziel:** 50 Kugelschreiber entnehmen in maximal 2–3 Klicks.

**User Flow:**
1. **Home Screen / Artikelliste:** User sieht alle Artikel mit aktuellem Bestand.
2. **Artikel antippen:** Öffnet Detailansicht ODER direkt ein Inline-Action-Menu.
3. **Aktion wählen:** Zwei große Buttons: `[+] Hinzufügen` und `[-] Entnehmen`.
4. **Menge eingeben:** Numpad öffnet sich (mobile-optimiert). User tippt `50` ein.
5. **Bestätigen:** Button `[Bestätigen]` – fertig.

**Optimierung für 2–3 Klicks:**
- **Swipe-Gesten:** Swipe rechts = +1, Swipe links = -1 (für schnelle Einzelanpassungen).
- **Long-Press:** Hält man einen Artikel gedrückt, öffnet sich direkt das Quantity-Input.
- **Schnellsuche:** Suchfeld oben filtert live. Tippe "Kugi" → "Kugelschreiber" erscheint → antippen → Menge eingeben.
- **Barcode-Scanner (optional):** Kamera-Scan öffnet Quantity-Input direkt.

**Technisch:**
- Optimistische UI-Update: Bestand ändert sich sofort visuell, API-Call im Hintergrund.
- Offline-Support: Änderungen werden lokal gespeichert und synchronisiert, wenn Online.

### 2.5 Excel-Export des aktuellen Bestands

- **One-Click-Export:** Button "Als Excel exportieren" generiert eine `.xlsx`-Datei.
- **Format:** Saubere Tabelle mit Spalten: Name, Menge, Einheit, Kategorie, Ort, Letztes Update.
- **Bilder:** Optional als Hyperlinks oder eingebettet (je nach Größe).
- **Zeitstempel:** Dateiname enthält Datum: `Lagerbestand_2026-05-13.xlsx`.

---

## 3. UI/UX Konzept

### Design-Prinzipien
- **Mobile First:** Alle Interaktionen sind für Touch optimiert. Große Buttons, klare Typografie.
- **Minimalistisch:** Keine überflüssigen Elemente. Fokus auf Bestand und Aktionen.
- **Visuelles Feedback:** Jede Aktion hat eine unmittelbare visuelle Reaktion (Animation, Toast, Farbwechsel).
- **Farbschema:** Helles, freundliches Design mit klarem Kontrast. Primärfarbe: Blau (#2563EB) für Vertrauen und Professionalität. Akzentfarbe: Grün (#10B981) für positive Aktionen (Hinzufügen), Rot (#EF4444) für negative (Entnehmen).

### Screens & User Flows

#### Screen 1: Dashboard / Home
- **Header:** App-Logo, Suchfeld, Profil-Icon.
- **Hauptbereich:** Liste aller Artikel als Cards.
  - Jede Card: Artikelbild (oder Placeholder), Name, aktueller Bestand (groß und fett), Einheit.
  - Swipe-Gesten aktiviert.
- **Floating Action Button (FAB):** `[+] Neuer Artikel` (manuell hinzufügen).
- **Top-Bar Actions:** `[Excel Import]` `[Excel Export]`

#### Screen 2: Excel-Import Wizard
- **Step 1:** Datei hochladen (Drag & Drop oder Datei-Browser).
- **Step 2:** Sheet-Auswahl (wenn mehrere vorhanden).
- **Step 3:** Spalten-Zuordnung (Tabelle mit Dropdowns pro Spalte: "Ist dies der Artikelname?", "Ist dies die Menge?").
- **Step 4:** Vorschau (erste 10 Zeilen) mit Korrekturmöglichkeit.
- **Step 5:** Import starten → Fortschrittsbalken → Erfolgsmeldung.

#### Screen 3: Artikel-Detailansicht
- **Großes Artikelbild** (wenn vorhanden).
- **Name** (H1).
- **Aktueller Bestand** (riesige Zahl, zentriert).
- **Zwei große Buttons:** `[− Entnehmen]` `[+ Hinzufügen]` (nebeneinander, full-width).
- **Metadaten:** Kategorie, Ort, Letztes Update (kleiner, unten).
- **Historie:** Letzte 5 Bestandsänderungen (Timeline).

#### Screen 4: Quick-Adjust Modal (Overlay)
- Wird beim Tippen auf `[−]` oder `[+]` geöffnet.
- **Numpad** (große Tasten, mobile-optimiert).
- **Aktueller Bestand** angezeigt.
- **Buttons:** `[Abbrechen]` `[Bestätigen]`.
- Schließt sich automatisch nach Bestätigung mit Success-Toast.

#### Screen 5: Einstellungen
- Benutzerprofil.
- Sync-Status (Online/Offline).
- Backup-Optionen.
- Theme (Hell/Dunkel).

---

## 4. Technische Architektur

### Tech Stack

| Layer | Technologie | Begründung |
|-------|-------------|------------|
| **Frontend** | React + TypeScript | Komponentenbasiert, große Community, TypeScript für Typsicherheit. |
| **UI Framework** | Tailwind CSS + Headless UI | Schnelles Styling, mobile-first Utilities, zugängliche Components. |
| **State Management** | Zustand oder Redux Toolkit | Einfach, skalierbar, DevTools. |
| **Mobile Optimierung** | PWA (Progressive Web App) | Installierbar, Offline-Support via Service Workers. |
| **Backend** | Node.js + Express | Leichtgewichtig, JavaScript-Stack durchgängig. |
| **Datenbank** | PostgreSQL + Prisma ORM | Relationale Daten, ACID-konform, Prisma für typsichere Queries. |
| **Excel-Parsing** | `xlsx` (SheetJS) + `jszip` | De-facto Standard für Excel in JS, unterstützt embedded Images. |
| **AI/ML (Parsing)** | Custom Heuristics + Optional LLM-API | Für Header-Klassifikation: Regelbasiert + Keyword-Matching. Für komplexe Fälle: GPT-4o Mini API Call (kostengünstig). |
| **Bild-Speicher** | AWS S3 oder lokaler Blob-Storage | Skalierbar, CDN-fähig. |
| **Auth** | JWT + Refresh Tokens | Stateless, einfach zu implementieren. |
| **Deployment** | Docker + VPS oder Vercel/Render | Containerisiert, leicht zu deployen. |

### Datenmodell (Prisma Schema)

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  password  String   // Hashed
  items     Item[]
  createdAt DateTime @default(now())
}

model Item {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  quantity    Int
  unit        String?  // "Stk.", "kg", "m", etc.
  category    String?
  location    String?  // "Regal A3", "Lager 2", etc.
  imageUrl    String?  // URL zum Bild
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  history     StockHistory[]
}

model StockHistory {
  id        String   @id @default(uuid())
  itemId    String
  item      Item     @relation(fields: [itemId], references: [id])
  change    Int      // +50 oder -30
  reason    String?  // "Verkauf", "Eingang", "Korrektur"
  timestamp DateTime @default(now())
}
```

### Excel-Parsing Strategie (Detailliert)

**Phase 1: Rohdaten-Extraktion**
- Bibliothek `xlsx` liest die `.xlsx`-Datei.
- Alle Sheets werden extrahiert.
- Für jedes Sheet: Header-Zeile identifizieren (erste Zeile mit >50% nicht-leeren Zellen).
- Datenzeilen als Array von Objekten: `[{ col1: "Wert1", col2: "Wert2", ... }, ...]`.

**Phase 2: Spalten-Klassifikation (Heuristic Engine)**

Für jede Spalte werden folgende Merkmale analysiert:

1. **Header-Text-Analyse:**
   - Keywords für `ARTICLE_NAME`: "artikel", "name", "produkt", "ware", "bezeichnung", "titel", "description".
   - Keywords für `QUANTITY`: "menge", "anzahl", "quantity", "count", "bestand", "stk", "stück".
   - Keywords für `UNIT`: "einheit", "unit", "maß", "uom".
   - Keywords für `IMAGE_REF`: "bild", "image", "foto", "url", "pfad".
   - Case-insensitive, Levenshtein-Distanz für Tippfehler-Toleranz.

2. **Datenwert-Analyse:**
   - `ARTICLE_NAME`: >80% der Werte sind Strings, hohe Varianz (viele einzigartige Werte), Länge >3 Zeichen.
   - `QUANTITY`: >80% der Werte sind numerisch oder enthalten Zahlen. Regex: `/^\d+(\.\d+)?\s*(stk|kg|m|l)?$/i`.
   - `UNIT`: Wiederkehrende kurze Strings ("Stk.", "kg", "m", "Liter").
   - `IMAGE_REF`: Enthält `.jpg`, `.png`, `http://`, `https://`, oder Base64-Pattern (`data:image/`).

3. **Positionelle Heuristik:**
   - In den meisten Tabellen steht der Artikelname links, die Menge rechts.
   - Wenn zwei Spalten kandidaten sind: Linke Spalte → `ARTICLE_NAME`, rechte → `QUANTITY`.

4. **Confidence-Score:**
   - Jede Zuordnung bekommt einen Score (0–1).
   - Score >0.8: Automatisch übernehmen.
   - Score 0.5–0.8: User zur Bestätigung auffordern.
   - Score <0.5: Als "Unbekannt" markieren, User muss manuell zuordnen.

**Phase 3: Datenbereinigung**
- Trimmen, Normalisieren.
- Zahlen extrahieren: `"50 Stk."` → `50`, Einheit `"Stk."` separieren.
- Kombinierte Felder splitten: `"Kugelschreiber blau – 200"` → Name: `"Kugelschreiber blau"`, Menge: `200`.
  - Regex: `/(.+?)\s*[–\-]\s*(\d+)/` → Group 1 = Name, Group 2 = Menge.

**Phase 4: Fallback mit LLM (optional)**
- Wenn Confidence-Score aller Spalten <0.5:
  - Erste 5 Zeilen als JSON an LLM-API senden (z.B. GPT-4o Mini).
  - Prompt: *"Analysiere diese Tabellendaten und identifiziere welche Spalte der Artikelname und welche die Menge ist. Antworte mit JSON: { articleColumn: 'colName', quantityColumn: 'colName' }."*
  - Kosten: ~$0.001 pro Request.

### Bilder-Extraktion aus Excel

**Technischer Ablauf:**
1. `xlsx`-Bibliothek parst die `.xlsx`-Datei (die intern ein ZIP-Archiv ist).
2. `jszip` extrahiert den Ordner `xl/media/`, der alle embedded Images enthält.
3. Jede Zelle hat Metadaten über Drawing-Objekte (Position, Größe).
4. Mapping-Algorithmus:
   - Für jedes Bild: Welche Zelle(n) überlappt es?
   - Wenn Bild hauptsächlich über Zelle `(row=5, col=2)` liegt → ordne es Zeile 5 zu.
   - Speichere Bild als Base64 oder lade es in S3 hoch.
   - Verknüpfe mit Artikel-ID nach dem Import.

**Fallback für lokale Pfade:**
- Wenn Excel nur Dateinamen enthält (z.B. `"bild_kugi.jpg"`):
  - User muss Bilder in einen Ordner hochladen.
  - App matcht Dateinamen mit Image-Ref-Spalte.

### Quick-Adjust Flow (Technisch)

**Frontend:**
1. User tippt auf Artikel-Card.
2. State-Update: `selectedItem = item.id`.
3. Modal öffnet sich mit Numpad.
4. User gibt Menge ein (z.B. `50`).
5. User wählt Aktion: `Entnehmen` oder `Hinzufügen`.
6. API-Call: `POST /api/items/:id/adjust` mit Body `{ change: -50, reason: "manual" }`.
7. Optimistisches UI-Update: `item.quantity -= 50` sofort anzeigen.
8. Bei API-Fehler: Rollback + Error-Toast.

**Backend:**
```javascript
// POST /api/items/:id/adjust
async function adjustStock(req, res) {
  const { id } = req.params;
  const { change, reason } = req.body; // change = +50 oder -50

  // Transaktional: Bestand updaten + Historie schreiben
  await prisma.$transaction([
    prisma.item.update({
      where: { id },
      data: { quantity: { increment: change } }
    }),
    prisma.stockHistory.create({
      data: { itemId: id, change, reason }
    })
  ]);

  res.json({ success: true });
}
```

**Offline-Support:**
- Änderungen werden in IndexedDB gespeichert.
- Service Worker syncronisiert bei nächster Online-Verbindung.
- Konfliktauflösung: Last-Write-Wins oder User-Prompt bei großen Diskrepanzen.

---

## 5. Sicherheit & Datenschutz

- **Auth:** JWT mit 15-Minuten-Expiration, Refresh-Token mit 7 Tagen.
- **HTTPS:** Erzwingen via HSTS.
- **Datenbank-Verschlüsselung:** At-Rest Encryption (PostgreSQL TDE oder Filesystem-Level).
- **GDPR:** User können ihre Daten exportieren und löschen.
- **Backup:** Tägliche DB-Dumps, 30 Tage Retention.

---

## 6. Skalierbarkeit & Performance

- **Caching:** Redis für häufig abgerufene Artikellisten.
- **Pagination:** Artikelliste lädt 50 Items per Page (Infinite Scroll).
- **Bild-Optimierung:** Thumbnails generieren (max 200x200px) für Listenansicht.
- **CDN:** Bilder über CDN ausliefern (Cloudflare, AWS CloudFront).

---

## 7. Roadmap (Phasen)

### Phase 1 – MVP (Woche 1–4)
- Grundlegende CRUD-Operationen für Artikel.
- Excel-Import mit heuristischem Parsing (ohne LLM).
- Quick-Adjust Flow.
- Mobile-responsive UI.

### Phase 2 – Polishing (Woche 5–6)
- Bilder-Support (embedded + URLs).
- Excel-Export.
- Offline-Support (PWA).
- Barcode-Scanner (Camera-API).

### Phase 3 – Advanced (Woche 7–8)
- LLM-Integration für komplexe Parsing-Fälle.
- Multi-User Support (Teams).
- Kategorien, Tags, Filter.
- Dashboard mit Statistiken (Top-10-Artikel, Low-Stock-Warnungen).

---

**Ende des technischen Konzepts.**
