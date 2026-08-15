# MacroStack — Detaillierter Umsetzungsplan

> Projekt: Fokus-Stacking WebApp für Makrofotografie
> Max: 30 Bilder pro Stack
> Stand: 15.08.2026

---

## 📐 Architektur-Übersicht

```
┌─────────────────────────────┐     ┌──────────────────────────────────┐
│   Frontend (React + Vite)   │     │       Backend (FastAPI)           │
│                             │     │                                  │
│  ┌─ Upload (Drag & Drop)    │────▶│  ┌─ POST /api/jobs (Upload)      │
│  │─ Thumbnail Grid          │     │  │─ WS  /ws/jobs/{id} (Progress) │
│  │─ Progress Bar (live)     │◀────│  │─ GET /api/jobs/{id} (Status)  │
│  │─ Before/After Slider     │     │  │─ GET /api/jobs/{id}/download  │
│  │─ Export Format Select    │     │  │─ DELETE /api/jobs/{id}        │
│  └──────────────────────────┘     │  └──────────────────────────────┘
                                    │              │
                                    │  ┌─ Job Queue (Redis + RQ)       │
                                    │  │─ Worker Prozess               │
                                    │  │─ TMP Storage (auto-cleanup)   │
                                    │  └──────────────────────────────┘
                                    └──────────────────────────────────┘
```

---

## 🔬 Algorithmen-Detail (was passiert wirklich)

### Phase A: Preprocessing
```
Eingabe: 30 RAW/JPG/PNG/TIFF → numpy arrays (BGR)
1. EXIF "FocusStepCount" oder "FocusDistance" lesen → Reihenfolge
   Falls kein EXIF: Manuelle Sortierung im Frontend
2. Referenzbild = mittleres Bild (index 15 oder n//2)
3. Alle Bilder auf Referenz-Auflösung skalieren
4. Color-Profile homogenisieren (sRGB)
5. Alle → float32 normalisieren [0.0, 1.0]
```

### Phase B: Alignment (ECC)
```
Pro Bild (außer Referenz):
  1. Beide Bilder → Grayscale
  2. cv2.findTransformECC(gray_ref, gray_img, warpMatrix, MOTION_AFFINE)
  3. cv2.warpAffine(img, warpMatrix, (w, h)) → aligned_img
  4. Fehlercode prüfen:
     - EPS converged → OK
     - Max iterations erreicht → Fallback ORB+RANSAC
  5. Gemeinsamen Crop-Bereich berechnen (Bounding-Box aller Transform-Overlaps)
  6. Alle aligned Bilder + Referenz auf diesen Crop zuschneiden
```

### Phase C: Focus Measure
```
Pro Bild:
  1. BGR → Grayscale → float32
  2. cv2.Laplacian(gray, cv2.CV_64F) → laplacian
  3. focus_map[x,y] = laplacian[x,y]²  (lokale Varianz via 7×7 Fenster)
  4. Gaussfilter über focus_map → weiche Maske
```

### Phase D: Multi-Scale Laplacian Pyramid Blending
```
Eingabe: N aligned Bilder + N Focus-Maps
Pyramid-Level: 5 (default, anpassbar)

1. Pro Bild: Laplacian-Pyramide bauen
2. Pro Bild: Gaussian-Pyramide der Focus-Map bauen
3. Pro Level l:
   - Weights = Weights aller Bilder an Position l (normalisiert)
   - Output[l] = sum(weights_i * laplacian_i[l])  für alle i
4. Reconstruct: Collapse Laplacian-Pyramide → Final Image
5. Clip [0.0, 1.0] → uint8 [0, 255]
```

### Phase E: Postprocessing (optional, Quality-Modus)
```
- Denoise: cv2.fastNlMeansDenoisingColored (leicht, h=3)
- Halo-Unterdrückung: Focus-Map-Konsistenz-Filter (Nachbarn müssen ähnliche source-index haben)
- Sättigung boost (+5%)
- Schärfen: Unsharp Mask (radius=1, amount=0.5)
```

---

## 📅 Phasen-Plan

### 🟢 Phase 0 — Projekt-Setup (Tag 1)
**Ziel:** Repo, Tooling, Skelette lauffähig

| # | Task | Details | Zeit |
|---|------|---------|------|
| 0.1 | Repo & Struktur | `projects/macrostack/`, `.gitignore`, `README.md`, `backend/`, `frontend/`, `docker/` | 1h |
| 0.2 | Backend Skelett | FastAPI App, Health-Endpoint, Config (env), CORS | 1h |
| 0.3 | Frontend Skelett | Vite + React + Tailwind + Zustand + React Router | 1h |
| 0.4 | Docker Dev-Setup | Dockerfile (backend), Dockerfile (frontend), docker-compose (Redis, backend, frontend), Caddy | 1h |
| 0.5 | CI Placeholder | GitHub Actions Workflow (Typecheck + Lint) | 0.5h |

