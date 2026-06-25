# Runpod Integration für TTS-Rendering (Lesestoff) — v2

## 🎯 Ziel
Die aktuelle TTS-Generierung läuft lokal auf CPU: **~1.7 Tokens/s mit Kartoffelbox**. Ein 28-Kapitel-Buch = ~5 Stunden. Wir nutzen stattdessen **on-demand GPU-Power (T4/A40) von Runpod**, um die Kartoffelbox-TTS-Engine für's Lesestoff-Projekt zu beschleunigen – Ziel: **10-50x Speedup**.

## 📚 Kontext
- **Projekt:** Lesestoff (Audio-TTS-Queue) — siehe `HANDOVER.md` für aktuelle Pipeline
- **Aktuelle Engine:** Kartoffelbox (Chatterbox-DE-Finetune), läuft auf CPU über `vendor/xtts/kartoffelbox-render.py`
- **Queue-Service:** `vendor/xtts/tts-queue-service.js` enqueuet Kapitel, spawnt Python-Render-Script
- **Problem:** CPU zu langsam für Batch-Rendering ganzer Bücher

---

## 🧱 Architektur (Überarbeitet)

**Prinzip:** Minimaler Footprint. Kein Volume-Gefrickel, kein SSHFS. Worker ist ein **stateless Docker-Container** der nur HTTP kennt.

```
┌─────────────────┐     POST /api/internal/...     ┌──────────────────────┐
│  Lesestoff VPS  │ ◄─────────────────────────────► │  Runpod GPU Pod     │
│  (Backend :3004)│     Jobs fetchen / Upload       │  (Docker, stateless) │
│  + :3005 intern │                                 └──────────────────────┘
└────────┬────────┘
         │
         ▼
  /srv/lesestoff/tts_audio/<book_id>/<chapter>.wav
```

### Ablauf (End-to-End)

1. User klickt **"Runpod Rendering"** im Buch-Kontext-Menü
2. Backend setzt `rendering_on_runpod=1`, erzeugt `runpod_jobs`-Eintrag (`status='pending'`)
3. Backend startet Pod via **Runpod Serverless Endpoint** (oder dedizierte GPU-Instanz)
4. Worker (Docker) startet:
   - Lädt Referenz-WAV per `GET /api/internal/tts/reference-wav`
   - Fetcht pending Jobs per `GET /api/internal/tts/jobs/:book-id`
   - Rendert Kapitel für Kapitel mit Kartoffelbox (GPU)
   - Lädt jede fertige WAV per `POST /api/internal/tts/upload` hoch
   - Sendet alle 30s **Heartbeat**: `PATCH /api/internal/runpod/job/<id>/heartbeat`
5. Nach allen Jobs: `POST /api/internal/runpod/job-finished` -> Flag zurückgesetzt, Telegram-Notify

---

## 📦 Docker-Image (CRITICAL — War in v1 nicht geplant)

**Warum:** Ohne Image muss jeder Pod `pip install torch==2.5.0+cu124 chatterbox-tts silero-vad nltk noisereduce` etc. machen = **10-15min Warm-Up** bevor auch nur ein Satz gerendert wird. Mit Image: Pod startet in <30s.

### Dockerfile (`Dockerfile.kartoffelbox-worker`)

```dockerfile
FROM pytorch/pytorch:2.5.0-cuda12.4-cudnn9-runtime

RUN apt-get update && apt-get install -y \
    ffmpeg curl python3-pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /worker

# Dependencies installieren
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modelle vor-cachen (wichtig! sonst Download zur Laufzeit)
RUN mkdir -p /root/.cache/huggingface/hub/
COPY models-cache/ /root/.cache/huggingface/hub/

# Worker-Script
COPY runpod-worker.py .

ENTRYPOINT ["python3", "runpod-worker.py"]
```

**requirements.txt:**
```
chatterbox-tts==0.2.0
silero-vad==0.0.3
nltk==3.9.4
noisereduce==3.0.3
requests==2.32.3
huggingface_hub==0.27.0
```

### Registry-Entscheidung: Kein GHCR — Runpod Template System

**Entscheidung (25.06.2026):** Wir hosten kein Image auf GHCR oder Docker Hub. Stattdessen nutzen wir **Runpod's eigenes Template-System**, das das Image direkt aus einem Git-Repo baut.

**Warum nicht GHCR?**
- Self-hosted Registry auf dem VPS würde 5-8GB Traffic *pro Pod-Start* durch den VPS jagen -> unnötig
- GHCR ist kostenlos, aber noch ein externer Service mehr im Stack
- Runpod Template = kein externer Push nötig, kein Registry-Management, kein Traffic

**Warum nicht direkt auf dem VPS hosten?**
- Docker Registry auf dem VPS = 5-8GB pro Pod-Pull *aus* dem VPS
- 50 Buecher/Monat = 250-400GB extra Traffic auf der VPS-Leitung
- VPS hat ~1Gbit, Runpod-Infrastruktur liefert schneller

