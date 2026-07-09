# 🦞 EntertainBernd JS UI – Telegram Mini App Konzept

_Stand: 2026-07-09_

---

## 1. Vision

**Aktuell:** Text-Chat-Bot mit Inline-Keyboards. Funktioniert, aber fühlt sich an wie ein Terminal mit extra steps.

**Ziel:** Eine vollwertige **Telegram Mini App** – React SPA, die sich anfühlt wie eine native App. Suchst du gerade "Dune 2026" und willst 3 Ergebnisse gleichzeitig downloaden? Ein Fingertipp. Queue checken? Swipe. Upload-Status live sehen? Realtime.

**Kein Chat mehr. App inside Telegram.**

---

## 2. Architektur

```
┌──────────────────────────────────────────────────┐
│                  Telegram Client                  │
│  [EntertainBernd Mini App – WebView/Fullscreen]  │
│  ↑ https://entertainbernd.steppa.online           │
└──────────────────────┬───────────────────────────┘
                       │ HTTPS (Caddy + Cloudflare)
┌──────────────────────▼───────────────────────────┐
│              Caddy (Reverse Proxy)                │
│  entertainbernd.steppa.online → localhost:3010    │
│  Auto TLS via Cloudflare (Flexible/Full)          │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────┐
│        Mini App Backend (Express/Node.js)         │
│        localhost:3010                             │
│                                                   │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────┐  │
│  │ Auth/Init   │ │ API Router   │ │ WebSocket │  │
│  │ Validation  │ │ /api/search  │ │ /ws/queue │  │
│  │ (HMAC-SHA256)│ │ /api/download│ │ /ws/progress│ │
│  └─────────────┘ │ /api/queue   │ └───────────┘  │
│                  │ /api/history  │                 │
│                  │ /api/watchlist│                 │
│                  └──────┬───────┘                 │
└─────────────────────────┼─────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
┌─────────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
│   NZBHydra2    │ │  NZBGeek   │ │    SABnzbd      │
│  localhost:5076 │ │ api.nzbgeek │ │  localhost:8080 │
└────────────────┘ └────────────┘ └─────────────────┘
                                           │
                                   ┌───────▼───────┐
                                   │  Google Drive  │
                                   │ (Composio MCP)│
                                   └───────────────┘
```

### 2.1 Warum separates Backend?

Der aktuelle Bot (`bot.py`) läuft als PTB-Polling-Prozess. Der kann nicht gleichzeitig HTTP-Requests bedienen. Statt den umzubauen:

| Komponente | Aufgabe | Port |
|------------|---------|------|
| **Mini App Frontend** (React SPA) | UI, Telegram SDK, Routing | Cloudflare → Caddy |
| **Mini App Backend** (Express) | API + WebSocket, Init-Validation | 3010 |
| **Bot Service** (PTB) | Push-Nachrichten, Background-Poll, bleibt wie gehabt | Polling |
| **Bot Backend API** | Neue Endpoints für Bot-Commands (/queue, /filter) | 3010 shared |

**Der Bot bleibt parallel aktiv** – für alte User, die chat-basiert weitermachen wollen, und für Push-Benachrichtigungen ("Download fertig!").

---

## 3. Tech Stack

### Frontend (Served via Caddy)
| Technologie | Zweck |
|-------------|--------|
| **React 19** + TypeScript | Framework |
| **Vite** | Build + Dev Server |
| **@telegram-apps/sdk-react** ^3.x | Telegram Mini App SDK (Hooks, Init, Theme, Haptic, etc.) |
| **@telegram-apps/init-data** | Server-seitige Init-Data Validierung |
| **TailwindCSS** | Styling (wie immer, siehe TOOLS.md) |
| **Framer Motion** | Animationen (Smooth Transitions) |
| **TanStack Query** | Server State (Caching, Refetch, Optimistic Updates) |
| **React Router** | Client-seitiges Routing |
| **Lucide Icons** | Icons |
| **socket.io-client** | Echtzeit-Updates (Queue, Download-Progress) |

### Backend (Node.js, Express)
| Technologie | Zweck |
|-------------|--------|
| **Express** | HTTP Server |
| **socket.io** | WebSocket für Live-Updates |
| **jsonwebtoken** | Session-Tokens (optional, Telegram Init-Data reicht meist) |
| **node-fetch / axios** | Requests zu NZBHydra2, NZBGeek, SABnzbd |
| **@telegram-apps/init-data** | Init-Data HMAC Validation |

