#!/usr/bin/env python3
"""
answer_pdf.py – Generate a Kindle Scribe-friendly PDF from an AI-generated Q&A.

Input: JSON with {"question": "...", "answer": "..."}
Output: formatted A5 PDF optimized for Kindle Scribe.

Usage:
  python3 answer_pdf.py --input qa.json --output /path/to/output.pdf
"""

import json, logging, time
from pathlib import Path
from weasyprint import HTML

log = logging.getLogger("answer_pdf")

CSS = """
@page {
    size: A5;
    margin: 1.2cm 1.5cm 1.2cm 1.5cm;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14pt;
    line-height: 1.6;
    color: #111;
}

/* Cover page */
.cover {
    page-break-after: always;
    text-align: center;
    padding-top: 4cm;
}
.cover .label {
    font-size: 14pt;
    color: #888;
    letter-spacing: 3pt;
    text-transform: uppercase;
    margin-bottom: 12px;
}
.cover h1 {
    font-size: 24pt;
    font-weight: bold;
    line-height: 1.3;
    margin-bottom: 20px;
}
.cover .date {
    font-size: 12pt;
    color: #777;
    margin-top: 8px;
}
.cover .separator {
    margin: 24px auto;
    width: 60px;
    height: 2px;
    background: #111;
}

/* Question header */
.question-box {
    background: #f0f0f0;
    padding: 16px 18px;
    margin-bottom: 20px;
    border-left: 4px solid #111;
}
.question-box .qlabel {
    font-size: 11pt;
    font-weight: bold;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 2pt;
    margin-bottom: 6px;
}
.question-box .qtext {
    font-size: 16pt;
    font-weight: bold;
    line-height: 1.4;
}

/* Answer */
.answer-section {
    margin-top: 8px;
}
.answer-section .alabel {
    font-size: 11pt;
    font-weight: bold;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 2pt;
    margin-bottom: 10px;
}
.answer-section .atext {
    font-size: 14pt;
    line-height: 1.7;
}
.answer-section .atext p {
    margin-bottom: 10px;
}

/* Lists in answer */
.answer-section ul, .answer-section ol {
    padding-left: 28px;
    margin-bottom: 10px;
}
.answer-section ul li, .answer-section ol li {
    margin-bottom: 6px;
    font-size: 13.5pt;
}

/* Code / emphasis */
.answer-section code {
    font-family: 'Courier New', monospace;
    font-size: 12pt;
    background: #f0f0f0;
    padding: 1px 4px;
    border-radius: 2px;
}
.answer-section strong {
    font-weight: bold;
}
.answer-section em {
    font-style: italic;
}

.answer-section blockquote {
    border-left: 3px solid #ccc;
    padding-left: 14px;
    margin: 12px 0;
    color: #555;
    font-style: italic;
}

.footer-note {
    margin-top: 30px;
    font-size: 10pt;
    color: #999;
    text-align: center;
    border-top: 1px solid #ddd;
    padding-top: 14px;
}
"""


def generate_pdf(question: str, answer: str, output_path: str) -> str:
    """Generate Q&A PDF, return output path."""
    # Escape HTML entities for safe rendering
    import html

    q_esc = html.escape(question)
    # Simple markdown→HTML conversion for answer: paragraphs, bold, italic, code, lists
    a_html = _markdown_to_html(answer)

    date_str = time.strftime("%d.%m.%Y %H:%M")

    full_html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>{CSS}</style>
</head>
<body>

<div class="cover">
    <div class="label">Frage &amp; Antwort</div>
    <h1>{q_esc}</h1>
    <div class="separator"></div>
    <div class="date">Erstellt am {date_str}</div>
</div>

<div class="question-box">
    <div class="qlabel">Frage</div>
    <div class="qtext">{q_esc}</div>
</div>

<div class="answer-section">
    <div class="alabel">Antwort</div>
    <div class="atext">{a_html}</div>
</div>