**Setup via Runpod Template:**
1. Dockerfile + `runpod-worker.py` + `requirements.txt` + `models-cache/` ins Git-Repo (Branch `runpod-worker`)
2. **Runpod Console -> Templates -> Create Custom Template**
   - Container Disk: 20GB
   - Dockerfile Pfad: `Dockerfile.kartoffelbox-worker`
   - Source: Git-Repo URL + Branch `runpod-worker`
3. Runpod baut das Image selbst auf deren Infrastruktur
4. Pods referenzieren das Template statt ein externes Image

**Vorteile:**
- Kein externes Registry-Konto noetig
- Null Traffic auf dem VPS fuer Image-Pulls
- Runpod cached das Template auf deren Cluster
- Build bei jedem Git-Push automatisch (wenn gewuenscht)

**Fallback:** Wenn Runpod Template nicht funktioniert (z.B. weil CUDA-Arch anders), lokal bauen und auf **Docker Hub** (kostenlos, public) pushen als Plan B

---

## ⚡ GPU-Wahl: Serverless vs Dedicated (Update zu v1)

### Empfehlung: **Runpod Serverless Endpoint**

| Kriterium | Dedicated GPU | Serverless Endpoint |
|-----------|--------------|-------------------|
| Startup | 2-3 Min (Pod booten) | ~5-10s (Cold Start) |
| Pricing | $0.49-0.79/h (A40) rund um die Uhr | ~$0.38/h (A40) **nur für Rechenzeit** |
| Management | Start/Stop/Terminate selbst | Einmal konfigurieren, API callt Endpoint |
| Idle-Kosten | Läuft weiter wenn Job fertig | 0 (automatisch runter) |
| Max Execution | Keine Limit | 15 Minuten pro Request (⚠️) |

**Problem mit Serverless:** 15-Minuten-Limit pro Request. Ein ganzes Buch (28 Kapitel x ~3 Min GPU pro Kapitel = ~84 Min) geht nicht in einem Request.

**Lösung Hybrid:**
- **Pro Kapitel ein Serverless Request** (jedes Kapitel <15 Min auf GPU)
- Worker orchestriert: Request pro Kapitel, nach jedem Ergebnis zurück zum Backend
- Oder: **Dedicated Spot Instance** wenn viele Kapitel -> günstiger als viele Einzel-Requests

**Tabelle Kostenabschätzung (fehlte in v1):**

| Szenario | GPU | Speedup | Zeit/Buch | Kosten/Buch |
|----------|-----|---------|-----------|-------------|
| CPU (aktuell) | ❌ | 1x | ~5 Std | 0 |
| T4 (dedicated) | 16GB VRAM | ~20x | ~15 Min | ~$0.06-0.10 |
| A40 (dedicated) | 48GB VRAM | ~30-40x | ~8 Min | ~$0.06-0.12 |
| T4 (Serverless) | 16GB VRAM | ~20x | ~15 Min | ~$0.08-0.15 |
| A40 (Serverless) | 48GB VRAM | ~30-40x | ~8 Min | ~$0.10-0.20 |

**Pro Monat bei 50 Büchern:** $3-10. Lächerlich little im Vergleich zum Speedup.

**Empfehlung:** T4 Spot Instance, weil Kartoffelbox ~2.5GB VRAM braucht -> T4 (16GB) völlig ausreichend. A40 nur wenn wir mehrere parallele Render-Jobs wollen.

---

## 🤖 Worker-Script (`runpod-worker.py`)

Ersetzt das in v1 vorgeschlagene `runpod_client.py` + `runpod_kartoffelbox_worker.py` + Volume-Setup durch **eine Datei, stateless**.

