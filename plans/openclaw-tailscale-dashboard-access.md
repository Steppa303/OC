# OpenClaw Dashboard – Zugriff von allen Tailscale-Geräten

> Erstellt: 2026-06-19 | Author: Plan-Orchestrator | Status: Proposal

---

## 1. Aktuelle Situation

**Gateway-Konfiguration (aktuell):**

| Key | Value |
|-----|-------|
| `gateway.bind` | `tailnet` |
| `gateway.port` | `18789` |
| `gateway.auth.mode` | `token` |
| `gateway.tailscale.mode` | `off` |
| `gateway.controlUi.allowInsecureAuth` | `true` |
| `gateway.controlUi.basePath` | `/openclaw` |

**Aktuelle Dashboard-URL:** `http://100.80.60.59:18789/openclaw/`

**Problem:** Die URL funktioniert nur, wenn der Token im URL steht. `openclaw dashboard` baut lokal den Token ein, aber auf iPad/MacBook/Phone muss man den Token manuell eintippen oder aus einem anderen Gerät kopieren.

**Tailscale-Devices:**
- `vmd190638` (VPS) — `100.80.60.59`
- `ipad-pro-12-9-gen-3` — `100.69.42.103`
- `macbook-pro-von-bastian` — `100.113.191.74`
- `pixel-10-pro` — `100.90.241.34`

**Caddyfile (relevant):** `dashboard.steppa.online` served bereits das **agent-dashboard** (localhost:3005) — das ist eine *andere* App als das OpenClaw Control UI (Gateway auf :18789). Diese Domain existiert bereits mit selbstsigniertem Zertifikat.

---

## 2. Optionenbewertung

### Option A: Tailscale Serve (Empfohlen)

Gateway auf `loopback` binden, Tailscale Serve übernimmt HTTPS und Routing.

**Config:**
```json5
{
  gateway: {
    bind: "loopback",
    port: 18789,
    tailscale: { mode: "serve" },
    auth: {
      mode: "token",
      token: "0adfb5...",
      allowTailscale: true,
    },
    controlUi: {
      allowInsecureAuth: true,
      basePath: "/openclaw",
    },
  },
}
```

**URL:** `https://vmd190638.tail2f1fb9.ts.net/openclaw/`

**Pros:**
- Keine öffentliche Exposure — nur Tailnet-Geräte
- HTTPS automatisch via Tailscale (managed TLS, valide Certs)
- `allowTailscale: true` → Tailscale Identity Headers erlauben passwortlosen Login
- Keine Caddy-Änderungen nötig
- Einfachster Rollback (Config zurück, `tailscale serve status` reset)
- Funktioniert auf iPad/MacBook/Android sofort via Safari/Browser
- OpenClaw managed `tailscale serve` automatisch (start/stopp mit Gateway)

**Cons:**
- URL ist die MagicDNS-Hostname (nicht custom domain)
- Einrichtung minimal: muss Config ändern + Gateway neustarten
- Tailscale muss auf allen Clients installiert und eingeloggt sein (ist bereits der Fall)

**Security:**
- ✅ Tailnet-only (kein öffentlicher Zugriff)
- ✅ HTTPS via Tailscale
- ✅ `allowTailscale: true` prüft `tailscale whois` auf X-Forwarded-For → sicher gegen Spoofing
- ⚠️ Token bleibt als Fallback für Non-Tailscale-Clients
- ✅ Kein zusätzlicher Caddy-Eintrag = kleinere Attack Surface

---

### Option B: Tailscale Serve + Service Name

Wie Option A, aber mit einem benannten Service für eine schönere URL.

**Config:**
```json5
{
  gateway: {
    bind: "loopback",
    port: 18789,
    tailscale: {
      mode: "serve",
      serviceName: "svc:openclaw",
    },
  },
}
```

**URL:** `https://openclaw.tail2f1fb9.ts.net/openclaw/`

**Pros:**
- Schönere, merkbare URL
- Alle Vorteile von Option A

**Cons:**
- VPS muss ein **tagged node** in der Tailscale Admin Console sein (z.B. `tag:openclaw`)
- Service muss in der Admin Console approved werden
- Tailscale tagged nodes können keine User ACLs mehr nutzen (separates ACL-Management)
- Komplexerer Setup, mehr Verwaltungsaufwand
- Bei Tailscale-Admin-Console kein direkter CLI-Zugriff → manuell via Web-UI

