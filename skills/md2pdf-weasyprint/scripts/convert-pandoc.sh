#!/bin/bash
# Markdown to PDF (Pandoc Solution)
# Alternative converter using pandoc with proper encoding

set -e

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

# Check pandoc
if ! command -v pandoc &> /dev/null; then
    echo "❌ Error: pandoc is not installed"
    exit 1
fi

# Install LaTeX if needed
if ! command -v xelatex &> /dev/null; then
    echo "⚠️  Installing LaTeX engine..."
    if command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y texlive-xetex texlive-fonts-extra
    elif command -v yum &> /dev/null; then
        yum install -y -q texlive-xetex texlive-fonts-extra
    else
        echo "⚠️  Could not install LaTeX - please install manually"
    fi
fi

# Check Chinese fonts
if ! fc-list | grep -q "Noto Sans CJK"; then
    echo "⚠️  Installing Chinese fonts..."
    if command -v apt-get &> /dev/null; then
        apt-get install -y fonts-noto-cjk
    elif command -v yum &> /dev/null; then
        yum install -y -q google-noto-sans-cjk-fonts
    else
        echo "⚠️  Could not install Chinese fonts - please install manually"
    fi
fi

# Execute conversion with pandoc
echo "📄 Starting conversion with pandoc..."
echo "   Input: $INPUT_FILE"
echo "   Output: $OUTPUT_FILE"
echo ""

pandoc "$INPUT_FILE" -o "$OUTPUT_FILE" \
  --pdf-engine=xelatex \
  -V CJKmainfont="Noto Sans CJK SC" \
  -V geometry:margin=2cm \
  --highlight-style=github \
  --standalone \
  --variable mainfont="DejaVu Serif"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Pandoc conversion successful!"
    echo "📁 File location: $OUTPUT_FILE"
    echo "📊 File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
else
    echo ""
    echo "❌ Pandoc conversion failed"
    exit 1
fi