```python
#!/usr/bin/env python3
"""
Runpod Kartoffelbox Worker — Läuft im Docker-Container auf GPU.
Holt Jobs per HTTP vom Lesestoff-Backend, rendert mit Kartoffelbox, lädt zurück.
"""

import argparse, json, os, sys, time, requests
from pathlib import Path
import numpy as np
import torch
import nltk
from nltk.tokenize import sent_tokenize
from chatterbox import ChatterboxTTS
from silero_vad import load_silero_vad, get_speech_timestamps
import noisereduce as nr

nltk.download('punkt_tab', quiet=True)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://127.0.0.1:3005")
API_TOKEN = os.environ.get("POD_API_TOKEN", "")
BOOK_ID = os.environ.get("BOOK_ID", "")
VOICE_ID = os.environ.get("VOICE_ID", "kartoffelbox-hoffmann")
JOB_RUN_ID = os.environ.get("JOB_RUN_ID", "")

HEADERS = {"Authorization": f"Bearer {API_TOKEN}"}

def api_get(path):
    r = requests.get(f"{BACKEND_URL}{path}", headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()

def api_post(path, data=None, files=None):
    r = requests.post(f"{BACKEND_URL}{path}", headers=HEADERS, json=data, files=files, timeout=60)
    r.raise_for_status()
    return r.json()

def heartbeat():
    api_post(f"/api/internal/runpod/{JOB_RUN_ID}/heartbeat")
    print("[heartbeat] OK")

def load_reference_wav(path):
    """Lädt Referenz-WAV — entweder lokal oder per HTTP vom Backend."""
    if Path(path).exists():
        return path
    r = requests.get(f"{BACKEND_URL}/api/internal/tts/reference-wav", headers=HEADERS, stream=True)
    r.raise_for_status()
    local_path = "/tmp/reference.wav"
    with open(local_path, "wb") as f:
        f.write(r.content)
    return local_path

def render_chapter(chapter_text, ref_wav, chapter_index, max_chars=250):
    """Ein Kapitel rendern — Satz für Satz mit Kartoffelbox."""
    torch.manual_seed(42)
    np.random.seed(42)

    model = ChatterboxTTS.from_local(
        "/root/.cache/huggingface/hub/models--ResembleAI--chatterbox/snapshots/5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18",
        "cuda"
    )
    model.load_checkpoint(
        "/root/.cache/huggingface/hub/models--SebastianBodza--Kartoffelbox-v0.1/snapshots/"
        "6e4fc76c7a7fe3984acc122141d6ad1ef2bbc002/t3_cfg.safetensors"
    )

    sentences = sent_tokenize(chapter_text)
    fragments = []
    for sent in sentences:
        if len(sent) > max_chars:
            fragments.extend(sent.split(", "))
        else:
            fragments.append(sent)

    audio_segments = []
    silero_vad = load_silero_vad()

    for i, frag in enumerate(fragments):
        print(f"  Fragment {i+1}/{len(fragments)} ({len(frag)} chars)")
        tokens = min(1000, max(int(len(frag) * 2.5), 200))

        audio = model.t3.inference(
            text=frag,
            reference=ref_wav,
            max_new_tokens=tokens,
            language="de",
        )

        # Silero VAD Trim
        timestamps = get_speech_timestamps(
            audio, silero_vad, threshold=0.3, min_speech_duration_ms=50
        )
        if timestamps:
            start = max(0, timestamps[0]["start"] - 50)
            end = min(len(audio), timestamps[-1]["end"] + 50)
            audio = audio[start:end]

        audio_segments.append(audio)

    if not audio_segments:
        return None

    full_audio = np.concatenate(audio_segments)

    # NoiseReduce
    full_audio = nr.reduce_noise(y=full_audio, sr=24000, prop_decrease=0.6)

    return full_audio

def upload_wav(audio_array, book_id, chapter_index, sample_rate=24000):
    """WAV als Multipart-Form-Data ans Backend schicken."""
    import io, wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes((audio_array * 32767).astype(np.int16).tobytes())
    buf.seek(0)

    api_post(
        "/api/internal/tts/upload",
        files={
            "file": (f"{book_id}_{chapter_index}.wav", buf, "audio/wav"),
            "book_id": (None, book_id),
            "chapter_index": (None, str(chapter_index)),
            "job_run_id": (None, JOB_RUN_ID),
        }
    )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--book-id", default=BOOK_ID)
    parser.add_argument("--voice-id", default=VOICE_ID)
    parser.add_argument("--job-run-id", default=JOB_RUN_ID)
    args = parser.parse_args()

    print(f"[worker] Start — book={args.book_id}, voice={args.voice_id}")

    # 1. Referenz-WAV holen
    ref_path = load_reference_wav(f"/tmp/reference_{args.voice_id}.wav")
    print("[worker] Reference WAV ready")

    # 2. Pending Jobs fetchen
    jobs = api_get(f"/api/internal/tts/jobs/{args.book_id}")
    print(f"[worker] Got {len(jobs)} pending jobs")

    last_heartbeat = time.time()
    for job in jobs:
        chapter_index = job["chapter_index"]
        chapter_text = job["text"]

        print(f"[worker] Rendering chapter {chapter_index}...")

        try:
            audio = render_chapter(chapter_text, ref_path, chapter_index)
            if audio is None:
                print("[worker]   WARNING: No audio generated, skipping")
                continue

            upload_wav(audio, args.book_id, chapter_index)
            print(f"[worker]   OK Chapter {chapter_index} uploaded")

        except Exception as e:
            print(f"[worker]   ERROR Chapter {chapter_index} failed: {e}")
            api_post(f"/api/internal/tts/job/{job['id']}/error", {"error": str(e)})

        # Heartbeat alle 30s
        if time.time() - last_heartbeat > 30:
            heartbeat()
            last_heartbeat = time.time()

    # 3. Fertig melden
    api_post(f"/api/internal/runpod/{JOB_RUN_ID}/finished", {
        "book_id": args.book_id,
        "status": "completed"
    })
    print("[worker] OK All done")

if __name__ == "__main__":
    main()
```

