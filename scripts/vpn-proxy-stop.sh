#!/bin/bash
# VPN Proxy Stop
pkill danted 2>/dev/null || true
/sbin/iptables -t mangle -F OUTPUT 2>/dev/null || true
/sbin/iptables -t mangle -F PREROUTING 2>/dev/null || true
ip rule del fwmark 0x1 table wgtable pref 50 2>/dev/null || true
ip route flush table wgtable 2>/dev/null || true
ip link del wg0 2>/dev/null || true
echo "VPN Proxy gestoppt."
