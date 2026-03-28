#!/bin/bash
# Setup Script für automatisches Agent Dashboard Cleanup

echo "🔧 Agent Dashboard Auto-Cleanup Setup"

# Prüfen ob das Skript existiert
if [ ! -f "/root/.openclaw/workspace/scripts/cleanup-agents.sh" ]; then
    echo "❌ Cleanup-Skript nicht gefunden!"
    exit 1
fi

echo "✅ Cleanup-Skript gefunden"

# Prüfen ob crontab verfügbar ist
if ! command -v crontab &> /dev/null; then
    echo "❌ crontab nicht verfügbar!"
    exit 1
fi

echo "✅ crontab verfügbar"

# Aktuellen crontab sichern
crontab -l > /tmp/current_crontab_backup_$(date +%s).txt 2>/dev/null
echo "📋 Aktueller crontab gesichert in /tmp/current_crontab_backup_*.txt"

# Prüfen ob der Eintrag bereits existiert
if crontab -l 2>/dev/null | grep -q "cleanup-agents.sh"; then
    echo "⚠️  Auto-Cleanup Eintrag existiert bereits"
else
    echo "⏰ Füge täglichen Cleanup-Job hinzu (2:00 Uhr täglich)"
    
    # Aktuellen crontab laden und neuen Eintrag hinzufügen
    (crontab -l 2>/dev/null; echo "0 2 * * * /root/.openclaw/workspace/scripts/cleanup-agents.sh >> /var/log/agent-cleanup.log 2>&1") | crontab -
    
    echo "✅ Auto-Cleanup Job hinzugefügt"
fi

echo "📄 Inhalt des neuen crontabs:"
crontab -l

echo ""
echo "🎉 Setup abgeschlossen!"
echo ""
echo "Der tägliche Cleanup-Job wurde eingerichtet."
echo "Er läuft täglich um 2:00 Uhr und bereinigt alte Agents."
echo ""
echo "Logs sind verfügbar unter: /var/log/agent-cleanup.log"