---

## 🖥️ Backend-Änderungen (Server-seitig)

### Neuer interner Port :3005

**Warum:** Die internen Endpunkte (`/api/internal/tts/upload`, `/api/internal/tts/jobs/...`) dürfen nicht auf demselben Port wie das Frontend laufen. Wenn das `POD_API_TOKEN` leaket, kann sonst jeder Content abgreifen oder Dateien hochladen.

```js
// server.js — zusätzliches Express-Listening
const internalApp = express();
internalApp.use(express.json({ limit: '500mb' }));
internalApp.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Auth-Middleware für interne API
internalApp.use('/api/internal', (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.POD_API_TOKEN) {
    return res.status(403).json({ error: 'unauthorized' });
  }
  next();
});

// Nur localhost erreichbar (kein externer Zugriff)
internalApp.listen(3005, '127.0.0.1', () => {
  console.log('Internal API on :3005');
});
```

### Endpunkte

| Route | Port | Methode | Beschreibung |
|-------|------|---------|-------------|
| `POST /api/books/:id/tts/runpod-start` | 3004 | User | Startet Runpod-Job (setzt Flag, triggert Pod-Start) |
| `POST /api/books/:id/tts/runpod-cancel` | 3004 | User | Bricht Job ab |
| `GET /api/books/:id/tts/runpod-status` | 3004 | User | Job-Status + Kosten + Heartbeat-Timestamp |
| `GET /api/internal/tts/jobs/:book-id` | 3005 | Worker | Pending Jobs (JSON-Liste) |
| `GET /api/internal/tts/reference-wav` | 3005 | Worker | Referenz-WAV als octet-stream |
| `POST /api/internal/tts/upload` | 3005 | Worker | Multipart-Form-Data: WAV + Book-ID + Chapter-Index |
| `POST /api/internal/tts/job/:id/error` | 3005 | Worker | Fehlerstatus für Einzel-Job |
| `PATCH /api/internal/runpod/:jobRunId/heartbeat` | 3005 | Worker | Heartbeat (alle 30s) |
| `POST /api/internal/runpod/:jobRunId/finished` | 3005 | Worker | Job komplett abgeschlossen |

### Neue Tabelle

```sql
CREATE TABLE IF NOT EXISTS runpod_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_run_id TEXT UNIQUE NOT NULL,
  book_id TEXT NOT NULL,
  voice_id TEXT NOT NULL DEFAULT 'kartoffelbox-hoffmann',
  status TEXT DEFAULT 'pending',
  instance_id TEXT,
  started_at DATETIME,
  finished_at DATETIME,
  last_heartbeat DATETIME,
  total_gpu_seconds REAL DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  error_message TEXT,
  book_title TEXT,
  total_chapters INTEGER DEFAULT 0,
  completed_chapters INTEGER DEFAULT 0,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
```

### Queue-Service-Änderung

```javascript
// vendor/xtts/tts-queue-service.js
// Vor lokalem Render: Prüfen ob aktiver Runpod-Job existiert
const activePodJob = db.prepare(`
  SELECT id FROM runpod_jobs
  WHERE book_id = ? AND status IN ('pending', 'running')
  AND (last_heartbeat IS NULL OR last_heartbeat > datetime('now', '-10 minutes'))