### Domain
`entertainbernd.steppa.online` → CNAME/A-Record auf VPS → Caddy reverse proxy

---

## 4. Screens & Navigation

### 4.1 Tab-Navigation (Bottom Tabs, Telegram BottomButton)

```
┌─────────────────────────────┐
│        🔍 Search            │ ← Default Tab
├─────────────────────────────┤
│ [Suchfeld]                  │
│                             │
│ [🎬 Film/Serie] [🌐 Alle]   │ ← Quick-Toggles
│                             │
│ ┌──────────────────────┐    │
│ │ Dune: Part Three     │    │ ← Result Cards
│ │ 🎬 8.2 GB · 🇩🇪 DE   │    │
│ │ ⭐ 4.7/5 · 2026      │    │
│ │ [⬇️  ❤️]              │    │
│ └──────────────────────┘    │
│ ┌──────────────────────┐    │
│ │ Dune: Prophecy S01E01│    │
│ │ 📺 1.2 GB · 🇬🇧 EN   │    │
│ │ [⬇️  ❤️]              │    │
│ └──────────────────────┘    │
│                             │
│ [Load More...]              │ ← Infinite Scroll
│                             │
├─────────────────────────────┤
│ [🔍]  [📋 Queue]  [❤️ Watch]│  ← Bottom Tab Bar
└─────────────────────────────┘
```

### 4.2 Screen Map

| Screen | Route | Beschreibung |
|--------|-------|-------------|
| **Search** | `/` | Suche + Result Cards + Quick-Filter |
| **Detail** | `/detail/:id` | Release-Detail mit Download, Info, Poster |
| **Queue** | `/queue` | Live-Queue von SABnzbd (WebSocket) |
| **History** | `/history` | Abgeschlossene Downloads + Drive-Links |
| **Watchlist** | `/watchlist` | Gemerkte Releases + Benachrichtigungen |
| **Settings** | `/settings` | Config (Media-Type, Language, Source, Drive-Ordner) |

---

## 5. Screen-Details

### 5.1 🔍 Search Screen

**Default Screen beim Öffnen.** Volle Breite, Telegram-native Look.

```
┌──────────────────────────────┐
│🔍 enter entertain...         │ ← Search Input (auto-focus)
├──────────────────────────────┤
│ 🎬 Film  📺 Serie  🎵 Audio │ ← Media Type Pills
│ 📚 Bücher  🎮 Games  📦 All │
├──────────────────────────────┤
│ 🌐 All Languages  ▼          │ ← Collapsible Filter Bar
│ 🔀 Both Sources    ▼         │
├──────────────────────────────┤
│ 🔍 42 results for "dune"     │ ← Search Header
│                            ↓ │ ← Infinite Scroll
│ ┌─────────────┬──────────┐   │
│ │ Poster     │ Dune: PT3 │   │ ← 2-Column Card Grid
│ │            │ 2026      │   │
│ │            │ 🎬 8.2GB  │   │
│ │            │ 🌐 Geek   │   │
│ │            │ [⬇️] [❤️] │   │
│ └─────────────┴──────────┘   │
│ ┌─────────────┬──────────┐   │
│ │ Poster     │ Dune: Pro │   │
│ │            │ S01E01     │   │
│ │            │ 📺 1.2GB   │   │
│ │            │ 🌐 Geek    │   │
│ │            │ [⬇️] [❤️] │   │
│ └─────────────┴──────────┘   │
│                          ↓   │
├──────────────────────────────┤
│ [🔍]  [📋 2]  [❤️ 5]  [⚙️] │ ← Bottom Tabs + Badges
└──────────────────────────────┘
```

**Besonderheiten:**
- **2-Column Card Grid** – Keine Liste, echte Cards mit Poster-Thumbnails
- **Infinite Scroll** – Keine Pagination-Buttons, scrollt endlos (lazy load)
- **Quick-Download** – Direkter Button auf der Card (ohne Detail-View)
- **Quick-❤️** – Merken ohne Detail-View
- **Search-As-You-Type** – Debounced (300ms) API-Suche
- **Filter Bar** – Collapsible, zeigt aktive Filter als Pills
- **Pulled to Refresh** – Pull-down für neue Suche
- **Bottom Tab Badges** – Queue-Count, Watchlist-Count live

### 5.2 📄 Detail Screen

