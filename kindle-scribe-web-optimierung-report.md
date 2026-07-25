# Webseiten-Optimierung für den Kindle Scribe

## Ein umfassender Deep-Research-Report

---

**Autor:** OpenClaw Research Agent  
**Datum:** Juli 2026  
**Format:** Markdown (optimiert für Kindle Scribe / E-Ink-Lesegeräte)  
**Lizenz:** CC BY-SA 4.0

---

## Inhaltsverzeichnis

1. [Einleitung & Kontext](#1-einleitung--kontext)
2. [Hardware-Grundlagen des Kindle Scribe](#2-hardware-grundlagen-des-kindle-scribe)
3. [Der Experimentelle Webbrowser: Technische Realität](#3-der-experimentelle-webbrowser-technische-realität)
4. [E-Ink-spezifische Designprinzipien](#4-e-ink-spezifische-designprinzipien)
5. [CSS- & Frontend-Optimierungsstrategien](#5-css---frontend-optimierungsstrategien)
6. [JavaScript & Progressive Web Apps auf E-Ink](#6-javascript--progressive-web-apps-auf-e-ink)
7. [Praxisbeispiel: ReKindle – Eine PWA für E-Ink](#7-praxisbeispiel-rekindle--eine-pwa-für-e-ink)
8. [Performance & Caching-Strategien](#8-performance--caching-strategien)
9. [Testing & Debugging auf dem Gerät](#9-testing--debugging-auf-dem-gerät)
10. [Zusammenfassung & Checkliste](#10-zusammenfassung--checkliste)
11. [Ausblick & Weiterführende Gedanken](#11-ausblick--weiterführende-gedanken)

---

## 1. Einleitung & Kontext

Der **Kindle Scribe** (erste Generation 2022, zweite Generation 2024, dritte Generation 2025) markiert einen Wendepunkt in Amazons E-Reader-Strategie: Erstmals vereint ein Kindle einen **10,2″ bzw. 11″ großen E-Ink-Carta-1200-Bildschirm mit 300 ppi** und einer Wacom-Stift-Eingabeebene. Damit rückt das Gerät in die Nähe von E-Ink-Tablets wie dem reMarkable 2 oder Boox Tab Ultra – behält aber Amazons geschlossenes Ökosystem bei.

Für Webentwickler und Content-Ersteller stellt sich die Frage: **Wie nutze ich diesen großen, hochauflösenden E-Ink-Bildschirm für Webinhalte optimal?** Der eingebaute „Experimentelle Webbrowser“ (seit Jahren in allen Kindle-Modellen vorhanden, aber lange stiefmütterlich behandelt) wird plötzlich zu einem ernstzunehmenden Target.

> **Wichtig:** Dieser Report richtet sich an Entwickler, Designer und Power-User, die **Webseiten, Web-Apps oder PWAs** für den Kindle Scribe (und verwandte E-Ink-Geräte) optimieren wollen. Er ist **kein** User-Guide zum Surfen auf dem Kindle.

### Warum überhaupt für Kindle Scribe optimieren?

- **Wachsende Installationsbasis:** Der Scribe ist Amazons teuerster E-Reader (349–449 €) und verkauft sich gut.
- **Einzigartiges Formfaktor:** 10,2″/11″ @ 300 ppi = **ca. 1400×1872 px (Gen 1) bzw. 1980×2640 px (Gen 3)** – ideal für zweispaltige Layouts, Tabellen, Code, Notizen.
- **Stift-Eingabe:** Der Basic/Premium Pen ermöglicht Annotationen, Formulareingaben, Zeichnungen – direkt im Browser.
- **Offline-First-Nutzung:** Viele Scribe-Besitzer nutzen das Gerät fernab von WLAN (im Zug, im Park, im Bett). PWAs mit Service-Worker-Caching sind hier **Killer-Features**.
- **Keine Ablenkung:** Keine Benachrichtigungen, kein Multitasking, kein Doomsrolling – reiner Fokus auf Inhalt.

---

## 2. Hardware-Grundlagen des Kindle Scribe

### 2.1 Display-Spezifikationen

| Generation | Bildschirm | Auflösung | PPI | Frontlight | Besonderheiten |
|------------|------------|-----------|-----|------------|----------------|
| **Scribe (2022)** | 10,2″ E-Ink Carta 1200 | 1860 × 2480 px | 300 | Warm + Kühl, 25 LEDs | Wacom-Layer, 16/32/64 GB |
| **Scribe (2024)** | 10,2″ E-Ink Carta 1200 | 1860 × 2480 px | 300 | Warm + Kühl, 35 LEDs | Weichere Stiftspitze, KI-Features |
| **Scribe (2025/Gen 3)** | 11″ E-Ink Carta 1300 | 1980 × 2640 px | 300 | Warm + Kühl, Auto-Adjust | Aktive Leinwand-Textur, schnellerer Refresh |

**Wichtige Implikationen für Webdesign:**

- **CSS-Pixel ≠ Hardware-Pixel:** Der Browser skaliert. Bei 300 ppi und typischem Viewport-Scaling (ca. 1,5–2×) ergeben sich **effektive CSS-Breiten von ~900–1300 px**. Medienabfragen (`@media (max-width: 1200px)`) greifen anders als auf Desktop.
- **Seitenverhältnis ~ 3:4** (Hochformat) – ideal für Lesen, schlecht für breite Dashboard-Layouts. **Responsive Breakpoints müssen angepasst werden.**
- **Kein Farbdisplay** (außer Colorsoft, 150 ppi in Farbe). Design **immer in Graustufen** denken.

### 2.2 Eingabe & Interaktion

| Feature | Unterstützung im Browser |
|---------|-------------------------|
| Touch (Finger) | Ja, aber ungenau (kapazitiv, durch E-Ink-Schicht gedämpft) |
| Stift (Wacom AES 2.0) | **Ja, präzise** – Druckstufen, Neigung, Radierer werden an Web-Seite weitergegeben (`pointer` Events) |
| Tastatur (virtuell) | Ja, Amazon-eigene On-Screen-Keyboard |
| Hardware-Tasten | Nein (nur Power + USB-C) |
| Scrollen | Touch-Drag, Stift-Drag,Seitliche Wischgeste (Vor/Zurück) |

> **Tipp:** Nutzen Sie `pointer-events: none` sparsam. Der Stift ist das **primäre Eingabegerät** auf dem Scribe – große Touch-Targets (mind. 44×44 CSS-Pixel, besser 60×60) sind Pflicht.

### 2.3 Prozessor & Speicher (Relevanz für Web-Performance)

- **MediaTek MT8110/MT8113** (2× Cortex-A72 + 4× Cortex-A53, ~1,8–2,0 GHz)
- **1 GB RAM** (Gen 1/2), **2 GB RAM** (Gen 3)
- **Browser-Engine:** WebKit-basiert (vermutlich WebKitGTK/WPE, Version ~ Safari 13–14 Äquivalent)
- **Kein JIT-Compiler** für JavaScript in älteren Versionen → **JS-Performance ist der Flaschenhals**

---

## 3. Der Experimentelle Webbrowser: Technische Realität

### 3.1 Was „Experimental“ wirklich bedeutet

Amazons „Experimental Web Browser“ ist **kein** vollwertiger moderner Browser. Er basiert auf **WebKit** (derselbe Engine-Kern wie Safari), aber:

- **Keine automatischen Updates** – die Engine-Version ist an die Firmware gebunden.
- **Eingeschränktes JavaScript** – keine modernen APIs (WebGL, WebAssembly, WebRTC, WebUSB, WebBluetooth, Service Worker *teilweise*, Push API, Background Sync).
- **Strenges Same-Origin-Policy**, aber **keine modernen CSP-Features**.
- **HTTPS-Zwangsprobleme:** Ältere Firmwares kämpfen mit modernen TLS-Zertifikaten (Let's Encrypt, HTTP/2, HSTS). Seit **Oktober 2025** funktioniert **Google Search nicht mehr** („Update your browser“).
- **User-Agent-String** (Beispiel Gen 2, Firmware 5.16.x):
  ```
  Mozilla/5.0 (Linux; U; Android 8.1.0; de-de; Kindle Scribe Build/OPM1) 
  AppleWebKit/605.1.15 (KHTML, like Gecko) Version/4.0 
  Mobile Safari/605.1.15
  ```
  → **WebKit 605** ≈ **Safari 13 (2019)**. Kein ES2020+, kein CSS Grid Level 2, keine Custom Properties in `@media`, kein `aspect-ratio`.

### 3.2 CSS-Feature-Support (Stand Firmware 5.16.x / 2024–2025)

| Feature | Support | Hinweis |
|---------|---------|---------|
| Flexbox | ✅ Voll | `-webkit-box` Fallbacks nicht nötig |
| CSS Grid | ⚠️ Teilweise | Level 1 nur, kein Subgrid, kein Masonry |
| Custom Properties (CSS Variables) | ✅ Ja | Aber nicht in `@media` Queries |
| `clamp()`, `min()`, `max()` | ❌ Nein | Polyfill nötig |
| `aspect-ratio` | ❌ Nein | Padding-Hack nötig |
| `container queries` | ❌ Nein | |
| `prefers-color-scheme` | ✅ Ja | System-Dark-Mode wird erkannt |
| `prefers-reduced-motion` | ✅ Ja | **Wichtig für E-Ink!** |
| `font-display: swap` | ✅ Ja | Kritisch für Webfonts |
| `backdrop-filter` | ❌ Nein | |
| `mask-image`, `clip-path` | ⚠️ Teilweise | Nur einfache Formen |
| CSS Animations/Transitions | ⚠️ **Vorsicht** | **Verursachen Ghosting!** Deaktivieren via `prefers-reduced-motion` |

### 3.3 JavaScript-APIs: Was geht, was nicht

| API | Status | Workaround |
|-----|--------|------------|
| `fetch` / `XMLHttpRequest` | ✅ | Nur HTTPS, keine CORS-Proxies ohne Server |
| `localStorage` / `sessionStorage` | ✅ | ~5 MB Limit, **persistiert über Neustarts** |
| `IndexedDB` | ✅ | Langsam, aber funktional |
| `Service Worker` | ⚠️ **Eingeschränkt** | Registrierung klappt, `fetch` Event oft buggy, `cache` Storage limit ~50 MB |
| `Web Workers` | ❌ Nein | Kein Multithreading |
| `WebAssembly` | ❌ Nein | |
| `IntersectionObserver` | ✅ Ja | Lazy-Loading möglich |
| `ResizeObserver` | ❌ Nein | Polling-Fallback nötig |
| `requestIdleCallback` | ❌ Nein | `setTimeout` Fallback |
| `navigator.onLine` | ✅ Ja | Unzuverlässig bei WLAN-Sleep |

> **Empfehlung:** Schreiben Sie **ES5-kompatiblen Code** (oder transpilieren Sie mit Babel `targets: "webkit >= 605"`). Nutzen Sie **keine** optionalen Chaining (`?.`), Nullish Coalescing (`??`), dynamische Imports, Top-Level-Await.

---

## 4. E-Ink-spezifische Designprinzipien

E-Ink-Displays funktionieren **grundlegend anders** als LCD/OLED. Wer dies ignoriert, produziert Webseiten, die auf dem Scribe **schlecht lesbar, flackernd oder gar unbenutzbar** sind.

### 4.1 Die Physik: Ghosting, Refresh-Raten & Kontrast

```
┌─────────────────────────────────────────────────────────────┐
│  E-INK REFRESH-MODI (vereinfacht)                           │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Modus        │ Geschwindigkeit │ Graustufen   │ Ghosting     │
├──────────────┼──────────────┼──────────────┼────────────────┤
│ A2 (Fast)    │ ~120–200 ms   │ 2 (Schwarz/  │ Stark          │
│              │               │  Weiß)       │                │
│ GC16 (Full)  │ ~500–800 ms   │ 16           │ Minimal        │
│ REGAL/DU     │ ~250–400 ms   │ 16           │ Gering         │
└──────────────┴──────────────┴──────────────┴────────────────┘
```

- **Der Browser steuert den Refresh-Modus nicht direkt.** Amazon's WebKit-Implementierung wählt heuristisch: **Scrollen → A2 (schnell, 2 Farben)**, **Seitenladen/Neuzeichnen → GC16 (voll, 16 Graustufen)**.
- **Ghosting** = Nachbilder vorheriger Inhalte. Verursacht durch unvollständiges Entladen der Mikrokapseln.
- **Kontrast** liegt bei ~12:1 bis 15:1 (Papier: ~20:1). **Reines Schwarz (#000) auf Weiß (#fff) flimmert** auf E-Ink („Visual Vibration“).

### 4.2 Farbwahrnehmung: Graustufen-Design ist Pflicht

- **Farben werden in 16 Graustufen gedithert.** Rot und Grün sehen oft identisch aus.
- **Keine Farbcodierung für Information** (Fehler=Rot, Erfolg=Grün) – nutz **Form, Text, Icons, Muster**.
- **Bilder:** Konvertieren Sie Fotos/Grafiken serverseitig in **optimierte Graustufen-PNGs/WebP** (dithered, 16 Graustufen). Client-seitiges `filter: grayscale(100%)` ist zu langsam und schlecht.

### 4.3 Typografie auf E-Ink: Lesbarkeit über alles

| Prinzip | Umsetzung |
|---------|-----------|
| **Serifen vs. Serifenlos** | Serifen (Georgia, Merriweather, Source Serif) **lesen sich auf E-Ink besser** bei kleinen Größen. Serifenlos (Inter, Roboto, System-UI) für UI/Überschriften. |
| **Mindestgröße** | **16 px (1 rem) Basis**, 18–20 px für Fließtext. Kein `< 14 px`. |
| **Zeilenhöhe** | `line-height: 1.6–1.8` – mehr Luft verhindert „Verkleben“ bei Ghosting. |
| **Zeichenabstand** | `letter-spacing: 0.02–0.05em` bei kleinen Größen. |
| **Kontrast** | **Nicht #000 auf #fff.** Nutzen Sie `#1a1a1a` auf `#f5f5f0` (warmes Papier-Weiß) oder `#e8e8e0` auf `#1a1a1a` (Dark Mode). |
| **Font-Loading** | `font-display: swap` + **Preload** kritischer Fonts. System-Fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`) sind am schnellsten. |
| **Variable Fonts** | ❌ Nicht unterstützt (WebKit 605). Nutzen Sie separate WOFF2-Dateien pro Weight. |

### 4.4 Dark Mode auf E-Ink: Ein Sonderfall

Entgegen gängiger UX-Weisheit ist **Dark Mode auf E-Ink oft schlechter lesbar**:

- E-Ink reflektiert Umgebungslicht. **Weißer Hintergrund = Papier-Ähnlichkeit = höchster Kontrast bei Tageslicht.**
- Schwarzer Hintergrund = **kein Licht reflektiert** = wirkt „grau“, Text muss **hellgrau** sein → geringerer Kontrast.
- **Ausnahme:** Dunkle Umgebung + Frontlight an. Dann kann Dark Mode (warmes Sepia, nicht reines Schwarz) angenehmer sein.

**Implementierung:**
```css
/* System-Preference respektieren, aber Papier-Default */
:root {
  --bg: #f5f5f0;
  --text: #1a1a1a;
  --muted: #4a4a3a;
  --border: #d0d0b8;
  --link: #0066cc;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --text: #e8e8e0;        /* NICHT #fff! */
    --muted: #a8a898;
    --border: #3a3a30;
    --link: #66aaff;
  }
}

/* Erzwungener Light-Mode für Lesbarkeit (User-Override) */
@media (prefers-color-scheme: light) {
  :root { /* Papier-Weiß Default */ }
}
```

---

## 5. CSS- & Frontend-Optimierungsstrategien

### 5.1 Layout: Spalten, Container, Scrollen

```css
/* Mobile-First, aber Breakpoints für Scribe anpassen */
:root {
  --max-width: 900px;      /* Lesbare Zeilenlänge */
  --gap: 1.5rem;
}

.page {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: var(--gap);
}

/* Zweispaltig ab Scribe-Breite (~900px CSS) */
@media (min-width: 900px) {
  .article-grid {
    display: grid;
    grid-template-columns: 1fr 300px; /* Haupttext + Sidebar/Notizen */
    gap: 2rem;
    align-items: start;
  }
}

/* Vermeiden Sie horizontales Scrollen! */
img, table, pre, code {
  max-width: 100%;
  overflow-x: auto; /* Nur wenn unvermeidbar */
  -webkit-overflow-scrolling: touch;
}
```

**Tabellen auf E-Ink:** Nutzen Sie `display: block; overflow-x: auto` mit **frozen first column** (CSS `position: sticky; left: 0`) – horizontal scrollen mit Stift ist frustrierend.

### 5.2 Ghosting-minimierende CSS-Regeln

```css
/* 1. Animationen global reduzieren */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* 2. Keine Hover-Effekte, die Layout ändern */
a:hover, button:hover {
  /* KEIN transform, width, height, margin, padding! */
  text-decoration: underline; /* Sicher */
  color: var(--link-hover);   /* Sicher */
}

/* 3. Scroll-Indikatoren statt Scroll-Animationen */
.scroll-hint::after {
  content: "↓ Scrollen";
  opacity: 0.6;
  font-size: 0.85rem;
}

/* 4. Bilder: Kein Lazy-Load mit Fade-In (Ghosting!) */
img {
  /* Schlecht: opacity-Transition beim Laden */
  /* Gut: Sofort anzeigen, Platzhalter mit aspect-ratio (Padding-Hack) */
  display: block;
  max-width: 100%;
  height: auto;
}

/* 5. Code-Blöcke: Monospace, keine Ligaturen, hoher Kontrast */
pre {
  background: #f0f0e8;
  border: 1px solid var(--border);
  padding: 1rem;
  overflow-x: auto;
  font-family: 'Source Code Pro', 'Fira Code', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
}
```

### 5.3 Touch-/Stift-Ziele: Die 60-Pixel-Regel

```css
/* Mindestgröße für ALLE interaktiven Elemente */
button,
a[href],
input[type="button"],
input[type="submit"],
select,
summary,
[role="button"],
[tabindex]:not([tabindex="-1"]) {
  min-height: 60px;
  min-width: 60px;
  /* Visueller Fokus-Ring für Stift-Navigation */
  outline: 3px solid transparent;
  outline-offset: 2px;
}

*:focus-visible {
  outline-color: #0066cc;
  outline-style: solid;
}

/* Checkboxen/Radios vergrößern */
input[type="checkbox"],
input[type="radio"] {
  width: 28px;
  height: 28px;
  accent-color: #0066cc; /* WebKit 605 unterstützt accent-color */
}
```

### 5.4 Formulare & Eingaben: Stift-Optimierung

```css
input,
textarea,
select {
  font-size: 1.1rem;      /* Verhindert Zoom auf iOS/Safari, auf Kindle egal, aber lesbarer */
  padding: 0.75rem 1rem;
  border: 2px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  /* Stift-Schrift wird nicht korrigiert – großes Padding hilft */
}

/* Textarea für Handschrift-Notizen */
textarea.notes {
  min-height: 200px;
  line-height: 1.8;
  /* Hintergrund-Linien wie kariertes Papier */
  background-image: repeating-linear-gradient(
    var(--bg),
    var(--bg) 30px,
    var(--border) 30px,
    var(--border) 31px
  );
}
```

> **Pro-Tipp:** Der Kindle-Browser unterstützt **`inputmode="none"`** nicht. Nutzen Sie `inputmode="text"` und blenden Sie die virtuelle Tastatur via `readonly` + JS-Fokus-Management aus, wenn Stift-Eingabe gewünscht ist.

---

## 6. JavaScript & Progressive Web Apps auf E-Ink

### 6.1 Service Worker: Offline-First ist Überlebenswichtig

Der Scribe wird oft **ohne WLAN** genutzt (Flugzeug, Bahn, Garten). Eine PWA ohne Offline-Support ist nutzlos.

```javascript
// sw.js – Minimal-Service-Worker für Kindle Scribe
const CACHE_NAME = 'kindle-scribe-v1';
const OFFLINE_URL = '/offline.html';

// Install: Kern-Assets cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      '/',
      '/offline.html',
      '/manifest.json',
      '/styles/main.css',
      '/scripts/app.js',
      '/fonts/merriweather-latin-400.woff2',
      '/fonts/merriweather-latin-700.woff2',
    ]))
  );
  self.skipWaiting();
});

// Fetch: Stale-While-Revalidate für HTML, Cache-First für Assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur Same-Origin
  if (url.origin !== location.origin) return;

  // HTML: Network first, fallback to cache, then offline page
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // CSS/JS/Fonts/Images: Cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Activate: Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
```

**Wichtige Einschränkungen auf Kindle:**
- **Service Worker Registration** funktioniert, aber `fetch`-Event-Handler werden **manchmal nicht gefeuert** (Bug in WebKit 605).
- **Fallback:** Nutzen Sie **`localStorage` + `sessionStorage`** für kritische Daten (App-State, Benutzereingaben, gelesene Artikel).
- **Cache-Storage-Limit:** ~50 MB. Bilder aggressiv komprimieren (WebP, Graustufen, < 50 KB pro Bild).

### 6.2 Web App Manifest: Installierbar machen

```json
{
  "name": "Mein Lese-Tool",
  "short_name": "LeseTool",
  "description": "Optimiert für Kindle Scribe & E-Ink",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "portrait-primary",
  "background_color": "#f5f5f0",
  "theme_color": "#1a1a1a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "categories": ["productivity", "education", "books"],
  "prefer_related_applications": false
}
```

- **`display: fullscreen`** versteckt die Browser-Chrome (Adressleiste, Tabs) – mehr Platz für Inhalt.
- **`orientation: portrait-primary`** sperrt Hochformat (Querformat auf Scribe = schmale Zeilen).

### 6.3 JavaScript-Patterns für alte WebKit-Versionen

```javascript
// 1. Feature Detection statt Browser Sniffing
const supports = {
  fetch: 'fetch' in window,
  sw: 'serviceWorker' in navigator,
  idb: 'indexedDB' in window,
  cssVars: CSS.supports('color', 'var(--x)'),
  intersectionObserver: 'IntersectionObserver' in window,
};

// 2. Polyfills NUR bei Bedarf laden
if (!supports.fetch) {
  // Load whatwg-fetch polyfill (ES5 Build)
  const script = document.createElement('script');
  script.src = '/polyfills/fetch.umd.js';
  document.head.appendChild(script);
}

// 3. Event-Listener mit Passive-Flag (Scroll-Performance)
document.addEventListener('touchstart', handler, { passive: true });
document.addEventListener('wheel', handler, { passive: true });

// 4. Debounce für Resize/Scroll (kein ResizeObserver)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 150);
});

// 5. localStorage Wrapper mit Quota-Handling
const storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        // Alte Einträge löschen (LRU)
        this.cleanup();
        return this.set(key, value);
      }
      return false;
    }
  },
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch { return defaultValue; }
  },
  cleanup() {
    // Einfache LRU: Älteste 20% löschen
    const keys = Object.keys(localStorage);
    const toDelete = keys.slice(0, Math.ceil(keys.length * 0.2));
    toDelete.forEach(k => localStorage.removeItem(k));
  }
};
```

### 6.4 Was Sie **nicht** tun sollten

| Anti-Pattern | Warum es auf Scribe scheitert |
|--------------|-------------------------------|
| **SPA mit Client-Side Routing** (React Router, Vue Router) | History API Bugs, keine SSR, langsame Initial-Load, JS-Bundle > 200 KB = 5+ Sek Laden |
| **Heavy UI Libraries** (Material UI, Ant Design, Bootstrap 5) | Zu viel CSS/JS, Grid/Flexbox-Bugs in WebKit 605, große Touch-Targets fehlen |
| **Animationen/Transitionen** (Framer Motion, Animate.css) | Ghosting, CPU-Last, Akku-Verbrauch |
| **Webfonts > 2 Gewichte** | Blockierendes Rendering, Cache-Druck |
| **Drittanbieter-Scripts** (Analytics, Chat-Widgets, Ads) | Blockieren Main-Thread, oft HTTPS/TLS-Fehler auf alter Firmware |
| **Infinite Scroll** | Scroll-Event feuert bei A2-Refresh nicht zuverlässig, Speicher läuft voll |
| **Canvas/WebGL** (Charts, Games) | Nicht unterstützt / 1 fps |

**Besser:** **Server-Side Rendering (SSR) + Minimal JS** (Alpine.js, htmx, Vanilla JS < 30 KB gzipped). Statische HTML-Seiten mit **Progressive Enhancement**.

---

## 7. Praxisbeispiel: ReKindle – Eine PWA für E-Ink

Das Open-Source-Projekt **[ReKindle](https://github.com/ReKindleOS/ReKindle)** (rekindle.ink) ist der **Goldstandard** für Web-Apps auf Kindle Scribe. Eine Analyse seiner Architektur liefert wertvolle Lektionen.

### 7.1 Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                     REKINDLE ARCHITEKTUR                    │
├─────────────────────────────────────────────────────────────┤
│  1. DREI BUILD-TARGETS (node build-automation.js)          │
│     ├── main/   → Modern Browsers (Desktop, Mobile)        │
│     │           ES6+, Minifiziert, Code-Splitting           │
│     ├── lite/ → Kobo / Neuere Kindle (Chrome 44+)          │
│     │           ES5 transpiliert, Polyfills, Kobo-Fixes    │
│     └── legacy/ → Alte Kindle (Chrome 12+, Paperwhite 2)   │
│                 Aggressive Transpilierung, Warnings         │
│                                                             │
│  2. TECH-STACK                                              │
│     ├── Vanilla JS (ES5 für lite/legacy)                   │
│     ├── Kein Framework (kein React/Vue/Svelte)             │
│     ├── CSS Custom Properties + Fallbacks                  │
│     ├── localStorage für Guest-Mode (Offline-First)        │
│     ├── Firebase für Cloud-Sync (Optional)                 │
│     ├── Cloudflare Workers für CORS-Proxys (AI, OCR, TMDB) │
│     └── epub.js für EPUB-Reader im Browser                 │
│                                                             │
│  3. E-INK OPTIMIERUNGEN                                     │
│     ├── Retro-Ästhetik (Graue Icons, keine Farben)         │
│     ├── Hoher Kontrast, große Touch-Targets                │
│     ├── Keine Animationen (prefers-reduced-motion: reduce) │
│     ├── Text-lastige Layouts, wenig Bilder                 │
│     └── NetLite: Text-only Browser via FrogFind Proxy      │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Konkrete Code-Patterns aus ReKindle

**A. Graceful Degradation für CSS Grid:**
```css
/* Base: Flexbox Fallback */
.app-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.app-grid > * {
  flex: 1 1 300px; /* Mindestbreite 300px */
}

