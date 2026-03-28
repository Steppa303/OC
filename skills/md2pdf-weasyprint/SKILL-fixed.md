---
name: md2pdf
description: Clean Markdown to PDF converter with proper encoding support. Fixed version that handles UTF-8 correctly and avoids Chinese characters in output.
metadata: {
  "openclaw": {
    "requires": {
      "bins": ["python3"],
      "python": ["markdown", "weasyprint"]
    }
  }
}
---

# Clean Markdown to PDF Converter

Fixed version of the original "Markdown 转 PDF" skill that properly handles UTF-8 encoding and avoids Chinese characters in output. This solution addresses the four main issues identified:

## 🔧 Issues Fixed

1. **Chinese Characters Issue**: Removed all Chinese text from source code and updated HTML lang attribute
2. **Code Fragments**: Clean implementation without embedded bash/code fragments
3. **Error Messages**: All error messages now in English
4. **Formatting Issues**: Proper encoding and character handling

## 🚀 Recommended Solutions

### Solution A: WeasyPrint (Clean Version) ⭐

**Best for:** Perfect UTF-8 support, professional layout, clean output

```bash
# Convert Markdown to PDF (recommended)
bash scripts/convert-weasyprint-clean.sh input.md

# Specify output filename
bash scripts/convert-weasyprint-clean.sh input.md output.pdf
```

### Solution B: Pandoc Alternative

**Alternative option:** Using pandoc for LaTeX-based conversion

```bash
# Pandoc conversion
bash scripts/convert-pandoc.sh input.md output.pdf
```

## 📁 Script Descriptions

### convert-weasyprint-clean.sh ⭐

**Recommended** - Clean WeasyPrint solution with proper encoding.

**Features:**
- Automatic dependency installation (markdown, weasyprint)
- Automatic Chinese font installation (google-noto-sans-cjk-fonts)
- Professional CSS styling (code highlighting, table styling)
- Full error handling in English
- Proper UTF-8 encoding throughout

**Usage:**
```bash
bash scripts/convert-weasyprint-clean.sh <input.md> [output.pdf]
```

### convert-pandoc.sh

Alternative pandoc solution with LaTeX engine.

**Features:**
- XeLaTeX engine for proper Unicode support
- Noto Sans CJK fonts for Chinese characters
- GitHub-style syntax highlighting
- Professional document margins

**Usage:**
```bash
bash scripts/convert-pandoc.sh <input.md> [output.pdf]
```

## 🧪 Testing Results

Both solutions have been tested with:
- UTF-8 encoded text
- German Umlauts (äöü)
- Chinese characters (when needed)
- Code blocks
- Tables
- Special formatting

No Chinese characters appear in output PDFs anymore.

## 📋 Clean Recipe Template

Use this template for recipe documents to ensure clean output:

```markdown
# Recipe Title

## Ingredients
- Item 1
- Item 2

## Preparation
1. Step 1
2. Step 2

## Tips
- Useful tip
- Another tip
```

## 🛠️ Technical Implementation

### WeasyPrint Solution
Uses Python WeasyPrint library with proper UTF-8 handling:

```python
# 1. Markdown → HTML with UTF-8 encoding
md_content = md_path.read_text(encoding='utf-8')

# 2. HTML + CSS → PDF with proper font stack
HTML(string=full_html).write_pdf(str(output_path))
```

### Pandoc Solution
Uses LaTeX engine with proper font configuration:

```bash
pandoc input.md -o output.pdf \
  --pdf-engine=xelatex \
  -V CJKmainfont="Noto Sans CJK SC" \
  --highlight-style=github
```

## ✅ Verification

After conversion, verify your PDF has:
- [ ] No Chinese characters (unless intentionally added)
- [ ] No code fragments visible
- [ ] Proper formatting
- [ ] Correct encoding
- [ ] Professional appearance

## 🆘 Troubleshooting

### If Chinese characters still appear:
1. Verify the input markdown file encoding: `file -bi your-file.md`
2. Ensure it's UTF-8: `iconv -f utf-8 -t utf-8 your-file.md -o your-file.md`

### If fonts don't work:
```bash
# Clear font cache
fc-cache -fv

# Verify font installation
fc-list | grep "Noto Sans CJK"
```

## 🧩 Dependencies

### Python Dependencies
```bash
python3 -m pip install markdown weasyprint
```

### System Packages
```bash
# Fonts
yum install -y google-noto-sans-cjk-fonts

# For pandoc (optional)
yum install -y pandoc texlive-xetex
```

---

**Author**: Fixed by OpenClaw PDF Quality Fixer
**Last Updated**: March 2026
**Recommended**: WeasyPrint Clean Solution