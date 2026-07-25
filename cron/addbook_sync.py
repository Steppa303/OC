#!/usr/bin/env python3
# /root/.local/.openclaw/workspace/addbook/addbook_sync.py
import sys
import os

if __name__ == "__main__":
    from addbook_sync import main
    sys.exit(main(sys.argv[1]))

# From workflow spawn at 2026-07-21T0159:00+0200 UTC
HOME=/root
PATH=/usr/local/bin:/usr/bin:/bin
LANG=C.UTF-8
CMD="python3 /root/.local/.openclaw/workspace/addbook/addbook_sync.py phase2"
ENV={
"HOME": "$HOME",
"PATH": "$PATH",
"LANG": "$LANG",
}