**Security:**
- ✅ Tailnet-only
- ⚠️ Tagged node umgeht user-basierte ACLs → Risk, wenn ACLs wichtig sind
- ⚠️ Mehr Config-Fehlerquellen

---

### Option C: Caddy Reverse Proxy auf Tailnet-IP

Gateway bleibt auf `tailnet`-Bind, Caddy served zusätzlich als Reverse Proxy.

**Caddy-Eintrag (new subdomain oder Erweiterung von dashboard.steppa.online):**
```caddy
openclaw.steppa.online {
    reverse_proxy 100.80.60.59:18789

    # Wenn basePath /openclaw:
    handle_path /openclaw/* {
        reverse_proxy 100.80.60.59:18789
    }
}
```

**URL:** `https://openclaw.steppa.online/openclaw/`

**Pros:**
- Custom Domain
- Vollständige Kontrolle über TLS (Let's Encrypt)
- Kann mit anderen Services kombiniert werden

**Cons:**
- ❌ Öffentlich exponiert! Jeder, der die Domain errät, kann auf den Login-Screen
- ❌ WebSocket-Support muss explizit konfiguriert werden (OpenClaw braucht WS)
- SSL-Zertifikat selbst verwalten (Caddy macht auto, aber Domain muss öffentlich sein)
- Caddy-Änderung + Restart nötig
- Token-Auth ist der einzige Schutz vor öffentlichem Zugriff
- `dashboard.steppa.online` ist bereits belegt (agent-dashboard) → neue Subdomain nötig

**Security:**
- ❌ **Öffentlich** — jeder mit Domain-Kenntnis erreicht das Login
- ❌ `allowInsecureAuth: true` + öffentliche URL = gefährlich
- ⚠️ Nur Token als Barriere
- ❌ Empfohlen: nur mit IP-Whitelist oder zusätzlichem Caddy Auth (basic auth)

---

### Option D: Caddy + Tailscale Serve (Hybrid)

Gateway auf loopback, Tailscale Serve für Tailnet-Zugriff + Caddy Reverse Proxy auf localhost für custom domain (optional mit Public-Exposure oder nur über Tailnet-IP).

**Caddy-Eintrag:**
```caddy
openclaw.steppa.online {
    # Nur Tailnet-Zugriff via Bind
    bind 100.80.60.59
    
    reverse_proxy 127.0.0.1:18789
}
```

**URLs:**
- Tailnet: `https://vmd190638.tail2f1fb9.ts.net/openclaw/`
- Custom: `https://openclaw.steppa.online/openclaw/` (nur via Tailnet erreichbar wenn DNS nur im Tailnet)

**Pros:**
- Custom Domain + Tailscale Security
- Gateway bleibt auf loopback

**Cons:**
- Komplexität: zwei Wege, zwei Konfigurationen
- Caddy-Bind auf Tailnet-IP nötig (sonst wieder öffentlich)
- DNS müsste nur im Tailnet aufgelöst werden (Split-DNS oder Tailscale DNS)
- OpenClaw müsste `auth.allowTailscale` korrekt interpretieren (Tailscale Headers kommen nur von Serve, nicht von Caddy als Proxy)

**Security:**
- ✅ Wenn Caddy auf Tailnet-IP bindet → sicher
- ⚠️ Caddy als zusätzlicher Hop → Tailscale Identity Headers kommen nicht an
- ⚠️ Komplexität = höheres Risiko für Config-Fehler

---

## 3. Empfehlung

### 👑 Gewinner: Option A — Tailscale Serve

**Begründung:**

1. **Einfachheit:** Zwei Config-Änderungen (`bind: "loopback"`, `tailscale.mode: "serve"`), kein Caddy-Eingriff, kein Tailscale Admin Console, keine neuen Subdomains
2. **Sicherheit:** Tailnet-only, HTTPS via Tailscale, Identity-Header-Auth möglich
3. **UX:** `allowTailscale: true` → Bastian öffnet `https://vmd190638.tail2f1fb9.ts.net/openclaw/` auf iPad, MacBook oder Pixel → **kein Token nötig** → Tailscale Identity sorgt für Login
4. **Rollback:** Eine Config-Änderung zurück + Gateway Restart = alles wie vorher
5. **Kein Caddy:** Caddy bleibt unberührt, kein Risiko für bestehende Services
6. **OpenClaw-integriert:** Das Feature ist designed dafür, OpenClaw managed Serve-Start/Stop

**Warum nicht Option B (Service Name):**
- Tagged node + Admin Console Approval sind unnötiger Overhead
- Die MagicDNS-Hostname `vmd190638.tail2f1fb9.ts.net` ist gut genug
- Option A kann später auf B upgraden, wenn gewünscht

**Warum nicht Option C (Caddy Reverse Proxy):**
- Öffentliche Exposure des Gateways ist ein Sicherheitsrisiko
- `dashboard.steppa.online` ist bereits belegt
- WebSocket-Konfiguration ist fehleranfällig

**Warum nicht Option D (Hybrid):**
- Overengineered für "einfach auf iPad öffnen"
- Tailscale Identity Headers funktionieren nicht durch Caddy durch
- Mehr Komplexität = mehr Wartung

---

## 4. Implementierung

### Schritt 1: Config sichern (Vorbereitung)

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.backup-$(date +%Y%m%d)
```

### Schritt 2: Config anpassen

Änderungen in `~/.openclaw/openclaw.json`:

```json5
{
  gateway: {
    mode: "local",
    bind: "loopback",                    // ÄNDERUNG: tailnet → loopback
    port: 18789,
    auth: {
      mode: "token",
      token: "0adfb570b518eba246cc1c39beb63748b76603bf39ca40cc",
      allowTailscale: true,              // NEU: Tailscale Identity Login
    },
    tailscale: {
      mode: "serve",                     // ÄNDERUNG: off → serve
      resetOnExit: false,
    },
    nodes: {
      denyCommands: [
        "camera.snap",
        "camera.clip",
        "screen.record",
        "contacts.add",
        "calendar.add",
        "reminders.add",
        "sms.send",
      ],
    },
    controlUi: {
      allowInsecureAuth: true,
      basePath: "/openclaw",
    },
  },
}
```

**Exakte CLI-Änderungen (empfohlen):**

```bash
# 1. Bind-Modus auf loopback setzen
openclaw config set gateway.bind "loopback"

# 2. Tailscale Serve aktivieren
openclaw config set gateway.tailscale.mode "serve"

# 3. allowTailscale aktivieren
openclaw config set gateway.auth.allowTailscale true
```

### Schritt 3: Config validieren

```bash
# Config auf Fehler prüfen
openclaw doctor

# Falls Fehler: openclaw doctor --fix
```

### Schritt 4: Gateway neustarten

```bash
# Gateway neu starten (systemd user service)
openclaw gateway restart
```

### Schritt 5: Erfolg prüfen

```bash
# Gateway Status checken
openclaw gateway status

# Tailscale Serve Status
tailscale serve status
```

**Erwartete Ausgabe von `tailscale serve status`:**
```
https://vmd190638.tail2f1fb9.ts.net/ → http://127.0.0.1:18789/
```

Der Pfad `/openclaw` wird vom Gateway selbst gehandhabt (basePath), Tailscale routet nur Root → localhost:18789.

### Schritt 6: Dashboard-URL ermitteln

```bash
echo "https://vmd190638.tail2f1fb9.ts.net/openclaw/"
```

---

## 5. Test-Schritte

### Test auf VPS selbst (via CLI):

```bash
# Lokaler Test (loopback)
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:18789/openclaw/

# Über Tailscale (MagicDNS)
curl -s -o /dev/null -w "%{http_code}" https://vmd190638.tail2f1fb9.ts.net/openclaw/
```

Beide sollten `200` oder `302` (Redirect) zurückgeben.

### Test auf iPad Pro (100.69.42.103):

1. Safari öffnen
2. URL eingeben: `https://vmd190638.tail2f1fb9.ts.net/openclaw/`
3. **Erwartet:** Dashboard öffnet sich OHNE Token-Eingabe (Tailscale Identity)
4. WebSocket-Verbindung sollte grün sein

### Test auf MacBook Pro (100.113.191.74):

1. Browser öffnen (Chrome/Safari/Firefox)
2. URL eingeben
3. **Erwartet:** Dashboard erscheint sofort

### Test auf Pixel 10 Pro (100.90.241.34):

1. Browser öffnen
2. URL eingeben
3. **Erwartet:** Dashboard funktioniert
4. Falls offline → Gerät muss erst Tailscale verbinden

### Edge Cases:

- **Token-Fallback testen:** `https://vmd190638.tail2f1fb9.ts.net/openclaw/?token=0adfb570b518eba246cc1c39beb63748b76603bf39ca40cc` sollte auch funktionieren
- **WebSocket testen:** Dashboard sollte Echtzeit-Updates zeigen
- **Verschiedene Browser testen:** Safari (iPad), Chrome (MacBook), Chrome (Android)

---

## 6. Rollback-Plan

### Rollback Schritt für Schritt:

```bash
# 1. Config zurück auf Original setzen
openclaw config set gateway.bind "tailnet"
openclaw config set gateway.tailscale.mode "off"
openclaw config unset gateway.auth.allowTailscale

# 2. Config validieren
openclaw doctor

# 3. Gateway neustarten
openclaw gateway restart

# 4. Prüfen ob Tailscale Serve clean ist
tailscale serve status
# Sollte "No serve config" zeigen

# 5. Falls Gateway Serve nicht clean ist → manuell resetten
tailscale serve --https=18789 off

# 6. Prüfen ob alte URL wieder funktioniert
curl -s -o /dev/null -w "%{http_code}" http://100.80.60.59:18789/openclaw/
# Erwartet: 200

# 7. Backup löschen (optional, nach erfolgreichem Rollback)
# rm ~/.openclaw/openclaw.json.backup-$(date +%Y%m%d)
```

### Worst-Case: Gateway startet nicht

1. Backup einspielen: `cp ~/.openclaw/openclaw.json.backup-* ~/.openclaw/openclaw.json`
2. `openclaw gateway restart`
3. Falls immer noch Probleme: `openclaw doctor --fix`

### Worst-Case 2: Tailscale Serve klemmt

```bash
# Serve für den Port manuell entfernen
tailscale serve --https=18789 off

# Oder radikaler: Tailscale Serve komplett reseten
tailscale serve reset
```

---

## 7. Security-Bewertung (detailliert)

### Threat Model

| Bedrohung | Risiko vorher | Risiko nachher | Begründung |
|-----------|---------------|----------------|------------|
| Public Exposure | ❌ Hoch (tailnet-Bind, aber Port offen) | ✅ Kein Risiko (loopback, nur Tailscale Serve) | Gateway lauscht nur noch auf 127.0.0.1 |
| MitM auf Tailnet | ✅ Gering | ✅ Gering (HTTPS via Tailscale) | Tailscale managed TLS |
| Unautorisierter Zugriff | ⚠️ Mittel (Token im URL sichtbar) | ✅ Niedrig (Tailscale Identity Header) | `allowTailscale: true` setzt auf `tailscale whois` |
| Token-Klau (Bookmark) | ⚠️ Mittel | ✅ Niedrig | Token wird nicht mehr benötigt |
| CSRF/WS-Hijacking | ✅ Gering | ✅ Gering | HTTPS + Same-Origin |
| Tailscale-Node kompromittiert | ⚠️ Mittel | ⚠️ Mittel | Identity Auth vertraut Tailscale → bei kompromittiertem Node greift der Angreifer zu |

### Fazit Security

**Netto-Verbesserung:** ✅ Ja. Der Wechsel von `bind: "tailnet"` (öffentlich erreichbarer Port mit Token) zu `bind: loopback` + Tailscale Serve + Identity Auth ist ein Security-Upgrade.

- **VORHER:** Gateway-Port 18789 war auf der öffentlichen Tailnet-IP erreichbar → jeder Tailscale-Client im selben Tailnet konnte connecten, brauchte aber Token
- **NACHHER:** Gateway lauscht nur auf loopback → nur über Tailscale Serve erreichbar → Identity Auth verhindert Token-Klau

---

## 8. Zusammenfassung

| Aspekt | Wert |
|--------|------|
| **Empfohlene Option** | **A — Tailscale Serve** |
| **Config-Änderungen** | 3 Keys (`bind`, `tailscale.mode`, `auth.allowTailscale`) |
| **Caddy-Änderungen** | Keine |
| **Neue URL** | `https://vmd190638.tail2f1fb9.ts.net/openclaw/` |
| **Login** | Automatisch via Tailscale Identity (kein Token nötig) |
| **Implementierungszeit** | ~5 Minuten |
| **Rollback-Zeit** | ~2 Minuten |
| **Security Impact** | ✅ Positiv (kleinere Attack Surface) |
| **iOS/macOS/Android** | ✅ Funktioniert out-of-the-box |