```
┌──────────────────────────────┐
│ ← Back                       │
├──────────────────────────────┤
│ ┌────────────────────────┐   │
│ │                        │   │ ← Large Poster/Art
│ │    [Poster Placeholder]│   │
│ │                        │   │
│ └────────────────────────┘   │
│                              │
│ Dune: Part Three             │  ← Title (H1)
│ The Spice Must Flow...       │  ← Tagline/Description
│                              │
│ 🎬 Film · 2026 · 🇩🇪🇬🇧      │ ← Meta Row
│ 📦 8.2 GB · 🌐 NZBGeek      │
│ ⭐ 4.7/5 (234 ratings)       │
│                              │
│ ┌────────────────────────┐   │
│ │ 📥 Download            │   │ ← Primary CTA (BottomButton)
│ └────────────────────────┘   │
│                              │
│ Details:                     │
│ • Category: Movies/HD        │
│ • Format: 2160p (4K)        │
│ • Audio: DTS-HD MA 5.1     │
│ • Source: BLURAY             │
│                              │
│ [❤️ To Watchlist] [📋 Queue] │ ← Secondary Actions
└──────────────────────────────┘
```

**Besonderheiten:**
- **Large Poster** mit Fallback-Gradient wenn kein Artwork
- **Telegram BottomButton** als "Download" CTA (native feel)
- **Poster = Full-width oben**, darunter Details
- **Haptic Feedback** bei Download-Start (Telegram.WebApp.HapticFeedback)

### 5.3 📋 Queue Screen

```
┌──────────────────────────────┐
│ 📋 Queue  (2 active)         │
├──────────────────────────────┤
│ ┌────────────────────────┐   │
│ │ Dune: Part Three       │   │ ← Active Download
│ │ ████████████░░░░ 67%   │   │ ← Progress Bar (live)
│ │ ⬇️ 5.5/8.2 GB · 12min │   │
│ │ [✕ Cancel]             │   │
│ └────────────────────────┘   │
│                              │
│ ┌────────────────────────┐   │
│ │ Dune: Prophecy S01     │   │ ← Paused
│ │ ⏸️ Paused              │   │
│ │ 📦 4.2 GB              │   │
│ │ [▶ Resume] [✕ Cancel]  │   │
│ └────────────────────────┘   │
│                              │
│ 📊 Total: 12.4 GB · 45min   │ ← Statsbar
├──────────────────────────────┤
│ [🔍]  [📋 2]  [❤️ 5]  [⚙️] │
└──────────────────────────────┘
```

**Besonderheiten:**
- **Live Progress via WebSocket** – Fortschritt in Echtzeit
- **Pause / Resume / Cancel** – Direkt steuerbar
- **Speed + ETA** – Geschwindigkeit und verbleibende Zeit
- **Post-Processing Status** – "Repairing...", "Unpacking...", "Uploading..."

### 5.4 ⚙️ Settings Screen

```
┌──────────────────────────────┐
│ ⚙️ Settings                  │
├──────────────────────────────┤
│                              │
│ Medientyp (Default)          │
│ [🎬 Film] [📺 Serie] [🎵 ...] │ ← Pills
│                              │
│ Sprache (Default)            │
│ [🇩🇪 DE] [🇬🇧 EN] [🌐 All]   │
│                              │
│ Quelle (Default)             │
│ [🌐 Geek] [🔧 Hydra] [🔀 All]│
│                              │
│ Drive Ordner                 │
│ [📁 usedown]  (Bastian)      │ ← User-spezifisch
│                              │
│ Benachrichtigungen           │
│ [✅] Download fertig         │ ← Toggles
│ [✅] Queue leer              │
│ [  ] Neue Releases ❤️        │
│                              │
│ Telegram Theme               │
│ 🌙 Dark (automatisch)        │ ← Telegram.WebApp.themeParams
│                              │
├──────────────────────────────┤
│ 🤖 EntertainBernd v2.0       │
│ Powered by Usenet + Google   │
└──────────────────────────────┘
```

---

## 6. Telegram SDK Integration

### 6.1 Initialisierung

```typescript
// src/main.tsx
import { init, retrieveLaunchParams } from '@telegram-apps/sdk-react';

init();

const { initData, startParam } = retrieveLaunchParams();

// initData = User-Auth mit HMAC-Signatur
// startParam = Deep-Link Parameter (z.B. "search_dune")
```

