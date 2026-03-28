# Test-Dokument für PDF-Konvertierung

Dies ist ein Test-Dokument, um sicherzustellen, dass keine chinesischen Zeichen im PDF auftauchen.

## Sonderzeichen-Test

- Umlaute: äöü ÄÖÜ ß
- Französisch: àâæçéèêëïîôœùûüÿ
- Russisch: А Б В Г Д Е Ё Ж
- Japanisch: こんにちは (falls versehentlich eingefügt)

## Code-Blöcke-Test

```bash
echo "Dies sollte nicht als Code-Fragment im PDF erscheinen"
ls -la /tmp
```

```python
def hello_world():
    print("Hallo Welt")
```

## Tabellen-Test

| Spalte 1 | Spalte 2 | Spalte 3 |
|----------|----------|----------|
| Wert A   | Wert B   | Wert C   |
| Test 1   | Test 2   | Test 3   |

## Sonderfall: Ursprünglicher Fehler

Hier testen wir, ob das Originalproblem behoben ist:

Statt:
- "Markdown 转 PDF 技能" (chinesisch)
- "小美" (chinesisch)
- "✅ 转换成功！" (chinesisch)

Sollte jetzt alles in korrektem Englisch/Deutsch erscheinen.

## Abschluss

Dieses Dokument dient als Test, dass die PDF-Konvertierung korrekt funktioniert und keine ungewollten chinesischen Zeichen enthält.