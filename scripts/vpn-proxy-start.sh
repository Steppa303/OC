#!/bin/bash
# VPN Proxy Setup - WireGuard + SOCKS Proxy (nur Proxy durch VPN)
# Nur Traffic vom vpnproxy User geht durch wg0, alles andere über eth0
set -e

WG_PRIVKEY="yGbTAYxOWLBndwGOj6D37FOevrGLRFSghFMflJ2z0kA="
WG_PSK="4gQnuzxKmmqgj7EY+uFYGlu/5ykT+o2W5bqQQCnzhws="
WG_PEER="yrGKbGIQbRTUZntv8SI4YZD7oBAWRp6+Jv2kvbxZSX4="
WG_EP=$(dig +short hxjyh1nr3l56u9v1.myfritz.net AAAA @8.8.8.8 2>/dev/null)

[ -z "$WG_EP" ] && { echo "ERROR: Endpoint resolution failed!"; exit 1; }
echo "WG Endpoint: [$WG_EP]:55355"

# Cleanup
pkill danted 2>/dev/null || true
ip link del wg0 2>/dev/null || true

# WireGuard (KEIN default route!)
ip link add wg0 type wireguard
wg set wg0 private-key <(echo "$WG_PRIVKEY") \
    peer "$WG_PEER" \
    preshared-key <(echo "$WG_PSK") \
    endpoint "[$WG_EP]:55355" \
    allowed-ips "0.0.0.0/0,::/0,192.168.178.0/24" \
    persistent-keepalive 25

ip addr add 192.168.178.204/24 dev wg0
ip addr add fde8:32f8:d527::204/64 dev wg0
ip link set mtu 1420 up dev wg0

# Endpoint über eth0 (wg0 darf nicht seinen eigenen Endpoint routen!)
ip -6 route replace $WG_EP/128 via fe80::1 dev eth0

# NAT
/sbin/iptables -t nat -A POSTROUTING -o wg0 -j MASQUERADE
echo 1 > /proc/sys/net/ipv4/ip_forward

# VPN User
/usr/sbin/useradd --system --no-create-home --shell /usr/sbin/nologin vpnproxy 2>/dev/null || true

# Routing table
grep -q "wgtable" /etc/iproute2/rt_tables 2>/dev/null || echo "300 wgtable" >> /etc/iproute2/rt_tables
ip route flush table wgtable 2>/dev/null || true
ip route add default dev wg0 table wgtable

# iptables: vpnproxy user traffic → fwmark 0x1 → wgtable
/sbin/iptables -t mangle -F OUTPUT 2>/dev/null || true
/sbin/iptables -t mangle -F PREROUTING 2>/dev/null || true
/sbin/iptables -t mangle -A OUTPUT -m owner --uid-owner vpnproxy -j MARK --set-mark 0x1
/sbin/iptables -t mangle -A OUTPUT -m mark --mark 0x1 -j CONNMARK --save-mark
/sbin/iptables -t mangle -A PREROUTING -m connmark --mark 0x1 -j CONNMARK --restore-mark

ip rule del fwmark 0x1 table wgtable pref 50 2>/dev/null || true
ip rule add fwmark 0x1 table wgtable pref 50

# Dante SOCKS Proxy
cat > /etc/danted/vpn-proxy.conf << 'DANTE'
logoutput: stderr
internal: 127.0.0.1 port = 1080
external: wg0
user.privileged: root
user.notprivileged: vpnproxy
clientmethod: none
socksmethod: none
client pass {
    from: 127.0.0.0/8 to: 0.0.0.0/0
    log: connect disconnect error
}
client block {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect error
}
socks pass {
    from: 127.0.0.0/8 to: 0.0.0.0/0
    command: bind connect udpassociate
    log: connect disconnect error
}
socks block {
    from: 0.0.0.0/0 to: 0.0.0.0/0
    log: connect error
}
DANTE

/usr/sbin/danted -f /etc/danted/vpn-proxy.conf -D 2>&1
sleep 2

echo ""
echo "=== VPN Proxy Active ==="
echo "  SOCKS: socks5://127.0.0.1:1080"
echo "  Normal: $(curl -s --max-time 5 ifconfig.me 2>/dev/null)"
echo "  Proxy:  $(curl -s --socks5 127.0.0.1:1080 -4 --max-time 10 ifconfig.me 2>/dev/null)"
echo ""
echo "  Browser mit VPN: ALL_PROXY=socks5://127.0.0.1:1080 agent-browser open"
