#!/usr/bin/env python3
"""
ask_agent.py – Send a question to the OpenClaw agent via CLI, get answer back.

Usage:
  python3 ask_agent.py --question "Was ist der Sinn des Lebens?" --output /tmp/qa_result.json

Output JSON: {"question": "...", "answer": "..."}
"""

import json, logging, subprocess, os, sys, time, re
from pathlib import Path
from typing import Optional

log = logging.getLogger("ask_agent")

# OpenClaw CLI path
OPENCLAW_CMD = "/usr/bin/openclaw"

# Free model chain for Q&A – prioritized by reliability + quality for deep research
# Tier 1: Nemotron 3 Super 120B – PROVEN reliable (52s latency, 3k+ chars), 1M context, quality 60
MODEL_TIER_1 = "openrouter/nvidia/nemotron-3-super-120b-a12b:free"
# Tier 2: Nemotron 3 Ultra 550B – 550B parameters, 1M context, max depth (can be rate-limited)
MODEL_TIER_2 = "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
# Tier 3: Gemma 4 31B – highest quality (65), Vision+Tools, 262K context (often rate-limited)
MODEL_TIER_3 = "openrouter/google/gemma-4-31b-it:free"
# Tier 4: GPT-OSS 120B – OpenAI open-weight, 131K context (often rate-limited)
MODEL_TIER_4 = "openrouter/openai/gpt-oss-120b:free"

# Full fallback chain – tries each model in order until one responds
FALLBACK_CHAIN = [MODEL_TIER_1, MODEL_TIER_2, MODEL_TIER_3, MODEL_TIER_4]

# Common German words for quality sniffing (top ~40 most frequent)
GERMAN_WORDS = {
    "der", "die", "das", "ist", "und", "ein", "eine", "nicht", "sich", "auch",
    "auf", "für", "mit", "als", "bei", "von", "aus", "nach", "werden", "wird",
    "hat", "haben", "sind", "dass", "durch", "zur", "zum", "diese", "dieser",
    "einen", "einer", "dem", "den", "des", "sie", "es", "ich", "wie", "oder",
    "aber", "nur", "noch", "schon", "bis", "um", "an", "im", "am", "kann",
    "wurde", "wären", "hätte", "sehr", "viel", "wenig", "groß", "klein",
}

# System prompt leakage patterns – if reply starts with these, it's garbage
LEAKAGE_PATTERNS = [
    r"^The user wants",
    r"^I'll help",
    r"^Here(?:'s| is) (?:a |the |my |)comprehensive",
    r"^I cannot",
    r"^I'm not able",
    r"^As an AI",
]

# Minimum ratio of German words / total words in first 100 tokens
MIN_GERMAN_RATIO = 0.15


def _is_valid_answer(text: str) -> bool:
    """
    Validate that an answer is actually useful German content, not
    hallucinated token garbage or system prompt leakage.

    Checks:
    1. Minimum length (100 chars)
    2. No binary/control characters
    3. No system prompt leakage
    4. Contains German words (ratio check)
    5. Not mostly English gibberish
    """
    if not text or len(text) < 100:
        return False

    # Check for binary / control characters (outside normal ASCII + unicode)
    binary_count = sum(1 for c in text if ord(c) < 32 and c not in '\n\r\t')
    total_chars = len(text)
    if binary_count > 0.02 * total_chars and binary_count > 5:
        log.warning("Garbage detect: too many control chars (%d)", binary_count)
        return False

    # Check for system prompt leakage
    for pattern in LEAKAGE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            log.warning("Garbage detect: system prompt leakage: %s", pattern)
            return False

    # Check for random ASCII noise: words with >5 consecutive non-alphabetic chars
    noise_patterns = re.findall(r'[^a-zA-ZäßöüÄÖÜẞ\s]{6,}', text)
    if noise_patterns and sum(len(p) for p in noise_patterns) > 0.3 * total_chars:
        log.warning("Garbage detect: too much ASCII noise")
        return False

    # Check for excessive symbol-to-text ratio (>40% non-alpha = likely garbage)
    alpha = sum(1 for c in text if c.isalpha() or c.isspace())
    if alpha / total_chars < 0.5:
        log.warning("Garbage detect: <50%% alphabetic (%.0f%% alpha)", 100 * alpha / total_chars)
        return False

    # German word ratio check on first 500 chars
    sample = text[:500].lower()
    words = re.findall(r'[a-zA-ZäöüßÄÖÜ]+', sample)
    if words:
        german_hits = sum(1 for w in words if w in GERMAN_WORDS)
        ratio = german_hits / len(words)
        if ratio < MIN_GERMAN_RATIO:
            log.warning("Garbage detect: low German word ratio (%.0f%% hits, need >=%.0f%%)",
                        100 * ratio, 100 * MIN_GERMAN_RATIO)
            return False

    # Check for the "Fehler:" prefix
    if text.startswith("Fehler:") or text.startswith("Error:"):
        return False

    return True


