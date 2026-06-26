#!/usr/bin/env python3
"""
remote.py – AMYboard Remote Server
===================================
WLAN + TCP Command Server auf Port 2323.
NIEMALS EDITIEREN! Diese Datei ist die Lebensader zum Board.

Protokoll:
  PING        → PONG
  <eval>      → repr(ergebnis)
  <statement> → ok | ERR:<message>
"""

import network, socket, time, amyboard

# === WLAN ===
_wlan = network.WLAN(network.STA_IF)
if not _wlan.isconnected():
    _wlan.active(True)
    _wlan.connect('FRITZ!Box 7590 IB', 'K13#wlan2023')
    for _ in range(40):
        if _wlan.isconnected():
            break
        time.sleep(0.25)

# === TCP Server ===
_server = socket.socket()
_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
_server.bind(('0.0.0.0', 2323))
_server.listen(1)
# WICHTIG: setblocking(False) statt settimeout() – settimeout gibt EINVAL auf AMYboard!
_server.setblocking(False)


def _handle(c):
    """Ein Client-Request bearbeiten."""
    import sys
    try:
        data = c.recv(4096).decode().strip()
        if data == 'PING':
            c.send(b'PONG\n')
            return
        try:
            r = eval(data)
            c.send((repr(r) + '\n').encode())
        except SyntaxError:
            try:
                exec(data)
                c.send(b'ok\n')
            except Exception as e:
                c.send(('ERR:' + str(e) + '\n').encode())
    except Exception:
        pass
    finally:
        c.close()


def remote_loop():
    """Einmaliger non-blocking Poll. Wird von sketch.py loop() aufgerufen."""
    global _server
    try:
        conn, addr = _server.accept()
        _handle(conn)
    except OSError:
        pass  # keine Verbindung = ok bei non-blocking