`).get(job.book_id);

if (activePodJob) {
  console.log(`[queue] Skipping book ${job.book_id} — active Runpod job #${activePodJob.id}`);
  return;
}
```

### Heartbeat-Stale-Erkennung (Cron, alle 5 Min)

```javascript
// In server.js oder separatem Cron
const staleJobs = db.prepare(`
  UPDATE runpod_jobs SET status = 'stale', error_message = 'Heartbeat expired (10 min)'
  WHERE status = 'running'
  AND (last_heartbeat IS NULL OR last_heartbeat < datetime('now', '-10 minutes'))
`).run();
// -> Buch wird automatisch für lokale Verarbeitung freigegeben
```

---

## 🖥️ UI/UX — Komplett-Design

**Grundsatz:** Der User muss jederzeit wissen:
1. Läuft ein Runpod-Job? (Status auf der Buch-Card)
2. Wie weit ist er? (Fortschritt im Dashboard)
3. Was kostet das? (Kosten vor Start + live im Dashboard)
4. Kann ich abbrechen? (Cancel-Button, sofort sichtbar)

Der bestehende `RenderDashboard.tsx` wird **nicht** ersetzt – wir integrieren einen Runpod-Tab **daneben** (Toggle zwischen Kartoffelbox-CPU-Queue und Runpod-GPU-Queue).

---

### Buch-Card: Status-Badge

Jede Buch-Card bekommt **einen** von drei Badges, nie mehrere (kein Badge-Salat):

| Badge | Farbe | Wann? |
|-------|-------|-------|
| 🚀 *GPU* | Neon-Grün (500) | `runpod_jobs.status = 'running'` |
| 💤 *GPU* | Gedämpftes Grün (400) | `runpod_jobs.status = 'pending'` (Pod bootet) |
| ❌ *GPU* | Rot (500) | `runpod_jobs.status = 'failed'` |

Positionierung: **Rechts unten auf dem Cover**, überlappend, mit backdrop-blur.

```tsx
// BookshelfGrid.tsx — Badge-Komponente
function RunpodBadge({ status }: { status: string | null }) {
  if (!status) return null

  const badgeStyles: Record<string, string> = {
    running: 'bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/30',
    pending: 'bg-emerald-400/70 text-white',
    completed: 'bg-emerald-500/80 text-white',
    failed: 'bg-red-500/80 text-white',
    cancelled: 'bg-gray-500/50 text-gray-200',
    stale: 'bg-amber-500/70 text-white',
  }

  const labels: Record<string, string> = {
    running: '🚀 GPU',
    pending: '💤 GPU',
    completed: '✅ GPU',
    failed: '❌ GPU',
    cancelled: '⊘ GPU',
    stale: '⚠️ GPU',
  }

  return (
    <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold backdrop-blur-sm ${badgeStyles[status] || ''}`}>
      {labels[status] || status}
    </div>
  )
}
```

Badge wird via `GET /api/books/:id/tts/runpod-status` geladen, als paralleler Query auf TanStack Query (zusätzlich zum book-Query). Kein Blockieren der Bookcard-Render.

---

### Context-Menü: "🚀 Runpod Rendering" + Bestätigungsdialog

Der bestehende Context-Menü-Eintrag im `BookCard` (nach Kartoffelbox-Vorrendern):

```tsx
// In BookshelfGrid.tsx — BookCard
<button
  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
  onClick={(e) => {
    e.stopPropagation()
    setShowMenu(false)
    setIsRunpodConfirmOpen(true)
  }}
  disabled={runpodStatus === 'running' || runpodStatus === 'pending'}
>
  🚀 Runpod Rendering
</button>
```

**Cost-Estimator-Dialog (NEU):** Kein einfacher Toast – ein Modal mit Kostenschätzung:

```tsx
function RunpodConfirmDialog({ book, onConfirm, onCancel }) {
  const { data: estimate } = useQuery({
    queryKey: ['runpod-estimate', book.id],
    queryFn: () => ttsApi.runpodCostEstimate(book.id),
  })

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🚀 Runpod GPU-Rendering</DialogTitle>
          <DialogDescription>
            {book.title} — {book.totalChapters} Kapitel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Geschätzte Dauer</span>
            <span className="font-mono">{estimate?.estimated_minutes || '...'} Min</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Geschätzte Kosten</span>
            <span className="font-mono text-emerald-500 font-bold">~${estimate?.estimated_cost || '...'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">GPU Typ</span>
            <span className="font-mono">NVIDIA T4</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stimme</span>
            <span className="font-mono">Kartoffelbox Hoffmann</span>
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
            ⚡ CPU-Vergleich: ~5h -> ~15 Min. Deine Ohren werden es dir danken.
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
          <Button onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-700">
            🚀 GPU-Rendering starten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Cost-Estimate Endpoint:**
```
GET /api/books/:id/tts/runpod-estimate
-> { estimated_cost: number, estimated_minutes: number, gpu_type: string }
```
Berechnung: `totalChapters * avgChapterChars * 0.003 (GPU-Sekunden pro Char auf T4) * 0.000095 ($ pro GPU-Sekunde)`

---

### RenderDashboard.tsx — Runpod-Tab (erweitert)

Der bestehende RenderDashboard hat nur die Kartoffelbox-Queue. Wir fügen einen **Toggle/Tab** hinzu:

```tsx
// RenderDashboard.tsx — neuer State
const [activeTab, setActiveTab] = useState<'local' | 'runpod'>('local')

// Tab-Header
<div className="flex gap-2 px-6 pt-4 shrink-0">
  <button
    onClick={() => setActiveTab('local')}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === 'local'
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted text-muted-foreground hover:bg-muted/80'
    }`}
  >
    ⚡ Kartoffelbox (CPU)
  </button>
  <button
    onClick={() => setActiveTab('runpod')}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      activeTab === 'runpod'
        ? 'bg-emerald-600 text-white shadow-md'
        : 'bg-muted text-muted-foreground hover:bg-muted/80'
    }`}
  >
    🚀 Runpod GPU {runpodJob && `(${runpodJob.completed_chapters}/${runpodJob.total_chapters})`}
  </button>