<div class="footer-note">Erstellt mit AddBook · Gesendet an Kindle</div>

</body>
</html>"""

    HTML(string=full_html).write_pdf(output_path)
    size = Path(output_path).stat().st_size
    log.info("PDF generated: %s (%d bytes)", output_path, size)
    return output_path


def _markdown_to_html(text: str) -> str:
    """Minimal markdown → HTML conversion for Kindle-safe output."""
    import html

    lines = text.splitlines()
    html_lines = []
    in_code_block = False
    code_buffer = []
    in_list = False
    in_ol = False

    def close_list():
        nonlocal in_list, in_ol
        if in_ol:
            html_lines.append("</ol>")
        elif in_list:
            html_lines.append("</ul>")
        in_list = False
        in_ol = False

    for raw_line in lines:
        line = raw_line

        # Code blocks (```)
        if line.strip().startswith("```"):
            if in_code_block:
                close_list()
                html_lines.append(f"<pre><code>{html.escape(chr(10).join(code_buffer))}</code></pre>")
                code_buffer = []
                in_code_block = False
            else:
                close_list()
                in_code_block = True
            continue

        if in_code_block:
            code_buffer.append(line)
            continue

        # Skip empty lines after closing a list
        if not line.strip():
            close_list()
            html_lines.append("<p>&nbsp;</p>")
            continue

        # Headings
        if line.startswith("### "):
            close_list()
            html_lines.append(f"<h3>{html.escape(line[4:].strip())}</h3>")
            continue
        if line.startswith("## "):
            close_list()
            html_lines.append(f"<h2>{html.escape(line[3:].strip())}</h2>")
            continue
        if line.startswith("# "):
            close_list()
            html_lines.append(f"<h1>{html.escape(line[2:].strip())}</h1>")
            continue

        # Unordered list
        if line.strip().startswith(("- ", "* ", "+ ")):
            text = html.escape(line.strip()[2:].strip())
            if not in_list and not in_ol:
                html_lines.append("<ul>")
                in_list = True
            elif in_ol:
                close_list()
                html_lines.append("<ul>")
                in_list = True
            html_lines.append(f"<li>{text}</li>")
            continue

        # Ordered list
        import re as _re
        om = _re.match(r"^\s*\d+[.)]\s+(.*)", line)
        if om:
            text = html.escape(om.group(1).strip())
            if not in_ol and not in_list:
                html_lines.append("<ol>")
                in_ol = True
            elif in_list:
                close_list()
                html_lines.append("<ol>")
                in_ol = True
            html_lines.append(f"<li>{text}</li>")
            continue

        # Blockquote
        if line.strip().startswith(">"):
            close_list()
            bq_text = html.escape(line.strip()[1:].strip())
            html_lines.append(f"<blockquote>{bq_text}</blockquote>")
            continue

        # Normal paragraph with inline formatting
        close_list()

        # Inline formatting
        formatted = html.escape(line)
        # **bold**
        formatted = _re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", formatted)
        # *italic*
        formatted = _re.sub(r"(?<!\*)\*([^*\n]+?)\*(?!\*)", r"<em>\1</em>", formatted)
        # `code`
        formatted = _re.sub(r"`([^`]+?)`", r"<code>\1</code>", formatted)

        html_lines.append(f"<p>{formatted}</p>")

    close_list()
    if in_code_block and code_buffer:
        html_lines.append(f"<pre><code>{html.escape(chr(10).join(code_buffer))}</code></pre>")

    return "\n".join(html_lines)


def main():
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    parser = argparse.ArgumentParser(description="Generate Q&A PDF")
    parser.add_argument("--input", required=True, help="JSON file with {question, answer}")
    parser.add_argument("--output", required=True, help="Output PDF path")
    args = parser.parse_args()

    with open(args.input) as f:
        data = json.load(f)

    generate_pdf(data["question"], data["answer"], args.output)
    print(json.dumps({"path": args.output}))


if __name__ == "__main__":
    main()