### 6.2 Genutzte Features

| Feature | Nutzung |
|---------|---------|
| **Telegram.WebApp.initData** | User-Authentifizierung (wird an Backend gesendet & validiert) |
| **ThemeParams** | Dynamisches Theme (Dark/Light + Accent Color) |
| **BottomButton** | "Download" CTA (zeigt mainButton, setText, onClick) |
| **BackButton** | Zurück-Navigation |
| **HapticFeedback** | Vibration bei Downloads, Erfolg/Fehler |
| **CloudStorage** | Settings persistieren (device-local, kein Server nötig) |
| **SafeAreaInset** | Notch/Safe-Area respektieren |
| **Fullscreen** | `requestFullscreen()` für immersive Search-Ansicht |
| **shareMessage** | Release teilen in anderen Chats |
| **showPopup** | Custom Confirmations ("Download starten?") |
| **showAlert** | Fehler-Meldungen |

### 6.3 Theme Integration

```typescript
// Telegram liefert themeParams – wir nutzen die direkt in Tailwind
const { themeParams } = retrieveLaunchParams();

// themeParams.bg_color → Hintergrund
// themeParams.button_color → Primary Buttons
// themeParams.text_color → Textfarbe
// themeParams.accent_text_color → Highlights
```

Tailwind-Config mit CSS-Variablen von Telegram:

```css
:root {
  --tg-bg-color: var(--tg-theme-bg-color, #fff);
  --tg-text-color: var(--tg-theme-text-color, #000);
  --tg-button-color: var(--tg-theme-button-color, #40a7e3);
  --tg-accent-color: var(--tg-theme-accent-text-color, #168acd);
}
```

---

## 7. API Design

### 7.1 Backend Endpoints

| Methode | Pfad | Beschreibung |
|---------|------|-------------|
| `POST` | `/api/auth` | Init-Data validieren → Session-Token |
| `GET` | `/api/search?q=&cat=&page=` | Suche mit Pagination |
| `GET` | `/api/detail/:id` | Release-Details |
| `POST` | `/api/download` | NZB an SABnzbd senden |
| `GET` | `/api/queue` | SABnzbd Queue-Status |
| `POST` | `/api/queue/:id/pause` | Download pausieren |
| `POST` | `/api/queue/:id/resume` | Download fortsetzen |
| `POST` | `/api/queue/:id/cancel` | Download abbrechen |
| `GET` | `/api/history` | Abgeschlossene Downloads |
| `GET` | `/api/watchlist` | Watchlist-Einträge |
| `POST` | `/api/watchlist` | Release zur Watchlist hinzufügen |
| `DELETE` | `/api/watchlist/:id` | Aus Watchlist entfernen |
| `WS` | `/ws` | Live-Updates (Queue, Progress, Download-Completed) |

### 7.2 Auth-Flow

```
1. Mini App öffnet → Telegram.WebApp.initData ist da
2. Frontend sendet initData an POST /api/auth
3. Backend validiert HMAC-SHA256 (Bot-Token als Secret)
4. Backend gibt Session-Token (JWT, 24h gültig) zurück
5. Alle weiteren Requests nutzen JWT
```

### 7.3 Search API Response

```json
GET /api/search?q=dune&cat=2000,5000&page=0&limit=20

{
  "query": "dune",
  "total": 42,
  "page": 0,
  "results": [
    {
      "id": "nzb_123",
      "title": "Dune: Part Three 2026 2160p 4K BLURAY",
      "category": "2000",
      "media_type": "movie",
      "size": 8800000000,
      "size_formatted": "8.2 GB",
      "language": "de",
      "source": "Geek",
      "pub_date": "2026-07-08",
      "poster_url": null,
      "rating": 4.7,
      "grabs": 234
    }
  ]
}
```

---

## 8. Deployment & Hosting

### 8.1 Subdomain

```
entertainbernd.steppa.online → A-Record 185.217.126.72
```

### 8.2 Caddy Config

```caddy
entertainbernd.steppa.online {
    # Cloudflare macht TLS – nur Port 80 lokal nötig
    handle /* {
        root * /var/www/apps/entertainbernd/dist
        try_files {path} /index.html
        file_server
    }

    reverse_proxy /api* localhost:3010
    reverse_proxy /ws* localhost:3010
}
```

**Caddy läuft bereits mit Cloudflare.** Der DNS-Record muss nur angelegt werden:

```bash
./scripts/cloudflare-dns.sh add A entertainbernd 185.217.126.72
```

### 8.3 Frontend Build

```bash
cd projects/entertainbernd/jsui
npm ci
npm run build
# Output: /var/www/apps/entertainbernd/dist/
```

### 8.4 Backend Service

```bash
# systemd unit: entertainbernd-api.service
/usr/bin/node /root/.local/.openclaw/workspace/projects/entertainbernd/jsui/server/index.js
# Port: 3010
# Restart: always
```

---

## 9. Bot-Integration (Hybrid-Mode)

Der **PTB-Bot bleibt aktiv** für:
1. **Push-Benachrichtigungen** ("Download fertig!" + Link)
2. **Queue Status** per `/queue` Command (für Leute die Chat bevorzugen)
3. **Legacy Support** (alte User)

Mini App → Bot-Kommunikation:
- Download starten → Bot sendet Bestätigung + Drive-Link bei Fertigstellung
- Queue-Änderungen → Bot push-update via Telegram API

**Mini App Backend ruft Bot API auf:**
```python
# Bot.py hat schon send_message
# Mini App Backend ruft POST /api/bot/notify auf
# Der leitet an PTB weiter
```

---

## 10. Phase 1 MVP (Minimum Viable)

### Was kommt rein?

| Feature | Frontend | Backend | Bot |
|---------|----------|---------|-----|
| Init-Data Auth | ✅ | ✅ | - |
| Suche mit Filter | ✅ | ✅ (existing) | - |
| Ergebnis-Cards | ✅ | - | - |
| Detail-View | ✅ | ✅ (detail endpoint) | - |
| Download (Einzel) | ✅ | ✅ (existing) | Notify |
| Queue-View | ✅ | ✅ (existing) | - |
| Theme (Dark/Light) | ✅ | - | - |
| Haptic Feedback | ✅ | - | - |
| Infinite Scroll | ✅ | - | - |

### Was kommt später?

| Feature | Grund |
|---------|-------|
| Watchlist | Neue DB-Tabelle nötig |
| Queue Pause/Resume | SABnzbd API-Erweiterung |
| Live-Progress WS | Zusätzlicher Polling-Layer |
| Multi-Select Batch DL | UX-Komplexität |
| Poster/Artwork | Metadata-Provider nötig |
| Telegram Stars | Monetarisierung (später) |

---

## 11. UI/UX Polishing (TOOLS.md Standards)

Gemäß unserer UI-Standards:

- [ ] **Glassmorphism** Cards für Ergebnisse
- [ ] **Smooth Transitions** (Framer Motion) – Page-Übergänge, Card-Animationen
- [ ] **Loading States** – Skeleton-Screens während Search lädt
- [ ] **Error States** – Toast-Notifications bei API-Fehlern
- [ ] **Empty States** – "Keine Ergebnisse" Illustration
- [ ] **Pulled to Refresh** – Search neu laden
- [ ] **Dark Mode** – Telegram Theme automatisch
- [ ] **Responsive** – Mobile-First (läuft ja eh nur in Telegram)
- [ ] **Haptic Feedback** – Button-Taps, Download-Start, Success/Error
- [ ] **Safe Area** – Notch/Home-Indicator respektieren

---

## 12. Projektstruktur