**Deliverables:**
- `http://localhost:3722/` → React App
- `http://localhost:3723/api/health` → `{"ok":true}`
- Redis läuft, docker-compose up = alles startet

---

### 🟢 Phase 1 — Proof-of-Concept: Python Core (Tag 2-3)
**Ziel:** Algorithmus validiert, 5 echte Makro-Testbilder stacken

| # | Task | Details | Zeit |
|---|------|---------|------|
| 1.1 | Testdaten | 5-30 Makro-Testbilder organisieren (mit Stativ, versch. Fokus-Ebenen) | 0.5h |
| 1.2 | `core/preprocess.py` | Load, EXIF-Read, Normalize, Resize, Float-Konvertierung | 1.5h |
| 1.3 | `core/align.py` | ECC Alignment (Translation + Affine), Fallback ORB+RANSAC, Crop | 3h |
| 1.4 | `core/focus_measure.py` | Laplacian-Variance Berechnung, Gaussian-Smoothing, Focus-Map-Gen | 1.5h |
| 1.5 | `core/fusion.py` | Laplacian Pyramid Build + Blend + Reconstruct | 3h |
| 1.6 | `core/postprocess.py` | Denoise, Halo-Filter, Unsharp Mask, Sättigung | 1.5h |
| 1.7 | `core/pipeline.py` | Orchestriert 1.2→1.6, speichert Output, misst Laufzeit + Speicher | 1h |
| 1.8 | CLI-Test-Script | `python -m macrostack test/stack_01/` → merged.png + metrics.json | 1h |
| 1.9 | Qualitäts-Evaluation | Subjektiver Vergleich (Augen), Kanten-Check, Artefakt-Suche | 1h |

**Deliverables:**
- `backend/macrostack/core/` Modul, von CLI aufrufbar
- Merged.png aus 5 Testbildern mit sichtbar guter Qualität
- `metrics.json` mit Laufzeit, Speicher-Peak, Alignment-Erfolgsrate

**Go/No-Go:** Qualität muss subjektiv "brauchbar" sein. Keine massiven Halos, keine Misalignment-Artefakte.

---

### 🟢 Phase 2 — Worker & Job-System (Tag 4-5)
**Ziel:** Async Processing: Upload → Queue → Worker → Progress → Download

| # | Task | Details | Zeit |
|---|------|---------|------|
| 2.1 | Redis Setup | `docker-compose` redis, Connection-Pool, Health-Check | 0.5h |
| 2.2 | RQ Worker | `Worker` class that takes job_id, downloads files, runs pipeline, uploads result | 2h |
| 2.3 | `core/progress.py` | Progress-Callback: align_start/end, fusion_start/end, % pro Image | 1h |
| 2.4 | FastAPI Routes | `POST /api/jobs` (upload 30 files), `GET /api/jobs/{id}`, `GET /api/jobs/{id}/download`, `DELETE /api/jobs/{id}` | 2h |
| 2.5 | WebSocket `/ws/jobs/{id}` | Push progress events: `{step, image_current, image_total, percent}` | 1.5h |
| 2.6 | TMP-Management | `/tmp/macrostack/{job_id}/` erstellen, nach 24h oder Download auto-cleanup | 1h |
| 2.7 | File-Validation | Max 30, nur JPG/PNG/TIFF, max 100MB pro Datei, Dateigröße total prüfen | 0.5h |
| 2.8 | Error-Handling | Alignment-Fail → User-Warnung (+ trotzdem stacken), Memory-OOM → graceful error | 1.5h |

**Deliverables:**
- `POST /api/jobs` mit 10 Bildern → `202 Accepted + job_id`
- WebSocket zeigt `{step:"align", current:3, total:10, percent:30}`
- Download-Link liefert merged.png

---

### 🟢 Phase 3 — Frontend Core (Tag 6-8)
**Ziel:** Vollwertige UI mit Upload, Progress, Ergebnis

