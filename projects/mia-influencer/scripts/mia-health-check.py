#!/usr/bin/env python3
"""
Mia Influencer – Health Check
Prüft ob alles läuft: Session gültig, Scripte da, Schedule ok

Cron: 0 12 * * *
"""

import json
import os
import sys
from datetime import datetime

BASE_DIR = "/root/.openclaw/workspace/projects/mia-influencer"
CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append({"name": name, "ok": ok, "detail": detail})


def main():
    print("=" * 50)
    print(f"📍 Mia Health Check – {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)

    # 1. Verzeichnisstruktur
    dirs_ok = all([
        os.path.isdir(BASE_DIR),
        os.path.isdir(os.path.join(BASE_DIR, "scripts")),
        os.path.isdir(os.path.join(BASE_DIR, "prompts")),
    ])
    check("Verzeichnisstruktur", dirs_ok)

    # 2. Wichtige Dateien
    files = ["KONZEPT.md", "SOP.md", "CONTENT-PLAN.md", "SYSTEM-PROMPT.md", "CONFIG.md",
             "scripts/mia-poster.py", "scripts/mia-dm-checker.py"]
    missing = [f for f in files if not os.path.exists(os.path.join(BASE_DIR, f))]
    check("Projekt-Dateien", len(missing) == 0, f"Fehlen: {', '.join(missing)}" if missing else "")

    # 3. schedule.json
    if os.path.exists(os.path.join(BASE_DIR, "schedule.json")):
        try:
            with open(os.path.join(BASE_DIR, "schedule.json")) as f:
                sched = json.load(f)
            check("schedule.json", True, f"{len(sched.get('posts', []))} Posts")
        except:
            check("schedule.json", False, "Korrupt/kein JSON")
    else:
        check("schedule.json", False, "Nicht vorhanden")

    # 4. post-state.json (existiert optional)
    state_file = os.path.join(BASE_DIR, "post-state.json")
    if os.path.exists(state_file):
        try:
            with open(state_file) as f:
                state = json.load(f)
            posted = len(state.get("posted_ids", []))
            failed = len(state.get("failed_ids", []))
            check("post-state.json", True, f"{posted} gepostet, {failed} failed")
        except:
            check("post-state.json", False, "Korrupt")
    else:
        check("post-state.json", True, "Noch kein State (neues Projekt)")

    # 5. instagrapi-session.json (optional)
    session_file = os.path.join(BASE_DIR, "instagrapi-session.json")
    if os.path.exists(session_file):
        check("Instagram-Session", True, "Vorhanden")
    else:
        check("Instagram-Session", True, "Noch kein Login (Setup nötig)")

    # 6. qwen-image-gen.sh
    qwen_script = "/root/.openclaw/workspace/scripts/qwen-image-gen.sh"
    check("qwen-image-gen.sh", os.path.exists(qwen_script) and os.access(qwen_script, os.X_OK))

    # 7. Config
    config_file = os.path.join(BASE_DIR, "CONFIG.md")
    if os.path.exists(config_file):
        check("CONFIG.md", True)
    else:
        check("CONFIG.md", False)

    # Ergebnis
    print()
    ok_count = sum(1 for c in CHECKS if c["ok"])
    fail_count = sum(1 for c in CHECKS if not c["ok"])

    for c in CHECKS:
        icon = "✅" if c["ok"] else "❌"
        detail = f" – {c['detail']}" if c["detail"] else ""
        print(f"  {icon} {c['name']}{detail}")

    print()
    if fail_count == 0:
        print(f"✅ Alles OK ({ok_count}/{len(CHECKS)} Checks bestanden)")
        return 0
    else:
        print(f"⚠️  {fail_count} Fehler ({ok_count}/{len(CHECKS)} Checks)")
        return 1


if __name__ == "__main__":
    sys.exit(main())