def _run_agent(prompt: str, session_key: str, model: str, timeout: int) -> Optional[str]:
    """Run one agent call, return reply text or None on failure."""
    cmd = [
        OPENCLAW_CMD, "agent",
        "--session-key", session_key,
        "--message", prompt,
        "--model", model,
        "--json",
        "--timeout", str(timeout),
    ]

    log.info("Running %s (session=%s)...", model, session_key)
    start = time.time()

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout + 10,
            env={**os.environ, "OPENCLAW_LOG_LEVEL": "error"},
        )
    except subprocess.TimeoutExpired:
        log.error("Agent timed out after %ds (%s)", timeout, model)
        return None

    elapsed = time.time() - start
    log.info("Agent responded in %.1fs (rc=%d, %s)", elapsed, result.returncode, model)

    if result.returncode != 0:
        stderr = result.stderr[:300] if result.stderr else "unknown"
        log.error("Agent failed (rc=%d, %s): %s", result.returncode, model, stderr)
        return None

    # Parse JSON output
    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError:
        log.error("Could not parse agent JSON output: %s", result.stdout[:200])
        return None

    # Extract the visible reply text
    result_data = output.get("result", {})
    payloads = result_data.get("payloads", [])
    for p in payloads:
        text = p.get("text", "")
        if text:
            return text.strip()

    reply = output.get("finalAssistantVisibleText", "") or output.get("finalAssistantRawText", "")
    return reply.strip() if reply else None


def ask_agent(question: str, model: str = None, timeout: int = 120) -> str:
    """
    Send a question to the OpenClaw agent CLI and return the answer text.

    Tries models in FALLBACK_CHAIN order until one responds with
    valid German content (quality-checked). Each model gets its own
    session key to avoid state bleed.
    """
    session_base = f"addbook-frage-{int(time.time())}"

    # Build the prompt – tiefer Research-Report, umfassend + strukturiert
    prompt = (
        f"Erstelle einen umfassenden Deep-Research-Report zur folgenden Frage.\n"
        f"\n"
        f"**Format & Stil:**\n"
        f"- Ausführlicher, strukturierter Fließtext (ca. 1500-3000 Wörter)\n"
        f"- Klare Gliederung mit Überschriften und Unterkapiteln\n"
        f"- Faktisch präzise, aber gut lesbar – wie ein hochwertiger Wikipedia-Artikel oder ein "
        f"kurzes Dossier\n"
        f"- Nutze dein gesamtes Wissen und recherchiere bei Bedarf \"live\"\n"
        f"- Belege Kernaussagen mit Quellen/Fakten\n"
        f"- Verschiedene Perspektiven darstellen, wo sinnvoll\n"
        f"\n"
        f"**Struktur (Vorschlag):**\n"
        f"1. Einleitung / Kontext\n"
        f"2. Hauptteil mit mehreren Abschnitten (vertiefend, mit Beispielen)\n"
        f"3. Zusammenfassung / Fazit\n"
        f"4. Ausblick oder weiterführende Gedanken\n"
        f"\n"
        f"**Wichtig:** Die Antwort wird als Kindle-E-Book gelesen – also Formatierung in "
        f"sauberem Markdown mit Absätzen, Aufzählungen, Fettschrift, Zwischenüberschriften.\n"
        f"Keine langen unstrukturierten Textwüsten.\n"
        f"\n"
        f"Frage:\n{question}"
    )

    # Try each model in the chain until one produces valid content
    chain = model.split(",") if model else FALLBACK_CHAIN
    if isinstance(chain, str):
        chain = [chain]

    for idx, m in enumerate(chain):
        m = m.strip()
        if not m:
            continue
        label = f"tier{idx+1}" if len(chain) > 1 else ""
        skey = f"{session_base}-{label}" if label else session_base
        reply = _run_agent(prompt, skey, m, timeout)
        if reply and _is_valid_answer(reply):
            return reply
        if reply:
            log.warning("Model %s returned garbage (%d chars), trying next...", m, len(reply))
        else:
            log.warning("Model %s failed, trying next in chain...", m)

    log.error("All %d models in chain failed or returned garbage for question", len(chain))
    return "Fehler: Alle Modelle haben versagt. Bitte später erneut versuchen."


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    import argparse
    parser = argparse.ArgumentParser(description="Ask the OpenClaw agent a question")
    parser.add_argument("--question", required=True, help="The question to ask")
    parser.add_argument("--output", required=True, help="Path to write JSON result")
    parser.add_argument("--model", default=",".join(FALLBACK_CHAIN), help="Model(s) comma-separated (default: full chain)")
    parser.add_argument("--timeout", type=int, default=300, help="Agent timeout (seconds)")
    args = parser.parse_args()

    answer = ask_agent(args.question, args.model, args.timeout)

    result = {
        "question": args.question,
        "answer": answer,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "model": args.model,
    }

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(json.dumps(result, ensure_ascii=False))
    log.info("Answer written to %s (%d chars)", args.output, len(answer))


if __name__ == "__main__":
    main()