```
projects/entertainbernd/jsui/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── index.html
├── src/
│   ├── main.tsx                    # Entry + Telegram.init()
│   ├── App.tsx                     # Router + Layout
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BottomTabs.tsx      # Tab-Navigation
│   │   │   ├── Header.tsx          # Telegram-kompatibler Header
│   │   │   └── SafeArea.tsx        # Safe-Area Wrapper
│   │   ├── search/
│   │   │   ├── SearchInput.tsx     # Debounced Search
│   │   │   ├── FilterBar.tsx       # Collapsible Filter
│   │   │   ├── ResultCard.tsx      # Search Result Card
│   │   │   └── ResultGrid.tsx      # 2-Column Grid
│   │   ├── detail/
│   │   │   ├── Poster.tsx          # Large Poster
│   │   │   ├── MetaInfo.tsx        # Release-Meta
│   │   │   └── DownloadButton.tsx  # Telegram BottomButton
│   │   ├── queue/
│   │   │   ├── QueueItem.tsx       # Download-Eintrag
│   │   │   ├── ProgressBar.tsx     # Live Progress
│   │   │   └── QueueStats.tsx      # Total Stats
│   │   └── shared/
│   │       ├── BottomButton.tsx    # Telegram BottomButton Wrapper
│   │       ├── BackButton.tsx      # Telegram BackButton
│   │       └── Toast.tsx           # Notifications
│   ├── hooks/
│   │   ├── useTelegram.ts          # Telegram SDK Hook
│   │   ├── useSearch.ts            # TanStack Query Search
│   │   ├── useQueue.ts             # WebSocket Queue
│   │   └── useTheme.ts             # Telegram Theme
│   ├── api/
│   │   ├── client.ts               # Axios/Fetch Client
│   │   ├── search.ts               # Search API
│   │   ├── download.ts             # Download API
│   │   └── queue.ts                # Queue API
│   ├── pages/
│   │   ├── SearchPage.tsx
│   │   ├── DetailPage.tsx
│   │   ├── QueuePage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── WatchlistPage.tsx
│   │   └── SettingsPage.tsx
│   └── types/
│       └── index.ts                # TypeScript Types
├── server/
│   ├── index.ts                    # Express Server
│   ├── auth.ts                     # Init-Data Validation
│   ├── routes/
│   │   ├── search.ts               # Search RPC
│   │   ├── download.ts             # Download RPC
│   │   ├── queue.ts                # Queue RPC
│   │   └── watchlist.ts            # Watchlist RPC
│   └── ws/
│       └── queue.ts                # WebSocket Handler
├── .env.example
└── entertainbernd-api.service      # systemd Unit
```

---

## 13. Setup-Schritte (To-Do)

### Phase 1 – Infrastruktur
- [ ] DNS: `entertainbernd.steppa.online → 185.217.126.72` (A-Record)
- [ ] Caddy: Config-Eintrag für Subdomain
- [ ] Projekt-Ordner: `projects/entertainbernd/jsui/`
- [ ] npm init + Dependencies installieren

### Phase 2 – Backend
- [ ] Express Server auf Port 3010
- [ ] Init-Data Validation (HMAC-SHA256)
- [ ] Search-API (Wrapper um bot.py search_all)
- [ ] Download-API (Wrapper um bot.py add_nzb)
- [ ] Queue-API (Wrapper um SABnzbd API)

### Phase 3 – Frontend
- [ ] Telegram.init() + Theme Binding
- [ ] Search Page (Input + Result Cards)
- [ ] Filter Bar + Quick-Toggles
- [ ] Detail Page (Poster + Meta + Download)
- [ ] Queue Page (Live Progress)
- [ ] Settings Page (Config + Telegram Theme)

### Phase 4 – BotFather Setup
- [ ] `/mybots` → @entertainbernd_bot → Bot Settings → Configure Mini App
- [ ] URL: `https://entertainbernd.steppa.online`
- [ ] Bot-Menü anpassen: "Open EntertainBernd" als Menu Button

---

## 14. BotFather Mini App Setup

Nachdem das Frontend deployed ist:

```
BotFather → /mybots → @entertainbernd_bot

Bot Settings → Configure Mini App → Enable Mini App
  → URL: https://entertainbernd.steppa.online
  → Loading screen icon hochladen
  → Light/Dark theme Farben anpassen

Bot Settings → Menu Button → Set
  → Text: "🦞 EntertainBernd öffnen"
  → URL: https://t.me/entertainbernd_bot/app
```

Danach:
- **Menu Button** im Chat → öffnet Mini App
- **t.me-Link:** `https://t.me/entertainbernd_bot/app`
- **Main Mini App** (optional): Profil-Banner + Launch Button

---

## 15. Warum das geil ist

**Vorher:** "schick mir Star Wars" → 42 Treffer auf 5 Seiten verteilt → Nummer eintippen → warten ob's klappt.

**Nachher:** App auf → "Star Wars" → Cards mit Postern → 2 Klicks → Download läuft. Siehst live wie's downloadet. Kriegst 'n Ping wenn's auf Drive liegt. Und das alles smooth, native feel, mit Telegram Dark Theme angepasst.

Der Bot bleibt parallel – aber die App ist der Haupt-Weg. Kein Chat-Gewurschtel mehr. Reine UI. So wie's sein soll.

---

*Dieses Dokument ist ein Konzept. Die konkrete Implementierung findet in jsui/ statt, sobald Phase 1 grünes Licht bekommt.*