# Lagerbestands-WebApp – Präsentation

---

## 🎯 Pitch

**Stell dir vor:** Du stehst im Lager, musst 50 Kugelschreiber entnehmen, und statt durch drei Menüs zu klicken, tippst du einmal auf den Artikel, gibst "50" ein, und bist fertig. **In unter 5 Sekunden.**

Das ist die Lagerbestands-WebApp: **Excel-Import mit AI-Parsing, mobile-first Bedienung, und Bestandsanpassung so einfach wie eine SMS.**

Kein langes Einarbeiten. Keine komplizierten ERP-Systeme. Einfach nur **schnell, klar, mobil.**

---

## ❌ Das Problem

### Aktuelle Situation in vielen Betrieben:
- **Excel-Chaos:** Jeder hat seine eigene Tabelle. Spalten heißen anders. Daten sind inkonsistent.
- **Manuelle Eingabe:** Neue Artikel werden per Hand eingetippt. Fehlerhaft. Zeitaufwendig.
- **Keine Mobilität:** Excel liegt am Desktop. Im Lager muss man zurücklaufen, nachschauen, notieren, später eintragen.
- **Bestandsanpassung ist umständlich:** 5–10 Klicks, um eine Menge zu ändern. Niemand macht es gerne. Resultat: **Veraltete Daten.**
- **Bilder fehlen:** Man weiß nicht, welcher "Schraube M6" gemeint ist. Gibt es 3 Arten? Keine Ahnung.

### Die Konsequenz:
- **Zeitverschwendung:** Stunden pro Woche für Inventur und Dateneingabe.
- **Fehlerhafte Bestände:** Falsche Zahlen führen zu Fehlbestellungen oder Engpässen.
- **Frust:** Mitarbeiter hassen das System. Umgehungslösungen entstehen (Zettelwirtschaft).

---

## ✅ Die Lösung

### Eine WebApp, die sich an den Menschen anpasst – nicht umgekehrt.

#### 1. **Intelligenter Excel-Import**
- Lade deine bestehende Tabelle hoch.
- Die App **versteht** deine Struktur – egal wie die Spalten heißen.
- **AI-Parsing** erkennt automatisch: Welche Spalte ist der Artikelname? Welche die Menge?
- **Bilder** werden übernommen (wenn vorhanden).
- **Inventar ist in 2 Minuten befüllt.** Kein manueller Marathon.

#### 2. **Quick-Adjust: Bestandsänderung in 2–3 Klicks**
- Artikel antippen.
- Menge eingeben.
- Fertig.
- **Swipe-Gesten** für noch schnellere Anpassungen.
- **Offline-fähig:** Funktioniert auch ohne Internet im Keller.

#### 3. **Mobile First**
- Optimiert für Smartphones und Tablets.
- Große Buttons. Klare Typografie. Intuitive Gesten.
- **PWA:** Installierbar wie eine native App. Kein App-Store nötig.

#### 4. **Excel-Export auf Knopfdruck**
- Aktueller Bestand als saubere `.xlsx`-Datei.
- Perfekt für Buchhaltung, Berichte, oder Backup.

---

## 🚀 Feature Overview

| Feature | Beschreibung | Nutzen |
|---------|--------------|--------|
| **AI-Powered Excel-Import** | Erkennt Spalten-Semantik automatisch. Unterstützt beliebige Tabellenstrukturen. | Kein manuelles Mapping. Import in Minuten statt Stunden. |
| **Bild-Integration** | Extrahiert Bilder aus Excel oder übernimmt URLs. | Visuelle Identifikation. Weniger Verwechslungen. |
| **Quick-Adjust Flow** | Bestandsänderung in 2–3 Klicks. Swipe-Gesten. Numpad-Input. | Mitarbeiter nutzen es tatsächlich. Daten bleiben aktuell. |
| **Mobile-First UI** | Touch-optimiert. PWA. Offline-Support. | Funktioniert überall – im Lager, auf der Baustelle, im Büro. |
| **Excel-Export** | One-Click-Export des gesamten Bestands. | Einfache Weitergabe an Buchhaltung, Lieferanten, Management. |
| **Historie & Tracking** | Jede Änderung wird protokolliert. Wer hat wann was geändert? | Transparenz. Audit-fähig. Fehler rückverfolgbar. |

---

## 📱 UI Mockups (Beschreibende Wireframes)

### Screen 1: Dashboard / Artikelliste

```
┌──────────────────────────────────────┐
│  🔍 [Suchfeld: Artikel suchen...]    │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │  [Bild]                        │  │
│  │  Kugelschreiber blau           │  │
│  │  Bestand: 250 Stk.             │  │
│  │  [−]      [+]                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  [Bild]                        │  │
│  │  Schraube M6x20                │  │
│  │  Bestand: 1.200 Stk.           │  │
│  │  [−]      [+]                  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ... (scrollable Liste)              │
│                                      │
│  [+ FAB: Neuer Artikel]              │
└──────────────────────────────────────┘
```

