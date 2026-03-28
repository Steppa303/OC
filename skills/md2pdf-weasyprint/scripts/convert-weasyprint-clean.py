#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Markdown to PDF Converter (WeasyPrint Solution)
Supports perfect Chinese display, code highlighting, table styling
Fix: Numeric spacing issues
"""

import sys
import re
import markdown
from weasyprint import HTML, CSS
from pathlib import Path

def convert_markdown_to_pdf(input_file, output_file):
    """Convert Markdown file to PDF"""

    # Read Markdown file
    md_path = Path(input_file)
    if not md_path.exists():
        raise FileNotFoundError(f"Input file does not exist: {input_file}")

    md_content = md_path.read_text(encoding='utf-8')

    # Preprocessing: add space after emojis in list items
    md_content = re.sub(
        r'^(\s*[-*+]\s+)([\U0001F300-\U0001F9FF])([^\s])',
        r'\1\2 \3',
        md_content,
        flags=re.MULTILINE
    )

    # Convert to HTML
    html_content = markdown.markdown(
        md_content,
        extensions=[
            'tables',
            'fenced_code',
            'nl2br',
            'sane_lists',
            'codehilite',
            'toc'
        ]
    )

    # Create complete HTML document
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{md_path.stem}</title>
    <style>
        @page {{
            size: A4;
            margin: 2cm;
        }}
        body {{
            font-family: "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            font-variant-numeric: tabular-nums;
            letter-spacing: normal;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            font-size: 24pt;
            margin-top: 0;
            page-break-after: avoid;
            letter-spacing: normal;
        }}
        h2 {{
            color: #2c3e50;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
            font-size: 18pt;
            margin-top: 30pt;
            page-break-after: avoid;
            letter-spacing: normal;
        }}
        h3 {{
            color: #34495e;
            font-size: 14pt;
            margin-top: 20pt;
            page-break-after: avoid;
            letter-spacing: normal;
        }}
        h4, h5, h6 {{
            color: #34495e;
            font-size: 12pt;
            margin-top: 15pt;
            page-break-after: avoid;
            letter-spacing: normal;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            page-break-inside: avoid;
            font-variant-numeric: tabular-nums;
            letter-spacing: normal;
        }}
        th {{
            background-color: #3498db;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #2980b9;
            letter-spacing: normal;
        }}
        td {{
            padding: 12px;
            border: 1px solid #ddd;
            font-variant-numeric: tabular-nums;
            letter-spacing: normal;
        }}
        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}
        code {{
            background-color: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: "Courier New", monospace;
            font-size: 0.9em;
            color: #e74c3c;
            font-variant-numeric: tabular-nums;
            letter-spacing: normal;
        }}
        pre {{
            background-color: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border: 1px solid #34495e;
            page-break-inside: avoid;
        }}
        pre code {{
            background: none;
            padding: 0;
            color: inherit;
        }}
        blockquote {{
            border-left: 4px solid #3498db;
            margin: 20px 0;
            padding-left: 20px;
            color: #7f8c8d;
            background-color: #f8f9fa;
            padding: 15px 20px;
            border-radius: 0 5px 5px 0;
            page-break-inside: avoid;
        }}
        ul, ol {{
            margin: 10px 0;
            padding-left: 30px;
            list-style-position: outside;
        }}
        li {{
            margin: 5px 0;
            line-height: 1.6;
        }}
        ul li {{
            list-style-type: disc;
        }}
        ul ul li {{
            list-style-type: circle;
        }}
        ul ul ul li {{
            list-style-type: square;
        }}
        ol li {{
            list-style-type: decimal;
        }}
        hr {{
            border: none;
            border-top: 2px solid #ecf0f1;
            margin: 30px 0;
        }}
        strong {{
            color: #2c3e50;
            font-weight: bold;
        }}
        em {{
            font-style: italic;
        }}
        a {{
            color: #3498db;
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
        img {{
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>"""

    # Generate PDF
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    HTML(string=full_html).write_pdf(str(output_path))

    return str(output_path)

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 convert-weasyprint.py <input.md> [output.pdf]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else str(Path(input_file).with_suffix('.pdf'))

    try:
        result = convert_markdown_to_pdf(input_file, output_file)
        print(f"✅ PDF generated successfully: {result}")
    except Exception as e:
        print(f"❌ Conversion failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()