| # | Task | Details | Zeit |
|---|------|---------|------|
| 3.1 | Layout & Theme | Dark-Theme (Fotografie-App), Glassmorphism Cards, Responsive | 3h |
| 3.2 | Upload-Component | Drag+Drop Zone + File-Select, max 30, nur Images, File-Size-Preview, Remove einzelner Bilder, Reihenfolge via Drag-Sort | 4h |
| 3.3 | Zustand Store | `useJobStore`: files[], jobId, status, progress, resultUrl, errors | 2h |
| 3.4 | API-Client | `api.ts`: uploadJob(), getJobStatus(), getProgressWebSocket(), downloadResult() | 2h |
| 3.5 | Job-View (Live) | Bild-Thumbnails (Grid 5×6), Progress-Bar pro Step, "Stacken"-Button, Abbruch | 3h |
| 3.6 | Ergebnis-View | Download-Button (PNG/JPEG wählbar), Vorher/Nachher-Image-Slider, "Neuer Stack"-Button | 3h |
| 3.7 | Error-States | Upload-Fail, Alignment-Fail (Warnung mit Weiter-Option), Timeout, OOM, Netzwerk-Fail | 2h |
| 3.8 | Keyboard-Shorts | Enter→Start, Esc→Abbrechen, Ctrl+Enter→Download | 0.5h |
| 3.9 | Animations | Framer Motion: Thumbnails appear, Progress füllen, Slider-Transition | 2h |

**Deliverables:**
- Komplette UX: 30 Bilder → Drag & Drop → Start → Progress (live) → Slider-Vergleich → Download
- Fehlerfälle abgedeckt
- Responsive: Desktop + Tablet

---

### 🟢 Phase 4 — Settings & Optimierung (Tag 9-10)
**Ziel:** User-Kontrolle über Qualität, Performance-Optimierung

| # | Task | Details | Zeit |
|---|------|---------|------|
| 4.1 | Settings-Panel | Fusion-Mode (Pyramid/Weighted-Avg/Hard-Mask), Pyramid-Levels (3-7), Denoise on/off, Output-Format (PNG/JPEG/TIFF), JPEG-Qualität | 3h |
| 4.2 | Downscale-Preview | Option: erst mit 50%-Scale Preview stacken → User approved → Full-Res | 2h |
| 4.3 | C++ Binary Integration | focus-stack Binary download/compile, Subprozess-Aufruf, Output parsen, Fallback Python | 3h |
| 4.4 | Benchmark-Suite | 10/20/30 Bilder mit 12MP → Laufzeit Python vs. C++, RAM-Usage, Ergebnisqualität | 2h |
| 4.5 | Memory-Optimierung | Tile-basierte Verarbeitung (512×512 Tiles) bei >16MP Bildern, GC-Hooks | 2h |
| 4.6 | EXIF-Display | Fokus-Infos aus EXIF im Frontend anzeigen (Brennweite, Blende, Fokus-Distanz) | 1h |

**Deliverables:**
- Settings-UI funktional
- C++ Binary läuft als Beschleuniger (wenn verfügbar)
- Benchmark-Report: Laufzeit-Erwartung für 30×24MP

---

### 🟢 Phase 5 — Deploy & Polish (Tag 11-12)
**Ziel:** Live auf VPS, professioneller Eindruck

| # | Task | Details | Zeit |
|---|------|---------|------|
| 5.1 | Docker Production | Multi-Stage Builds, Non-Root User, Health-Checks, Volume für TMP | 2h |
| 5.2 | Caddy Config | `macrostack.steppa.online` → Reverse-Proxy Backend:3723 + Frontend Static Files, Let's Encrypt | 1h |
| 5.3 | Rate-Limiting | Max 3 gleichzeitige Jobs, 10 Jobs/Stunde/IP (Schutz vor Missbrauch) | 1h |
| 5.4 | Monitoring | Health-Endpoint mit Redis-Status, Disk-Space-Warning, Error-Log-Rotation | 1.5h |
| 5.5 | UI-Polish | Favicon, OG-Meta, Loading-Skeleton, Toast-Notifications, leere States, 404 | 2h |
| 5.6 | Usage-Doku | Kurzes "So funktioniert's" im Frontend, Tooltips, Best-Practice-Tipps | 1h |
| 5.7 | Smoke-Tests | 5, 15, 30 Bilder End-to-End auf Produktion getestet | 1.5h |

**Deliverables:**
- Live unter `https://macrostack.steppa.online`
- 30 Bilder Stack läuft durch ohne Fehler
- Responsive + schnell (First Contentful Paint <2s)

---

### 🟢 Phase 6 — Post-Launch Features (optional, nach Bedarf)
| # | Feature | Aufwand |
|---|---------|---------|
| 6.1 | Depth-Map Export + 3D Relief-Ansicht | 4h |
| 6.2 | Gallery / Job-History | 3h |
| 6.3 | Retusche-Pinsel (manuelle Korrektur von Artefakten) | 8h |
| 6.4 | Batch: mehrere Stacks gleichzeitig verarbeiten | 3h |
| 6.5 | GPU-Beschleunigung (OpenCL via focus-stack C++ binary) | 2h |
| 6.6 | Externe Sharing-Links (7 Tage gültig) | 2h |
| 6.7 | RAW-Unterstützung (rawpy/libraw) | 3h |

