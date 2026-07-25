import { useEffect } from 'react';
import { compileToSketch } from '@amy/patchdoc';
import { useBoardStore } from './boardStore';
import { BoardMenu } from './BoardMenu';
import { usePatchStore } from '../patch/patchStore';
import { moduleInfoProvider } from '../patch/routing';
import './board.css';

const LABEL: Record<string, string> = {
  disconnected: 'no board',
  connecting: 'connecting…',
  connected: 'AMYboard',
  error: 'board error',
};

/**
 * Topbar board chip (P3-02) + sketch upload trigger (P3-03). Connection, upload
 * progress and tracebacks all live in the shared board store.
 */
export function BoardStatus() {
  const supported = useBoardStore((s) => s.supported);
  const connection = useBoardStore((s) => s.connection);
  const detail = useBoardStore((s) => s.detail);
  const upload = useBoardStore((s) => s.upload);
  const ensure = useBoardStore((s) => s.ensure);
  const connect = useBoardStore((s) => s.connect);
  const disconnect = useBoardStore((s) => s.disconnect);
  const uploadSketch = useBoardStore((s) => s.uploadSketch);
  const importFromBoard = useBoardStore((s) => s.importFromBoard);
  const importing = useBoardStore((s) => s.importing);
  const doc = usePatchStore((s) => s.doc);

  useEffect(() => ensure(), [ensure]);

  if (!supported) {
    return (
      <span className="board-status" data-testid="board-status" data-state="unsupported" title={detail ?? ''}>
        <span className="status-dot" /> MIDI unsupported
      </span>
    );
  }

  const connected = connection === 'connected';
  const busy = connection === 'connecting';
  const uploading = upload !== null;

  const doUpload = () => {
    const { source } = compileToSketch(doc, moduleInfoProvider);
    void uploadSketch(source);
  };

  return (
    <span className="board-status" data-testid="board-status" data-state={connection} title={detail ?? ''}>
      <span className={`status-dot status-dot-${connection}`} />
      <span data-testid="board-label">{LABEL[connection] ?? connection}</span>
      <button
        type="button"
        className="board-connect-btn"
        data-testid="board-connect"
        disabled={busy}
        onClick={() => void (connected ? disconnect() : connect())}
      >
        {connected ? 'Disconnect' : 'Connect'}
      </button>
      {connected && (
        <button
          type="button"
          className="board-connect-btn"
          data-testid="board-upload"
          disabled={uploading}
          onClick={doUpload}
        >
          {uploading ? `Uploading ${upload.sent}/${upload.total}` : '⬆ Upload'}
        </button>
      )}
      {connected && (
        <button
          type="button"
          className="board-connect-btn"
          data-testid="board-import"
          disabled={importing}
          onClick={() => void importFromBoard()}
        >
          {importing ? 'Importing…' : '⬇ Import'}
        </button>
      )}
      {connected && <BoardMenu />}
    </span>
  );
}
