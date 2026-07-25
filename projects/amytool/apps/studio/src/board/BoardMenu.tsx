import { useEffect, useRef, useState } from 'react';
import { useBoardStore } from './boardStore';

/** Board utilities menu (P3-06): save state (zA), ping, reboot. */
export function BoardMenu() {
  const saveToBoard = useBoardStore((s) => s.saveToBoard);
  const pingBoard = useBoardStore((s) => s.pingBoard);
  const rebootBoard = useBoardStore((s) => s.rebootBoard);
  const lastPong = useBoardStore((s) => s.lastPong);

  const [open, setOpen] = useState(false);
  const [pinging, setPinging] = useState(false);
  const pingAt = useRef<number | null>(null);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pong = pinging && lastPong !== null && pingAt.current !== null && lastPong >= pingAt.current;

  const doPing = () => {
    pingAt.current = Date.now();
    setPinging(true);
    pingBoard();
    window.setTimeout(() => setPinging(false), 2000);
  };

  return (
    <span className="board-menu-wrap" ref={wrap}>
      <button type="button" className="board-connect-btn" data-testid="board-menu" onClick={() => setOpen((o) => !o)}>
        Board ▾
      </button>
      {open && (
        <ul className="board-menu" data-testid="board-menu-list">
          <li>
            <button type="button" data-testid="board-save" onClick={() => void saveToBoard()}>
              Save state to board (zA)
            </button>
          </li>
          <li>
            <button type="button" data-testid="board-ping" onClick={doPing}>
              Ping {pong ? '— pong ✓' : pinging ? '…' : ''}
            </button>
          </li>
          <li>
            <button type="button" data-testid="board-reboot" onClick={() => rebootBoard(false)}>
              Reboot (run sketch)
            </button>
          </li>
          <li>
            <button type="button" data-testid="board-reboot-boot" onClick={() => rebootBoard(true)}>
              Reboot to bootloader
            </button>
          </li>
        </ul>
      )}
    </span>
  );
}