---

## 📁 Projektstruktur

```
projects/macrostack/
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── Caddyfile
├── backend/
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI App + Routes
│   │   ├── config.py            # Settings (env)
│   │   ├── routes/
│   │   │   ├── jobs.py          # POST/GET/DELETE /api/jobs
│   │   │   └── ws.py            # WebSocket /ws/jobs/{id}
│   │   ├── worker/
│   │   │   ├── __init__.py
│   │   │   ├── runner.py        # RQ Worker, Pipeline-Aufruf
│   │   │   └── progress.py      # Progress Callback
│   │   └── core/
│   │       ├── __init__.py
│   │       ├── pipeline.py      # Orchestrator
│   │       ├── preprocess.py    # Load, EXIF, Scale, Normalize
│   │       ├── align.py         # ECC + ORB Fallback
│   │       ├── focus_measure.py # Laplacian Variance
│   │       ├── fusion.py        # Laplacian Pyramid Blend
│   │       ├── postprocess.py   # Denoise, Sharpen, Halo
│   │       └── utils.py         # TMP-IO, metrics
│   └── tests/
│       ├── test_align.py
│       ├── test_fusion.py
│       └── test_pipeline.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts        # Axios/Fetch Wrapper
│       │   └── websocket.ts     # Reconnecting WS
│       ├── store/
│       │   └── jobStore.ts      # Zustand
│       ├── components/
│       │   ├── layout/          # Header, Footer, Container
│       │   ├── upload/          # DropZone, FileList, SortControls
│       │   ├── job/             # ProgressBar, ThumbnailGrid, StatusBadge
│       │   ├── result/          # ImageSlider, DownloadButton, FormatSelect
│       │   ├── settings/        # SettingsPanel, Slider, Toggle
│       │   └── ui/              # Button, Card, Toast, Skeleton, Modal
│       ├── pages/
│       │   ├── HomePage.tsx     # Upload + Start
│       │   ├── ProcessingPage.tsx  # Live Progress
│       │   └── ResultPage.tsx   # Ergebnis + Download
│       └── hooks/
│           ├── useJob.ts        # API Hooks (TanStack Query)
│           └── useWebSocket.ts  # WS Hook
└── README.md
```

---

## 🔧 Key Technical Decisions (begründet)

| Entscheidung | Begründung |
|-------------|------------|
| **FastAPI nicht Flask** | Async nativ, WebSocket nativ, Pydantic-Validation, bessere Performance |
| **RQ statt Celery** | Leichter, kein extra Broker-Tooling, gleicher Redis, ausreichend für Single-Worker |
| **OpenCV headless** | `opencv-python-headless` = kein GUI/GTK-Bloat, kleinerer Docker-Image |
| **Kein GPU/ML** | Fokus-Stacking braucht kein Deep Learning. ECC + Pyramid sind deterministisch, schnell genug |
| **C++ Binary optional** | Gut für Performance, aber Python-Fallback essentiell für Portabilität & Wartbarkeit |
| **Kein WebP** | Nicht verlustfrei genug für Makro-Fotografen-Ansprüche. PNG als Default |
| **TMP auto-cleanup** | Kein Daten-Leak. 24h Timeout oder Immediate-Delete nach Download |
| **30 Bilder hartes Limit** | UX-Simpel, Speicher kontrollierbar (30×24MP ≈ 2.1GB RAM peak) |

---

## 📊 Geschätzte Ressourcen

| Metrik | Wert |
|--------|------|
| **Entwicklungszeit** | 12 Tage (Phase 0–5) |
| **VPS RAM** | ~4GB (2.1GB Peak + 1GB OS + 1GB Redis/FastAPI) |
| **VPS Disk** | 20GB (TMP + Docker Images + OS) |
| **Pro Job (30×24MP)** | ~10–15 Min Python, ~3–5 Min C++ Binary |
| **Pro Job (30×12MP)** | ~4–6 Min Python, ~1–2 Min C++ Binary |

---

## ⚠️ Critical Path

```
Phase 0 → Phase 1 (PoC) → Phase 2 (Worker) → Phase 3 (Frontend) → Phase 4+5 parallelisierbar
                                  ↑
                           Go/No-Go nach 1.9
                           "Qualität muss brauchbar sein"
```

Falls PoC-Qualität nicht ausreicht: Zeit in Phase 1 reinvestieren (andere Fusion-Algorithmen, Tuning) bevor Frontend gebaut wird.

---

_Nächste Aktion: Bastians Go für Phase 0 + Phase 1 Start_