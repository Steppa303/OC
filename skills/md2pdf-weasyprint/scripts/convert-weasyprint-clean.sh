#!/bin/bash
# Markdown to PDF (WeasyPrint Solution)
# Supports perfect Chinese display, code highlighting, table styling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/convert-weasyprint-clean.py"

# Check parameters
if [ $# -lt 1 ]; then
    echo "Usage: $0 <input.md> [output.pdf]"
    echo ""
    echo "Examples:"
    echo "  $0 document.md"
    echo "  $0 document.md output.pdf"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${2:-${INPUT_FILE%.md}.pdf}"

# Check input file
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Error: Input file does not exist: $INPUT_FILE"
    exit 1
fi

# Check Python dependencies
if ! python3 -c "import markdown, weasyprint" 2>/dev/null; then
    echo "⚠️  Installing Python dependencies..."
    python3 -m pip install -q markdown weasyprint
fi

# Check Chinese fonts
if ! fc-list | grep -q "Noto Sans CJK"; then
    echo "⚠️  Installing Chinese fonts..."
    yum install -y -q google-noto-sans-cjk-fonts
fi

# Check emoji fonts
if ! fc-list | grep -q "Noto.*Emoji"; then
    echo "⚠️  Installing emoji fonts..."
    yum install -y -q google-noto-emoji-color-fonts google-noto-emoji-fonts
fi

# Execute conversion
echo "📄 Starting conversion..."
echo "   Input: $INPUT_FILE"
echo "   Output: $OUTPUT_FILE"
echo ""

python3 "$PYTHON_SCRIPT" "$INPUT_FILE" "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Conversion successful!"
    echo "📁 File location: $OUTPUT_FILE"
    echo "📊 File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
else
    echo ""
    echo "❌ Conversion failed"
    exit 1
fi