**Interaktion:**
- Tippen auf `[−]` oder `[+]` öffnet Quick-Adjust Modal.
- Swipe links/rechts für schnelle ±1-Anpassung.
- Suchfeld filtert live.

---

### Screen 2: Quick-Adjust Modal

```
┌──────────────────────────────────────┐
│  Kugelschreiber blau                 │
│  Aktueller Bestand: 250 Stk.         │
├──────────────────────────────────────┤
│                                      │
│       ┌───┬───┬───┐                 │
│       │ 7 │ 8 │ 9 │                 │
│       ├───┼───┼───┤                 │
│       │ 4 │ 5 │ 6 │                 │
│       ├───┼───┼───┤                 │
│       │ 1 │ 2 │ 3 │                 │
│       ├───┼───┼───┤                 │
│       │   │ 0 │ ⌫ │                 │
│       └───┴───┴───┘                 │
│                                      │
│  Eingabe: [ 50 ]                     │
│                                      │
│  [ Abbrechen ]  [ Bestätigen ]       │
└──────────────────────────────────────┘
```

**Interaktion:**
- Numpad ist groß und touch-freundlich.
- "Bestätigen" schließt Modal und updated Bestand sofort.
- Success-Toast: "Bestand aktualisiert: 200 Stk."

---

### Screen 3: Excel-Import Wizard

```
┌──────────────────────────────────────┐
│  Schritt 1: Datei hochladen          │
├──────────────────────────────────────┤
│                                      │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │  📁 Datei hier ablegen         │  │
│  │  oder                          │  │
│  │  [Durchsuchen...]              │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  Unterstützte Formate: .xlsx, .xls   │
│                                      │
│            [Weiter →]                │
└──────────────────────────────────────┘
```

**Schritt 2: Sheet-Auswahl** (wenn mehrere Sheets):
```
┌──────────────────────────────────────┐
│  Schritt 2: Sheet auswählen          │
├──────────────────────────────────────┤
│  ○ Lagerbestand_2026                 │
│  ● Inventur_Mai                      │ ← Ausgewählt
│  ○ Alte_Daten                        │
│                                      │
│            [Weiter →]                │
└──────────────────────────────────────┘
```

**Schritt 3: Spalten-Zuordnung:**
```
┌──────────────────────────────────────┐
│  Schritt 3: Spalten zuordnen         │
├──────────────────────────────────────┤
│  Spalte A: "Artikelbezeichnung"      │
│  → Ist dies der Artikelname?         │
│     [Ja ✓] [Nein]                    │
│                                      │
│  Spalte B: "Menge"                   │
│  → Ist dies die Menge?               │
│     [Ja ✓] [Nein]                    │
│                                      │
│  Spalte C: "Einheit"                 │
│  → Ist dies die Einheit?             │
│     [Ja ✓] [Nein]                    │
│                                      │
│            [Weiter →]                │
└──────────────────────────────────────┘
```

**Schritt 4: Vorschau & Import:**
```
┌──────────────────────────────────────┐
│  Schritt 4: Vorschau                 │
├──────────────────────────────────────┤
│  Name                | Menge | Unit  │
│  --------------------|-------|------ │
│  Kugelschreiber blau | 250   | Stk.  │
│  Schraube M6x20      | 1200  | Stk.  │
│  Klebeband rot       | 45    | Rolle │
│  ...                 | ...   | ...   │
│                                      │
│  [← Zurück]    [Import starten 🚀]   │
└──────────────────────────────────────┘
```

---

### Screen 4: Artikel-Detailansicht

```
┌──────────────────────────────────────┐
│  ← Zurück                            │
├──────────────────────────────────────┤
│                                      │
│         [Großes Artikelbild]         │
│                                      │
│         Kugelschreiber blau          │
│                                      │
│         ┌──────────────┐             │
│         │    250       │             │
│         │    Stk.      │             │
│         └──────────────┘             │
│                                      │
│  [− Entnehmen]    [+ Hinzufügen]     │
│                                      │
│  Kategorie: Bürobedarf               │
│  Ort: Regal A3                       │
│  Letztes Update: 13.05.2026 14:30    │
│                                      │
│  Historie:                           │
│  • −50 Stk. (13.05. 14:30)           │
│  • +200 Stk. (10.05. 09:15)          │
│  • −10 Stk. (08.05. 16:45)           │
└──────────────────────────────────────┘
```

---

## 🛠️ Technische Umsetzung

### Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + Express |
| Datenbank | PostgreSQL + Prisma ORM |
| Excel-Parsing | SheetJS (`xlsx`) + JSZip |
| AI-Parsing | Heuristische Engine + Optional GPT-4o Mini API |
| Bild-Speicher | AWS S3 oder lokaler Blob-Storage |
| Deployment | Docker + VPS oder Vercel/Render |
| PWA | Service Workers + Workbox |

