
# Konzept: Smart Share & Collab – Kollaborative Planung

**Status:** Implementation Complete (Phases 1-4) ✅
**Ziel:** 
1. Generierung von teilbaren, schreibgeschützten Links (Views).
2. Ermöglichung von **Task-Anfragen** durch externe Viewer, die nahtlos in den Workflow des Planers integriert werden.

---

## 1. Vision: "The War Room Display & Dropbox"

Wir erweitern das Konzept von reiner Transparenz ("Hier ist der Plan") zu einer kontrollierten Interaktion ("Was fehlt noch?"). 
Nutzer erhalten nicht nur Einblick, sondern einen **strukturierten Kanal**, um Wünsche zu äußern, ohne den Kalender direkt zu manipulieren.

### Szenarien
1.  **Der Kunden-Link:** Der Kunde sieht den Plan und klickt auf "Anfrage stellen", um z.B. "Logo Feedback Meeting" anzufragen.
2.  **Der Team-Link:** Mitarbeiter sehen ihre Schichten und können "Urlaubswunsch" oder "Materialbeschaffung" einreichen.

---

## 2. User Experience (UX)

### 2.1. Der Creator (Admin) – Outbound
*Wie bisher:* "Share View" Button -> Konfiguration -> Link generieren.

### 2.2. Der Viewer (Gast) – Interaction
Auf der `SharedViewApp` (Read-Only Seite) gibt es unten rechts einen **Floating Action Button (FAB)** oder einen Button im Header: **"✨ Anfrage stellen"**.

*   **Aktion:** Klick öffnet ein simples Modal.
*   **Input:**
    *   *Was soll getan werden?* (Textarea, analog zum Magic Input Prompt).
    *   *Dringlichkeit?* (Optional: Normal / Hoch).
    *   *Von wem?* (Namensfeld, falls Gast nicht eingeloggt).
*   **Feedback:** Nach dem Absenden erscheint "Anfrage an [Admin Name] gesendet".

### 2.3. Der Creator (Admin) – Inbound & Workflow
Im Haupt-Dashboard (Top Bar) erscheint ein neues Icon: **Inbox / Anfragen** 📥.

1.  **Notification:** Ein roter Punkt ("Badge") am Icon signalisiert neue, ungelesene Anfragen.
2.  **Die Inbox-Liste:**
    *   Klick auf das Icon öffnet ein Dropdown/Modal mit der Liste der eingegangenen Requests.
    *   Jeder Eintrag zeigt: Text-Snippet, Absender, Zeitstempel.
3.  **Der "Magic Transfer" (Kern-Feature):**
    *   Jeder Eintrag hat einen Button **"In Planer übernehmen"** (Pfeil-Icon).
    *   **Verhalten:**
        1.  Das Modal schließt sich.
        2.  Der Text der Anfrage wird **in das `MagicInput` Textfeld kopiert**.
        3.  **WICHTIG:** Es wird **NICHT** automatisch abgesendet.
    *   **Vorteil:** Der Admin kann den Text redigieren, Dateien anhängen (z.B. Briefing-PDFs, die er per Mail bekommen hat) oder Kontext hinzufügen ("...aber erst nächste Woche"), bevor er die KI aktiviert.
    *   **Status:** Die Anfrage in der Inbox wird automatisch als "Verarbeitet" markiert oder archiviert.

---

## 3. Technische Architektur

### 3.1. Datenbank-Schema

**Collection: `shared_views`**
```typescript
interface SharedView {
  id: string;
  creatorId: string;      // Admin ID
  config: {
    projectId?: string;   // Optional: Nur ein Projekt teilen
    allowRequests: boolean; // Dürfen Gäste Anfragen stellen?
    showDetails: boolean; // Sollen sensible Details (Rationale etc.) gezeigt werden?
    expiresAt?: string;   // Optional: Ablaufdatum
  };
  createdAt: string;
}
```

**Collection: `inbound_requests`**
```typescript
interface InboundRequest {
  id: string;
  shareViewId: string;    // Über welchen Link kam die Anfrage?
  creatorId: string;      // Wem gehört diese Anfrage (Admin ID)?
  guestName: string;      // "Kunde XY"
  requestText: string;    // Der Prompt
  priority: 'normal' | 'high';
  createdAt: string;      // ISO Date
  status: 'pending' | 'processed' | 'dismissed';
}
```

### 3.2. Security
*   **Write-Access für Gäste:** Die Collection `inbound_requests` muss `create`-Rechte für jeden haben (public), ABER nur wenn eine gültige `shareViewId` mitgesendet wird.
*   **Read-Access für Admins:** Nur der `creatorId` darf seine Requests lesen.

---

## 4. Umsetzungsfahrplan (Roadmap)

### Phase 1: Die Share-Infrastruktur (Outbound) ✅ COMPLETED
*   [x] Types: `SharedView`, `InboundRequest` definiert.
*   [x] Service: `shareService.ts` implementiert (Firestore Integration).
*   [x] UI: `ShareModal.tsx` erstellt (Konfiguration & Link Generierung).
*   [x] Integration: Button im Main Header (`App.tsx`).

### Phase 2: Die Viewer App (Die Webseite für den Gast) ✅ COMPLETED
*   [x] Routing Setup (`?shareId=...` in `App.tsx`).
*   [x] Component `SharedViewApp.tsx` erstellt.
*   [x] Read-Only Modus für `HeatmapCalendar.tsx` implementiert.
*   [x] Daten-Loading & Filterung (Backend-Simulation im Frontend).

### Phase 3: Das Request System (Guest Side) ✅ COMPLETED
*   [x] Komponente `TaskRequestModal.tsx` für die Viewer-Seite.
*   [x] Service-Funktion `submitInboundRequest` implementiert.
*   [x] Integration in `SharedViewApp`.

### Phase 4: Die Inbox & Magic Transfer (Admin Side) ✅ COMPLETED
*   [x] **Top Bar Erweiterung:** Hinzufügen des `InboxIcon` mit Realtime-Listener auf `inbound_requests`.
*   [x] **Inbox Modal:** Liste der Anfragen für den Creator.
*   [x] **Workflow Logic:** `MagicInput` Befüllung ("Takeover") implementiert.
*   [x] **Optimierung:** Client-Side Sorting implementiert, um Firestore Index Fehler zu vermeiden.