</div>
```

Der Runpod-Tab zeigt eine **Prozess-Ansicht** (keine Chapter-Liste, sondern Fortschrittstracker):

```tsx
function RunpodTab({ runpodJob, onCancel, onRefetch }) {
  const elapsed = runpodJob.started_at
    ? formatDuration(Date.now() - new Date(runpodJob.started_at).getTime())
    : '--'

  const estimatedCost = runpodJob.total_gpu_seconds
    ? (runpodJob.total_gpu_seconds * 0.000095).toFixed(4)
    : '0.00'

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* Status Card */}
      <div className={`rounded-xl border p-6 ${
        runpodJob.status === 'running'
          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
          : runpodJob.status === 'failed'
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200'
            : 'bg-card'
      }`}>
        {/* Header: Status + Zeit */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {runpodJob.status === 'running' && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute h-3 w-3 rounded-full bg-emerald-400 opacity-75" />
                <span className="relative rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            )}
            <h3 className="font-semibold">
              {runpodJob.status === 'running' && 'GPU Rendering läuft...'}
              {runpodJob.status === 'pending' && 'Pod wird gestartet...'}
              {runpodJob.status === 'completed' && '✅ Fertig!'}
              {runpodJob.status === 'failed' && '❌ Fehlgeschlagen'}
              {runpodJob.status === 'cancelled' && '⊘ Abgebrochen'}
              {runpodJob.status === 'stale' && '⚠️ Verbindung verloren'}
            </h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{elapsed}</span>
        </div>

        {/* Chapter Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Kapitel</span>
            <span className="font-mono">{runpodJob.completed_chapters} / {runpodJob.total_chapters}</span>
          </div>
          <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
              initial={{ width: 0 }}
              animate={{ width: `${runpodJob.total_chapters > 0
                ? (runpodJob.completed_chapters / runpodJob.total_chapters) * 100
                : 0}%`
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg bg-white/50 dark:bg-black/10 p-3">
            <p className="text-xs text-muted-foreground">GPU Typ</p>
            <p className="text-sm font-mono font-medium">NVIDIA T4</p>
          </div>
          <div className="rounded-lg bg-white/50 dark:bg-black/10 p-3">
            <p className="text-xs text-muted-foreground">GPU-Sekunden</p>
            <p className="text-sm font-mono font-medium">{runpodJob.total_gpu_seconds?.toFixed(1) || '0'}s</p>
          </div>
          <div className="rounded-lg bg-white/50 dark:bg-black/10 p-3">
            <p className="text-xs text-muted-foreground">Geschätzte Kosten</p>
            <p className="text-sm font-mono font-medium text-emerald-600 dark:text-emerald-400">~${estimatedCost}</p>
          </div>
          <div className="rounded-lg bg-white/50 dark:bg-black/10 p-3">
            <p className="text-xs text-muted-foreground">Letzter Heartbeat</p>
            <p className="text-sm font-mono font-medium">
              {runpodJob.last_heartbeat
                ? formatRelativeTime(runpodJob.last_heartbeat)
                : '--'}
            </p>
          </div>
        </div>

        {/* Error message */}
        {runpodJob.error_message && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
            <p className="font-medium">Fehler:</p>
            <p className="font-mono text-xs mt-1">{runpodJob.error_message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {runpodJob.status === 'running' && (
            <Button variant="destructive" size="sm" onClick={onCancel} className="flex items-center gap-1">
              <Ban className="h-4 w-4" />
              Rendern abbrechen
            </Button>
          )}
          {['failed', 'cancelled', 'stale'].includes(runpodJob.status) && (
            <Button variant="outline" size="sm" onClick={() => handleStartRunpod(bookId)} className="flex items-center gap-1">
              <RotateCcw className="h-4 w-4" />
              Neu starten
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRefetch}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Live Activity Log (nur wenn running) */}
      {runpodJob.status === 'running' && runpodJob.logs?.length > 0 && (
        <div className="rounded-xl border bg-black/5 dark:bg-white/5 p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Aktuelle Aktivität
          </h4>
          <div className="space-y-1 max-h-40 overflow-y-auto font-mono text-xs">
            {runpodJob.logs.slice(-20).map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">{log.timestamp}</span>
                <span className={log.level === 'error' ? 'text-red-500' : 'text-foreground'}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback: noch nie gestartet */}
      {!runpodJob && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <Rocket className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-semibold mb-2">Noch nie GPU-Rendering gestartet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Rendere dieses Buch auf einer NVIDIA T4 GPU – ~15 Min statt ~5h auf CPU.
          </p>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handleStartRunpod(bookId)}
          >
            🚀 GPU-Rendering starten
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

### Neue API-Methods (client.ts)

```typescript
// In ttsApi:

runpodStart: (bookId: string) =>
  fetchJSON<{ jobRunId: string; message: string }>(`/api/books/${bookId}/tts/runpod-start`, {
    method: 'POST',
  }),

runpodCancel: (bookId: string) =>
  fetchJSON<{ message: string }>(`/api/books/${bookId}/tts/runpod-cancel`, {
    method: 'POST',
  }),

runpodStatus: (bookId: string) =>
  fetchJSON<RunpodJob | null>(`/api/books/${bookId}/tts/runpod-status`),

runpodCostEstimate: (bookId: string) =>
  fetchJSON<{ estimated_cost: number; estimated_minutes: number; gpu_type: string }>(
    `/api/books/${bookId}/tts/runpod-estimate`
  ),
```

Typdefinitionen (`types/tts.ts`):

```typescript
export interface RunpodJob {
  id: number
  job_run_id: string
  book_id: string
  voice_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'stale'
  started_at: string | null
  finished_at: string | null
  last_heartbeat: string | null
  total_gpu_seconds: number
  cost_usd: number
  error_message: string | null
  book_title: string
  total_chapters: number
  completed_chapters: number
  logs?: Array<{ timestamp: string; level: string; message: string }>
}
```

---

### Neue Store-States (ui-store.ts)

```typescript
interface UIState {
  // ... bestehende Felder

  runpodStatusByBook: Record<string, string | null>
  setRunpodStatus: (bookId: string, status: string | null) => void
}
```

---

### Hook: useRunpod.ts (NEU)

Analog zu `useTtsRender.ts`:

```typescript
// hooks/useRunpod.ts

export function useRunpodStatus(bookId: string | null) {
  return useQuery({
    queryKey: ['runpod-status', bookId],
    queryFn: () => ttsApi.runpodStatus(bookId!),
    enabled: !!bookId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'running' || data?.status === 'pending') return 5000
      return false
    },
  })
}

export function useRunpodStart(bookId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => ttsApi.runpodStart(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runpod-status', bookId] })
    },
  })
}

export function useRunpodCancel(bookId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => ttsApi.runpodCancel(bookId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runpod-status', bookId] })
    },
  })
}

export function useRunpodCostEstimate(bookId: string) {
  return useQuery({
    queryKey: ['runpod-estimate', bookId],
    queryFn: () => ttsApi.runpodCostEstimate(bookId),
    enabled: !!bookId,
    staleTime: 1000 * 60 * 5,
  })
}
```

Polling-Intervall: **alle 5s während running/pending**, stoppt bei completed/failed/cancelled.

---

### Telegram-Notify (UX-Design)

Kein Spam. Drei Benachrichtigungen maximal:

| Event | Text | Wann? |
|-------|------|-------|
| ✅ Fertig | `✅ GPU fertig: "Der Process" (12/12 Kap, ~$0.08, 14 Min)` | Job completed |
| ❌ Fehler | `❌ GPU fehlgeschlagen: "Der Process" - OOM auf T4 (Job #42). Lokale CPU uebernimmt.` | Job failed |
| ⚠️ Kosten > $0.50 | `⚠️ GPU Kosten: "Grosses Buch" (45 Kap) = $0.62 - ungewoehnlich.` | Nur wenn teurer als erwartet |

Kein "Pod gestartet"-Notify, kein "50% fertig"-Notify, kein Heartbeat-Notify.

---

### Micro-interactions & Animations

- **Button Loading State:** Beim Klick auf "GPU-Rendering starten" -> Button zeigt `Loader2` mit "Pod wird gestartet..."
- **Badge Fade-In:** Der GPU-Badge erscheint mit fade-in + scale sobald Runpod-Job aktiv ist
- **Dashboard Tab Switch:** Smooth transition zwischen Local/Runpod-Tab (Framer Motion `AnimatePresence`)
- **Progress Bar:** Gradient animation (emerald-400 -> emerald-600) zeigt live-Fortschritt
- **Pulsing Dot:** Rotes Pulsing-Dot bei 'failed' Status im Dashboard-Tab
- **Cost Display:** Grun wenn < $0.10, Gelb wenn $0.10-$0.50, Rot wenn > $0.50

---

### Edge Cases & Fehlerbehandlung

| Fall | UX |
|------|-----|
| Runpod-API-Key fehlt | Menue-Eintrag disabled mit Tooltip "Runpod nicht konfiguriert" |
| Pod startet nicht (Timeout 5 Min) | Badge auf 'failed', Dashboard zeigt Fehler + Retry-Button |
| Worker crasht nach 170/200 Kapiteln | Fertige Kapitel bleiben erhalten. Retry setzt nur fehlende fort. |
| Kosten > 200% des Estimates | Gelbe/Rote Cost-Farbe im Dashboard + Telegram-Alert |
| Gleichzeitiger CPU+GPU Zugriff | Queue-Service blockt CPU-Job. Badge zeigt "🚀 GPU aktiv" |
| Dashboard geoeffnet ohne Runpod-Job | Empty-State mit "Noch nie gestartet" + Start-Button |
| Mehrere Buecher gleichzeitig | Backend erlaubt nur **einen** aktiven Job. Warnung im UI |

---

### UX-Zusammenfassung

1. **Bookshelf:** Buch-Card hat grunen "🚀 GPU"-Badge wenn Job lauft
2. **Context-Menue:** "🚀 Runpod Rendering" -> Klick offnet Cost-Estimator-Dialog
3. **Cost-Estimator:** Schatzung + Bestatigung -> Start
4. **RenderDashboard (NEUER TAB):** "🚀 Runpod GPU (5/28)" mit Live-Fortschritt + Kosten + Cancel
5. **Telegram:** Nur bei Fertig/Fehler/Kostenwarnung

---

## 🔐 Sicherheit

| Massnahme | Status |
|----------|--------|
| Interne API nur auf `127.0.0.1:3005` | ✅ Explizit so designed |
| `POD_API_TOKEN` in `.secrets/runpod.env` | ✅ Ausgelagert |
| Worker lauft als non-root im Container | ✅ Im Dockerfile setzen |
| HMAC-Signatur fuer Upload-Integritaet | ⚠️ Nice-to-have, erstmal nicht noetig |
| IP-Whitelist fuer Worker (fest vergeben) | ✅ Pod-IP logged, aber auth reicht |

---

## 🧪 Test-Strategie

1. **Lokal mit CPU-Test:**
   ```bash
   BACKEND_URL=http://localhost:3005 POD_API_TOKEN=test docker run --rm \
     -e BOOK_ID=test-book-001 \
     steppa303/kartoffelbox-worker:latest \
     --book-id test-book-001
   ```

2. **GPU-E2E mit Test-Buch (<5 Min Audio):**
   - Runpod Dedicated Instance mit `steppa303/kartoffelbox-worker:latest` starten
   - Worker rendert 2-3 Kapitel
   - Verify: WAVs in `/srv/lesestoff/tts_audio/test-book/` + DB-Status `completed`

3. **Beta-Phase:**
   - Nur Buecher > 30 Min Audio
   - Feature-Flag in `books`-Tabelle (`allow_runpod BOOLEAN DEFAULT FALSE`)
   - Manuelles Freischalten nach erfolgreichem Beta-Test

---

## 📅 Zeitplan (1 Woche statt 3 in v1)

| Tag | Meilenstein |
|-----|-------------|
| Tag 1 | Docker-Image bauen + auf GHCR pushen + Worker-Script schreiben |
| Tag 2 | Backend-Endpunkte (`server.js`): :3005 internal, Upload, Jobs, Heartbeat |
| Tag 3 | Queue-Service-Patch + UI-Integration (Button + Badge + Dashboard-Tab + useRunpod Hook) |
| Tag 4 | E2E-Test auf Runpod (Test-Buch) + Heartbeat-Stale-Cron + Kosten-Logging |
| Tag 5 | Beta-Freischaltung, Doku, Monitoring, Deployment |

---

## 🗑️ Was aus v1 gestrichen wurde (und warum)

| v1-Komponente | Status | Grund |
|---------------|--------|-------|
| `runpod_client.py` | ❌ Gestrichen | Kein separates Modul noetig -- Worker ist standalone |
| Volume/SSHFS | ❌ Gestrichen | Stateless HTTP-Transfer reicht. WAVs sind ~MB gross |
| `runpod_jobs` Cost-Alert bei >$5 | ❌ Gestrichen | Buecher kosten max $0.20 -- Alert unnoetig |
| Beta-memory-Tag | ❌ Gestrichen | DB-Flag reicht |
| 3-Wochen-Timeline | ❌ Gestrichen | 1 Woche realistisch |
| A40 als primaere GPU | ❌ Gestrichen | T4 reicht (16GB VRAM > Modell 2.5GB) |
| Offene Fragen/Entscheidungen | ❌ Gestrichen | Alle Entscheidungen hier getroffen |

---

## 💡 Fazit

Der v1-Plan hatte die richtige Idee, aber war aufgeblaht mit Volumes, SSHFS, separaten Python-Modulen und viel zu konservativer Timeline. Die Realitat ist:

- **Ein Docker-Image** lost 80% der Probleme (Startup-Zeit, Reproduzierbarkeit, Dependencies)
- **HTTP-Transfer** statt Volume = weniger Abhaengigkeiten, kein Mount-Overhead, stateless
- **Heartbeat + Stale-Erkennung** verhindert Blockaden und verschwendete GPU-Zeit
- **T4 > A40** fuer unseren Use-Case (Modell ist klein, VRAM reicht dicke)
- **~$5-10/Monat** fuer 50 Buecher -- das ist nix. CPU-Speedup von 5h -> 15min pro Buch ist den Euro wert.

**Wenn ich das umsetzen soll: Sag Bescheid. Anfang naechster Woche koennte das live sein.**