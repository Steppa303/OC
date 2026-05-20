#!/bin/bash
# Persistent WireGuard wg0 manager
# Erstellt wg0 neu wenn es gelöscht wird und hält es am Leben

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

ALLOWED_IPS="${1:-0.0.0.0/0,::/0}"
LOG="/tmp/wg0-persistent.log"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

setup_wg0() {
    ip link del wg0 2>/dev/null
    sleep 0.5
    ip link add wg0 type wireguard || { log "Fehler: wg0 erstellen fehlgeschlagen"; return 1; }

    wg set wg0 private-key <(printf '%s' 'yGbTAYxOWLBndwGOj6D37FOevrGLRFSghFMflJ2z0kA=')
    wg set wg0 peer "yrGKbGIQbRTUZntv8SI4YZD7oBAWRp6+Jv2kvbxZSX4=" \
        preshared-key <(printf '%s' '4gQnuzxKmmqgj7EY+uFYGlu/5ykT+o2W5bqQQCnzhws=') \
        allowed-ips "$ALLOWED_IPS" \
        endpoint "[2a00:6020:1000:35::bc0]:55355" \
        persistent-keepalive 25
    ip addr add 192.168.178.204/24 dev wg0
    ip link set wg0 up
    log "wg0 erstellt, AllowedIPs: $ALLOWED_IPS"
}

# Initial setup
setup_wg0

# Loop: prüfe alle 5 Sekunden ob wg0 noch da ist
while true; do
    sleep 5
    if ! ip link show wg0 >/dev/null 2>&1; then
        log "wg0 wurde gelöscht - erstelle neu"
        setup_wg0
    fi
done