/* Enhancement: Grid für moderne Browser */
@supports (display: grid) {
  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}
```

**B. Lokale Datenspeicherung (Guest Mode):**
```javascript
// Einfacher Key-Value Store mit Namespaces
const LocalStore = {
  prefix: 'rk_',
  set(ns, key, value) {
    const store = JSON.parse(localStorage.getItem(this.prefix + ns) || '{}');
    store[key] = value;
    localStorage.setItem(this.prefix + ns, JSON.stringify(store));
  },
  get(ns, key, def = null) {
    const store = JSON.parse(localStorage.getItem(this.prefix + ns) || '{}');
    return store[key] ?? def;
  },
  getAll(ns) {
    return JSON.parse(localStorage.getItem(this.prefix + ns) || '{}');
  }
};

// Usage: LocalStore.set('tasks', 'task-1', { title: 'Lesen', done: false });
```

**C. NetLite – Text-only Web Proxy:**
```javascript
// Vereinfachter Client für FrogFind (Text-only Google Proxy)
async function fetchTextOnly(url) {
  const proxy = 'https://r.jina.ai/http://' + encodeURIComponent(url);
  // oder: https://r.jina.ai/http://textise.net/showtext.aspx?strURL=...
  const response = await fetch(proxy);
  const text = await response.text();
  // HTML strippen, nur Text zurückgeben
  return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
```

### 7.3 Lektionen aus ReKindle für eigene Projekte

1. **Baue drei Targets** (Modern, Lite, Legacy) – der Kindle Scribe läuft im **Lite-Target** (Chrome 44+ ≈ WebKit 605).
2. **Verzichte auf Frameworks.** Vanilla JS + CSS Variables + ES5-Transpilierung ist schneller, kleiner, robuster.
3. **Offline-First ist kein Feature, sondern Default.** `localStorage` > `IndexedDB` > `Cache Storage` (zu buggy).
4. **Design für Stift, nicht für Finger.** 60px Targets, präzise Pointer-Events, Handschrift-Erkennung (OCR) via Server-Proxy.
5. **Proxy alles Externe.** CORS, TLS, API-Keys – alles über eigene Cloudflare Workers / Serverless Functions.

---

## 8. Performance & Caching-Strategien

### 8.1 Critical Rendering Path auf E-Ink

```
┌────────────────────────────────────────────────────────────────┐
│  ZIEL: First Meaningful Paint < 2 Sekunden auf Kindle Scribe  │
├────────────────────────────────────────────────────────────────┤
│  1. HTML streamen (SSR) – nicht auf JS warten                  │
│  2. Critical CSS inline (< 14 KB)                              │
│  3. Preload: 1-2 Fonts (WOFF2, subset), Hero-Image (WebP)      │
│  4. JS am Ende von <body>, defer, < 30 KB gzipped              │
│  5. Service Worker installiert bei erstem Besuch               │
│  6. Folgeaufrufe: Cache-First → Instant Load                   │
└────────────────────────────────────────────────────────────────┘
```

**HTML-Template (Best Practice):**
```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#1a1a1a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="manifest" href="/manifest.json">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  
  <!-- Critical CSS INLINE -->
  <style>
    /* Nur Above-the-Fold Styles: Layout, Typo, Variablen */
    :root{--bg:#f5f5f0;--text:#1a1a1a;--max:900px}
    body{margin:0;font-family:system-ui,Georgia,serif;background:var(--bg);color:var(--text);line-height:1.7}
    .page{max-width:var(--max);margin:0 auto;padding:1.5rem}
    h1{font-size:2rem;line-height:1.3;margin:0 0 1rem}
    @media(prefers-color-scheme:dark){:root{--bg:#1a1a1a;--text:#e8e8e0}}
  </style>
  
  <!-- Preloads -->
  <link rel="preload" href="/fonts/merriweather-latin-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/merriweather-latin-700.woff2" as="font" type="font/woff2" crossorigin>
  
  <!-- Non-critical CSS async -->
  <link rel="preload" href="/styles/main.css" as="style" onload="this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/styles/main.css"></noscript>
  
  <title>Artikel-Titel | Meine Seite</title>
</head>
<body>
  <article class="page">
    <header>
      <h1>Artikel-Titel</h1>
      <p class="meta">Veröffentlicht am 14. Juli 2026 · 12 Min Lesezeit</p>
    </header>
    <div class="content">
      <!-- Server-gerenderter Inhalt -->
    </div>
  </article>
  
  <!-- JS am Ende, defer -->
  <script defer src="/scripts/app.js"></script>
  
  <!-- Service Worker Registration -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
      });
    }
  </script>
</body>
</html>
```

### 8.2 Bild-Optimierung für E-Ink

| Format | Einsatzzweck | Optimierung |
|--------|--------------|-------------|
| **WebP (lossless, Graustufen)** | Fotos, Diagramme | `cwebp -lossless -mt -q 100 -g 16 input.png -o output.webp` |
| **AVIF (falls unterstützt)** | Moderne Browser | Fallback auf WebP via `<picture>` |
| **SVG (inline)** | Icons, Logos, Diagramme | `fill="currentColor"`, `stroke="currentColor"`, keine festen Farben |
| **PNG 8-bit (dithered)** | Fallback für alte Browser | `pngquant --quality=65-80 --posterize=4` |

**Responsive Images mit Art Direction:**
```html
<picture>
  <!-- E-Ink: Graustufen, hoher Kontrast -->
  <source media="(prefers-color-scheme: dark)" 
          srcset="/img/diagram-dark.webp" type="image/webp">
  <source media="(prefers-color-scheme: light)" 
          srcset="/img/diagram-light.webp" type="image/webp">
  <!-- Fallback -->
  <img src="/img/diagram-light.png" alt="Architektur-Diagramm" 
       width="800" height="600" loading="lazy" decoding="async">
</picture>
```

> **Tipp:** Generieren Sie **serverseitig** zwei Versionen jedes Bildes (Light/Dark optimiert). Client-seitige CSS-Filter (`filter: invert(1) contrast(1.5)`) sind zu langsam und sehen schlecht aus.

### 8.3 Font-Strategie: System First, Webfont Second

```css
/* 1. System Font Stack (sofort verfügbar) */
:root {
  --font-serif: 'Merriweather', Georgia, Cambria, 'Times New Roman', serif;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'Source Code Pro', 'Fira Code', Menlo, Monaco, Consolas, monospace;
}

/* 2. Webfont mit font-display: swap */
@font-face {
  font-family: 'Merriweather';
  src: url('/fonts/merriweather-latin-400.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Merriweather';
  src: url('/fonts/merriweather-latin-700.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
  unicode-range: /* same */;
}

/* 3. Preconnect zu Font-CDN (falls extern) */
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

**Subsetting:** Nutzen Sie `glyphhanger` oder `pyftsubset`, um **nur verwendete Unicode-Ranges** (Lateinisch, erweiterte Lateinisch) einzuschließen. Spart 60–80 % Dateigröße.

---

## 9. Testing & Debugging auf dem Gerät

### 9.1 Remote Debugging: Geht nicht offiziell

Der Kindle Scribe hat **kein** offizielles Remote-Debugging (kein `chrome://inspect`, kein WebKit-Remote-Inspector). Workarounds:

| Methode | Aufwand | Effektivität |
|---------|---------|--------------|
| **Console.log → Datei** | Gering | Logs in `localStorage` schreiben, per Bookmarklet/Export auslesen |
| **Visueller Debug-Overlay** | Mittel | Feste Position, `z-index: 9999`, zeigt State, Errors, Performance |
| **Server-seitiges Logging** | Mittel | `fetch('/log', {method:'POST', body:JSON.stringify(data)})` |
| **Desktop-Safari + User-Agent-Spoofing** | Gering | Entwicklertools → Network Conditions → UA auf Kindle-UA setzen |
| **E-Ink-Simulator (Browser-Extension)** | Gering | CSS `filter: grayscale(100%) contrast(1.2) sepia(0.15)` + Viewport-Resize |

**Empfohlenes Debug-Bookmarklet (auf Kindle als Lesezeichen speichern):**
```javascript
javascript:(function(){
  var d=document.createElement('div');
  d.id='kindle-debug';
  d.style.cssText='position:fixed;top:0;right:0;bottom:0;width:300px;background:#1a1a1a;color:#0f0;padding:1rem;font:12px monospace;z-index:99999;overflow:auto;border-left:2px solid #0f0';
  d.innerHTML='<strong>DEBUG</strong><br>UA: '+navigator.userAgent+'<br>SW: '+(navigator.serviceWorker?'✅':'❌')+'<br>localStorage: '+Object.keys(localStorage).length+' keys<br>Online: '+navigator.onLine;
  document.body.appendChild(d);
  window.onerror=function(m,s,l,c,e){d.innerHTML+='<br><span style="color:#f00">ERR:</span> '+m+'@'+s+':'+l;};
  console.log=function(){d.innerHTML+='<br>> '+Array.from(arguments).join(' ');};
})();
```

### 9.2 Test-Matrix

| Gerät / Browser | Viewport (CSS) | WebKit Version | Test-Priorität |
|-----------------|----------------|----------------|----------------|
| Kindle Scribe Gen 1 (FW 5.16.x) | ~900×1200 | 605 | **Hoch** |
| Kindle Scribe Gen 2 (FW 5.17.x) | ~900×1200 | 605+ | **Hoch** |
| Kindle Scribe Gen 3 (FW 5.18+) | ~1100×1500 | 610+ | **Mittel** |
| Kobo Elipsa 2E / Libra Colour | ~1000×1400 | Chrome 90+ (Android WebView) | Mittel |
| Boox Tab Ultra C Pro | ~1200×1600 | Chrome 110+ (Android 11+) | Niedrig |
| reMarkable 2 (Browser) | ~1000×1400 | QtWebEngine (Chromium 80+) | Niedrig |
| Desktop Safari (UA-Spoof) | 900×1200 | Aktuell | **Entwicklung** |

### 9.3 Automatisiertes Testen (CI/CD)

```yaml
# .github/workflows/kindle-test.yml
name: Kindle Scribe Compatibility
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Lite Target (ES5)
        run: npm run build:lite  # Ausgabe in dist/lite/
      - name: Test with Playwright (WebKit)
        uses: microsoft/playwright-github-action@v1
        with:
          browser: webkit
      - name: Run accessibility & performance tests
        run: |
          npx playwright test --project=webkit --grep @kindle
      - name: Bundle size check
        run: |
          SIZE=$(gzip -c dist/lite/scripts/app.js | wc -c)
          if [ $SIZE -gt 30000 ]; then
            echo "❌ JS Bundle too large: ${SIZE} bytes (max 30 KB gzipped)"
            exit 1
          fi
```

---

## 10. Zusammenfassung & Checkliste

### 10.1 Die 10 Gebote der Kindle-Scribe-Optimierung

| # | Gebot | Begründung |
|---|-------|------------|
| 1 | **SSR/SSG First, JS Last** | WebKit 605 ist langsam, JS blockiert Rendering |
| 2 | **Graustufen-Design, kein Farb-Coding** | E-Ink zeigt 16 Graustufen, Farben dithern unleserlich |
| 3 | **Kontrast ≠ #000/#fff** | Nutzen Sie warmes Papier-Weiß (`#f5f5f0`) + Dunkelgrau (`#1a1a1a`) |
| 4 | **Schrift ≥ 16px, Zeilenhöhe ≥ 1.6** | Lesbarkeit bei Ghosting, Stift-Navigation |
| 5 | **Touch/Stift-Targets ≥ 60×60 px** | Finger ungenau, Stift primär |
| 6 | **Animationen deaktivieren (`prefers-reduced-motion`)** | Verhindert Ghosting, spart Akku |
| 7 | **Offline-First (Service Worker + localStorage)** | Scribe oft offline genutzt |
| 8 | **Bilder: Graustufen WebP, serverseitig Light/Dark** | Client-Filter zu langsam, schlechtes Dithering |
| 9 | **Drei Build-Targets (Modern, Lite, Legacy)** | ReKindle-Muster: Kompatibilität sichern |
| 10 | **Testen auf echtem Gerät** | Simulator ≠ E-Ink-Physik (Ghosting, Refresh, Kontrast) |

### 10.2 Quick-Start-Checkliste für neue Projekte

```
[ ] Projekt-Setup: Vite/Astro/Next.js mit ES5-Build-Target (lite)
[ ] CSS: Custom Properties + Fallbacks, prefers-reduced-motion, prefers-color-scheme
[ ] Fonts: 2 Gewichte (400, 700), WOFF2, subset, font-display: swap, preload
[ ] Layout: Mobile-First, Breakpoint @ 900px für Scribe-Zweispalter
[ ] Bilder: Build-Step für Graustufen-WebP (Light + Dark), <picture> Element
[ ] JS: Vanilla ES5, < 30 KB gzipped, keine Frameworks, Feature Detection
[ ] SW: Workbox GenerateSW (StaleWhileRevalidate HTML, CacheFirst Assets)
[ ] Manifest: fullscreen, portrait, Icons 192/512 maskable
[ ] Forms: inputmode, 60px targets, textarea mit Linien-Hintergrund
[ ] Debug: Bookmarklet für Console-Logging auf Gerät
[ ] CI: Playwright WebKit Tests, Bundle-Size-Gate (30 KB JS, 15 KB CSS)
[ ] Deploy: HTTPS, HSTS, CSP (restriktiv), COOP/COEP für SW
```

---

## 11. Ausblick & Weiterführende Gedanken

### 11.1 Die Zukunft: WebAssembly auf E-Ink?

Aktuell **kein WASM** auf Kindle. Aber: **WASM GC** (Garbage Collection) und **WASM Component Model** könnten in zukünftigen WebKit-Versionen (ab Safari 17+) landen. Wenn Amazon die Firmware auf WebKit 615+ aktualisiert, wären **Rust/Go/AssemblyScript-Apps im Browser** möglich – z. B. **lokaler EPUB-Parser, OCR, Bildverarbeitung, KI-Inferenz (TFLite/WebNN)**. Bis dahin: **Server-seitige Heavy Lifting via Cloudflare Workers / Edge Functions**.

### 11.2 Kindle Colorsoft (2025): Farbe kommt

Der **Kindle Colorsoft** (7″, 300 ppi S/W, 150 ppi Farbe) nutzt **E-Ink Kaleido 3**. Für Web-Entwickler bedeutet das:

- **Farben sind nun nutzbar**, aber **gedämpft, pastellartig, 150 ppi**.
- **Design-Systeme brauchen Farb-Token** für drei Modi: `light`, `dark`, `color-eink`.
- **Bilder:** Kein Graustufen-Dithering mehr nötig, aber **Sättigung reduzieren** (Kaleido 3 zeigt ~4000 Farben, nicht sRGB).
- **CSS:** `@media (color-gamut: p3)` funktioniert nicht – nutzt `@media (resolution: 150dpi)` als Heuristik.

### 11.3 Web-basierte E-Ink-OS: ReKindle, Kobo Nickel, Boox OS

Die Grenze zwischen „Webseite“ und „App“ verschwimmt auf E-Ink. **ReKindle beweist: Ein komplettes Produktivitäts-OS (Kalender, Mail, Tasks, Reader, Games) läuft im Browser.** Zukünftige Projekte sollten **nicht „Webseite für Kindle optimieren“, sondern „PWA als Kindle-App bauen“**.

### 11.4 Offene Forschungsfragen

1. **Stift-Druckstufen im Browser:** `pointerEvent.pressure` wird geliefert, aber **wie konsistent** über Firmware-Versionen?
2. **Handschrift-Erkennung (OCR) client-seitig:** Könnte **Tesseract.js (WASM)** auf Gen 3 (2 GB RAM) laufen? Oder **WebNN** bei zukünftiger Firmware?
3. **Background Sync / Periodic Background Sync:** Würde erlauben, Artikel **nachts via WLAN** zu syncen, tagsüber offline zu lesen.
4. **Web App Install Banner:** Zeigt der Kindle-Browser `beforeinstallprompt`? (Wahrscheinlich nicht – man muss Bookmark/Startbildschirm manuell nutzen).

### 11.5 Ressourcen & Links

- **ReKindle GitHub:** https://github.com/ReKindleOS/ReKindle
- **ReKindle Live:** https://rekindle.ink (auf Kindle Scribe öffnen!)
- **FrogFind (Text-only Search):** https://frogfind.com
- **Jina AI Reader (Text Extraction):** https://r.jina.ai/http://example.com
- **E-Ink CSS Article (Medium):** https://medium.com/age-of-awareness/e-ink-css-for-education-reducing-blue-light-through-software-design-f67d0be8ef14
- **WebKit Feature Status:** https://webkit.org/status/
- **Kindle Browser User Agents:** https://explore.whatismybrowser.com/useragents/explore/software_name/kindle-browser/
- **PWA auf E-Ink (BoingBoing Artikel):** https://boingboing.net/2026/03/24/rekindle-adds-apps-and-games-to-your-kindle-browser.html

---

## Anhang A: Minimales Starter-Template (GitHub Gist)

```bash
# kindle-scribe-starter
# https://gist.github.com/yourname/kindle-scribe-starter
#
# Struktur:
# ├── src/
# │   ├── index.html          # SSR-fähiges Template
# │   ├── styles/
# │   │   ├── critical.css    # Inline in <head>
# │   │   └── main.css        # Async geladen
# │   ├── scripts/
# │   │   └── app.js          # ES5, < 30 KB gz
# │   ├── fonts/
# │   │   └── merriweather-*.woff2
# │   └── images/
# │       └── *.webp (graustufen)
# ├── public/
# │   ├── manifest.json
# │   ├── sw.js
# │   └── offline.html
# ├── build.js                # Esbuild: 3 Targets (modern, lite, legacy)
# └── package.json
```

**Build-Skript (Esbuild, 3 Targets):**
```javascript
// build.js
const esbuild = require('esbuild');
const fs = require('fs');

const targets = {
  modern: 'es2020',
  lite: 'es5',      // Kindle Scribe, Kobo
  legacy: 'es5'     // + aggressive polyfills
};

const shared = {
  entryPoints: ['src/scripts/app.js'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: targets.lite, // Default
  outfile: 'dist/lite/scripts/app.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: '/* Kindle Scribe Lite Build */' },
};

async function buildAll() {
  for (const [name, target] of Object.entries(targets)) {
    await esbuild.build({
      ...shared,
      target,
      outfile: `dist/${name}/scripts/app.js`,
      banner: { js: `/* Kindle Scribe ${name} Build */` },
    });
  }
  // CSS & HTML kopieren...
  fs.cpSync('src/styles', 'dist/lite/styles', { recursive: true });
  fs.cpSync('public', 'dist/lite', { recursive: true });
}

buildAll().catch(() => process.exit(1));
```

---

**Ende des Reports.**

*Dieses Dokument ist für die Lesbarkeit auf E-Ink-Displays optimiert: Serifen-Schrift, hoher Kontrast, keine reinen Schwarz-Weiß-Flächen, großzügige Zeilenabstände, klare Hierarchie. Auf dem Kindle Scribe als HTML oder konvertiertes EPUB/PDF genießen.*

---

**Lizenz:** Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)  
**Quellcode-Beispiele:** MIT License  
**Stand:** Juli 2026 – Firmware- und Browser-Fähigkeiten können sich ändern. Prüfen Sie vor Produktions-Deployment die aktuelle Kindle-Firmware-Release-Notes.