### Warum dieser Stack?
- **JavaScript/TypeScript durchgängig:** Ein Language-Context für Frontend und Backend. Weniger Kontext-Switching.
- **PostgreSQL:** Robust, ACID-konform, bewährt für relationale Daten.
- **Prisma ORM:** Typsichere Queries. Auto-generated Types. Weniger Boilerplate.
- **SheetJS:** De-facto Standard für Excel-Parsing in JavaScript. Unterstützt embedded Images.
- **Tailwind CSS:** Schnelles Styling. Mobile-first Utilities. Konsistentes Design.
- **PWA:** Keine App-Store-Abhängigkeit. Offline-Support. Push-Notifications möglich.

### Architektur-Überblick

```
┌──────────────┐       HTTPS       ┌─────────────────┐
│   Browser    │ ◄──────────────►  │   Backend       │
│   (React)    │   JSON/API        │   (Node.js)     │
└──────────────┘                   └────────┬────────┘
                                           │
                                    ┌──────▼────────┐
                                    │  PostgreSQL   │
                                    │  (Datenbank)  │
                                    └───────────────┘
                                           │
                                    ┌──────▼────────┐
                                    │  AWS S3       │
                                    │  (Bilder)     │
                                    └───────────────┘
```

### Sicherheitsmaßnahmen
- **JWT-Auth:** Stateless, skalierbar.
- **HTTPS:** Erzwungen via HSTS.
- **Input-Validierung:** Alle API-Inputs werden validiert und gesanitisiert.
- **Rate Limiting:** Schutz vor Brute-Force und DDoS.
- **Backup:** Tägliche DB-Dumps. 30 Tage Retention.

---

## 📅 Next Steps / Roadmap

### Phase 1 – MVP (Woche 1–4)
**Ziel:** Kernfunktionalität steht. Erste User können die App testen.

- [ ] Grundgerüst: React Frontend + Node.js Backend + PostgreSQL
- [ ] CRUD-Operationen für Artikel (Anlegen, Lesen, Updaten, Löschen)
- [ ] Excel-Import mit heuristischem Parsing (ohne LLM)
- [ ] Quick-Adjust Flow (Modal + Numpad)
- [ ] Mobile-responsive UI (Tailwind CSS)
- [ ] Deployment auf Test-Server

**Meilenstein:** Erste Beta-Version mit 5–10 Testusern.

---

### Phase 2 – Polishing (Woche 5–6)
**Ziel:** UX ist rund. Bilder-Support. Offline-Fähigkeit.

- [ ] Bilder-Integration (embedded + URLs)
- [ ] Excel-Export (One-Click)
- [ ] PWA: Service Workers, Offline-Support, Install-Prompt
- [ ] Barcode-Scanner (Camera-API)
- [ ] Error-Handling verbessern (Toasts, Retry-Logik)
- [ ] Usability-Tests mit echten Nutzern

**Meilenstein:** Produktionsreife Version. Launch für erste Kunden.

---

### Phase 3 – Advanced (Woche 7–8)
**Ziel:** Features für Power-User. Skalierbarkeit.

- [ ] LLM-Integration für komplexe Parsing-Fälle (GPT-4o Mini API)
- [ ] Multi-User Support (Teams, Rollen: Admin, User)
- [ ] Kategorien, Tags, Filter
- [ ] Dashboard mit Statistiken (Top-10-Artikel, Low-Stock-Warnungen)
- [ ] Push-Notifications (Browser + Mobile)
- [ ] API-Dokumentation (Swagger/OpenAPI)

**Meilenstein:** Vollständige Produktversion. Marketing-Launch.

---

### Phase 4 – Scale (Woche 9+)
**Ziel:** Wachstum. Enterprise-Features.

- [ ] White-Label-Lösung (Custom Branding für Unternehmen)
- [ ] Integrationen (Shopify, WooCommerce, DATEV)
- [ ] Advanced Analytics (Bestands-Trends, Prognosen)
- [ ] Mobile Apps (iOS/Android native, falls PWA nicht reicht)
- [ ] Support-Portal (Tickets, Knowledge Base)

---

## 💰 Business-Modell (Optional)

### Freemium:
- **Free:** Bis zu 100 Artikel. 1 User. Excel-Import/Export.
- **Pro (€19/Monat):** Unbegrenzte Artikel. Bis zu 5 User. Bilder-Support. Prioritäts-Support.
- **Enterprise (auf Anfrage):** Unbegrenzte User. Custom Integrations. SLA. Dedicated Server.

### Zielmarkt:
- Kleine bis mittlere Unternehmen in DACH.
- Handwerksbetriebe, Büros, Einzelhandel, Werkstätten.
- Geschätzt **500.000+ potentielle Kunden** in Deutschland allein.

---

## 🎬 Fazit

Die Lagerbestands-WebApp löst ein echtes Problem: **Umständliche, zeitaufwendige Bestandsführung.**

Mit **AI-gestütztem Excel-Import**, **mobile-first Design** und einem **Quick-Adjust Flow in 2–3 Klicks** ist sie schneller und einfacher als jede bestehende Lösung.

**Next Step:** MVP entwickeln. Mit 5–10 Testusern validieren. Iterieren. Launchen.

**Let's build it.** 🚀

---

**Ende der Präsentation.**
