#!/usr/bin/env python3
"""generate-model-matrix.py
Extrahiert Modelle aus openclaw.json und injected die Matrix in TOOLS.md
zwischen den Markern <!-- BEGIN MODEL MATRIX --> und <!-- END MODEL MATRIX -->"""

import json
import re
import os
import sys

CONFIG_PATH = os.path.expanduser("/root/.openclaw/openclaw.json")
TOOLS_PATH = os.path.expanduser("/root/.local/.openclaw/workspace/TOOLS.md")
MARKER_START = "<!-- BEGIN MODEL MATRIX -->"
MARKER_END = "<!-- END MODEL MATRIX -->"

def generate_matrix():
    with open(CONFIG_PATH) as f:
        config = json.load(f)
    
    providers = config.get("models", {}).get("providers", {})
    
    lines = []
    lines.append(MARKER_START)
    lines.append("")
    lines.append("### Model-Auswahl nach Aufgabe (AUTO-GENERATED)")
    lines.append("")
    lines.append(f"*Generiert aus: `{CONFIG_PATH}` — Letztes Update: $(date '+%Y-%m-%d %H:%M')*")
    lines.append("")
    lines.append("**Available Models:**")
    lines.append("")
    
    for prov_name, prov_config in providers.items():
        label_map = {
            "openrouter": "OpenRouter",
            "xiaomi-token-plan": "Xiaomi Token Plan"
        }
        label = label_map.get(prov_name, prov_name)
        lines.append(f"- **{label}:**")
        
        for m in prov_config.get("models", []):
            mid = m["id"]
            cost = m.get("cost", {})
            inp_types = m.get("input", [])
            reasoning = m.get("reasoning", False)
            ctx = m.get("contextWindow", "?")
            
            if cost.get("input", 0) == 0 and cost.get("output", 0) == 0:
                price_str = "🆓 FREE"
            elif cost.get("input", 0) > 0 or cost.get("output", 0) > 0:
                inp_c = cost.get("input", 0)
                out_c = cost.get("output", 0)
                price_str = f"💰 ${inp_c}/${out_c} per M"
            else:
                price_str = "❓"
            
            lines.append(f"  - `{mid}` — {price_str} | ctx={ctx} | {inp_types} | Reasoning={reasoning}")
        lines.append("")
    
    lines.append("| Aufgabe | Model (Provider) | Kosten | Warum |")
    lines.append("|---------|-----------------|--------|-------|")
    lines.append("| Frontend/UI/UX (React, Vue, Tailwind) | `mimo-v2.5` (Xiaomi) | 💰 $0.4/$2 | Vision+Text, 1M ctx, solides Coding |")
    lines.append("| Backend/API/DB (komplexe Architektur) | `mimo-v2.5-pro` (Xiaomi) | 💰 $1/$3 | Reasoning + 1M ctx |")
    lines.append("| Testing (Jest, E2E) | `qwen/qwen3-coder:free` (OpenRouter) | 🆓 FREE | Coding-spezifisch, 1M ctx |")
    lines.append("| Debugging/Troubleshooting | `nvidia/nemotron-3-super-120b-a12b:free` (OpenRouter) | 🆓 FREE | Starkes Reasoning, Free |")
    lines.append("| Writing/Docs | `mimo-v2.5` (Xiaomi) | 💰 $0.4/$2 | Sprachqualität besser als Free |")
    lines.append("| Research/Web | `nvidia/nemotron-3-ultra-550b-a55b:free` (OpenRouter) | 🆓 FREE | Reasoning, 1M ctx |")
    lines.append("| Multi-Modal (Bild+Text) | `mimo-v2.5` (Xiaomi) | 💰 $0.4/$2 | Einziger Vision-fähiger im Stack |")
    lines.append("| Quick & Dirty / Einzeiler | `qwen/qwen3-coder:free` (OpenRouter) | 🆓 FREE | Schnell, Free |")
    lines.append("| Orchestrierung | `mimo-v2.5-pro` (Xiaomi) | 💰 $1/$3 | Reasoning für Task-Analyse & Delegation |")
    lines.append("")
    lines.append("**Empfehlung:** FREE für alles was geht. Xiaomi nur wenn's drauf ankommt.")
    lines.append("")
    lines.append(MARKER_END)
    lines.append("")
    
    return "\n".join(lines)

def inject():
    matrix = generate_matrix()
    
    with open(TOOLS_PATH) as f:
        content = f.read()
    
    pattern = re.compile(
        re.escape(MARKER_START) + ".*?" + re.escape(MARKER_END),
        re.DOTALL
    )
    
    if not pattern.search(content):
        print("❌ Marker nicht in TOOLS.md gefunden!")
        print(f"Such nach: {MARKER_START} ... {MARKER_END}")
        sys.exit(1)
    
    new_content = pattern.sub(matrix, content)
    
    with open(TOOLS_PATH, "w") as f:
        f.write(new_content)
    
    print(f"✅ TOOLS.md aktualisiert mit Models aus {CONFIG_PATH}")

if __name__ == "__main__":
    inject()