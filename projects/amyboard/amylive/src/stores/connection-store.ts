// ─── Connection State Store (Zustand) ─────────────────────────────────
// Tracks WebMIDI connection lifecycle and exposes connect / disconnect /
// ping actions. Delegates actual MIDI I/O to the singleton AMYConnection.

import { create } from 'zustand';
import { amyConnection, type ConnectionState } from '@/lib/amy-connection';
import { useLogStore } from './log-store';

export interface ConnectionStore {
  // ── Readable State ──────────────────────────────────────────────────
  state: ConnectionState;
  deviceName: string;
  firmwareVersion: string;
  error: string | null;

  // ── Actions ─────────────────────────────────────────────────────────
  /**
   * Open a MIDI connection to an AMY board.
   * @param deviceName Optional filter for the device name.
   * @returns true on success, false otherwise.
   */
  connect: (deviceName?: string) => Promise<boolean>;

  /** Gracefully close the MIDI connection. */
  disconnect: () => void;

  /**
   * Ping the connected board.
   * @returns true if the board responded, false on timeout / error.
   */
  ping: () => Promise<boolean>;

  /** Clear the current error. */
  clearError: () => void;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => {
  // Wire up singleton callbacks once (they persist across store lifetime).
  let callbacksWired = false;

  function wireCallbacks(): void {
    if (callbacksWired) return;
    callbacksWired = true;

    amyConnection.onStateChange = (state: ConnectionState) => {
      const log = useLogStore.getState();
      if (state === 'connected') {
        log.log('connection', `State: connected (${amyConnection.deviceName})`);
      } else if (state === 'disconnected') {
        log.log('connection', 'State: disconnected');
      } else if (state === 'error') {
        log.log('error', 'Connection state: error');
      }
      set({
        state,
        deviceName: amyConnection.deviceName,
        firmwareVersion: amyConnection.firmwareVersion,
      });
    };

    amyConnection.onError = (msg: string) => {
      useLogStore.getState().log('error', msg);
      set({ error: msg, state: 'error' });
    };
  }

  return {
    state: 'disconnected',
    deviceName: '',
    firmwareVersion: '',
    error: null,

    connect: async (deviceName?: string) => {
      wireCallbacks();

      set({ error: null, state: 'connecting' });
      useLogStore.getState().log(
        'connection',
        `Connecting${deviceName ? ' to ' + deviceName : ''}…`,
      );
      const ok = await amyConnection.connect(deviceName);

      if (ok) {
        const name = amyConnection.deviceName;
        const fw = amyConnection.firmwareVersion;
        set({
          state: 'connected',
          deviceName: name,
          firmwareVersion: fw,
        });
        useLogStore.getState().log(
          'connection',
          `Connected to ${name}${fw ? ' (FW: ' + fw + ')' : ''}`,
        );
      } else {
        set({ state: 'error' });
        useLogStore.getState().log('error', 'Connection failed');
      }

      return ok;
    },

    disconnect: () => {
      const name = get().deviceName;
      amyConnection.disconnect();
      set({
        state: 'disconnected',
        deviceName: '',
        firmwareVersion: '',
        error: null,
      });
      useLogStore.getState().log(
        'connection',
        `Disconnected from ${name || 'AMYboard'}`,
      );
    },

    ping: async () => {
      const { state } = get();
      if (state !== 'connected') return false;

      try {
        const ok = await amyConnection.ping(3000);
        useLogStore.getState().log('ping', ok ? 'Pong OK' : 'Ping timeout');
        if (!ok) set({ error: 'Ping fehlgeschlagen.' });
        return ok;
      } catch {
        set({ error: 'Ping fehlgeschlagen.' });
        useLogStore.getState().log('ping', 'Ping error');
        return false;
      }
    },

    clearError: () => set({ error: null }),
  };
});