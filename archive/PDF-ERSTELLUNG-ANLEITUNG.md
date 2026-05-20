# Anleitung für saubere PDF-Erstellung

Diese Anleitung zeigt, wie man künftig saubere PDFs ohne chinesische Zeichen und Code-Fragmente erstellt.

## ✅ Empfohlene Methode: WeasyPrint Clean

Nutze das bereinigte Skript, das keine chinesischen Zeichen enthält:

```bash
# Standard-Konvertierung
bash /root/.openclaw/workspace/skills/md2pdf-weasyprint/scripts/convert-weasyprint-clean.sh eingabe.md

# Mit spezifischem Ausgabename
bash /root/.openclaw/workspace/skills/md2pdf-weasyprint/scripts/convert-weasyprint-clean.sh eingabe.md ausgabe.pdf
```

## 🚫 Zu vermeidende Methoden

Vermeide folgende Ansätze, die chinesische Zeichen oder Code-Fragmente erzeugen können:

- Das Originalskript `convert-weasyprint.sh` (enthält chinesischen Text)
- Markdown-Dateien mit chinesischem Content
- Unsachgemäße Kodierung der Eingabedateien

## 📝 Sauberes Markdown-Template

Nutze dieses Template für neue Dokumente:

```markdown
# Titel

## Überschrift

Textinhalt hier.

### Untertitel
- Liste
- Elemente

## Code-Hinweis

Keine echten Code-Blöcke im fertigen PDF erwünscht.
Stattdessen Beschreibungen verwenden:

Der Befehl `ls -la` zeigt alle Dateien.
```

## 🔍 Qualitätssicherung

Vor der Verwendung überprüfe das PDF auf:

- [ ] Keine chinesischen Zeichen
- [ ] Keine sichtbaren Code-Fragmente
- [ ] Korrekte Formatierung
- [ ] Lesbare Schrift
- [ ] Korrekte Umlaute (äöü)

## 🛠️ Problembehandlung

### Falls chinesische Zeichen immer noch auftauchen:
1. Überprüfe die Eingabedatei auf chinesischen Content
2. Stelle sicher, dass UTF-8 Kodierung verwendet wird
3. Nutze das `convert-weasyprint-clean.sh` Skript

### Falls Formatierungsprobleme auftreten:
1. Überprüfe die Markdown-Syntax
2. Vermeide verschachtelte Listen mit Sonderzeichen
3. Nutze einfache Formatierungen

## 📁 Datei-Management

Die bereinigten Skripte befinden sich unter:
- `/root/.openclaw/workspace/skills/md2pdf-weasyprint/scripts/convert-weasyprint-clean.sh`
- `/root/.openclaw/workspace/skills/md2pdf-weasyprint/scripts/convert-weasyprint-clean.py`

## 🔄 Updates

Diese Lösung ersetzt die ursprüngliche "小美" (Xiao Mei) Implementation und verhindert:
- Chinesische Zeichen im Output
- Unnötige Code-Fragmente
- Falsche Sprachattribute
- Encoding-Probleme

## ✅ Bestätigung

Diese Methode wurde getestet mit:
- Deutschsprachigem Content
- Umlauten und Sonderzeichen
- Tabellen und Listen
- Code-Blöcken (als Text)
- Sonderzeichen verschiedener Sprachen