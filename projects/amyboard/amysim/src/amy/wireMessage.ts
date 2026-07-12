// Wire-Message Builder/Decoder für AMY
import type { AMYParams } from '../lib/types';

export type WireCallback = (msg: AMYParams) => void;

let interceptors: WireCallback[] = [];

// AMY send mit optionalem Intercept
export function amySend(params: AMYParams): void {
  const w = window as any;
  if (typeof w.amy_send === 'function') {
    w.amy_send(params);
  }
  // Notify interceptors (für Log/Monitor)
  interceptors.forEach(cb => cb({ ...params }));
}

// Interceptor registrieren (z.B. für Wire-Message-Log)
export function addWireInterceptor(cb: WireCallback): () => void {
  interceptors.push(cb);
  return () => {
    interceptors = interceptors.filter(c => c !== cb);
  };
}

// Note-on => AMY-Kommando
export function noteOn(note: number, vel: number = 0.8, osc: number = 0): void {
  amySend({ osc, note, vel });
}

// Note-off
export function noteOff(note: number, osc: number = 0): void {
  amySend({ osc, note, vel: 0 });
}

// ADSR-Breakpoint-String bauen
export function buildBPString(breakpoints: [number, number][]): string {
  return breakpoints.map(bp => `${bp[0]},${bp[1]}`).join(',');
}

// CtrlCoefs in Dict-Form senden (amy_send unterstützt dict-style)
export function applyCtrlCoef(osc: number, param: string, coefs: Record<string, number>): void {
  const msg: AMYParams = { osc };
  (msg as any)[param] = coefs;
  amySend(msg);
}

// Effekt-Parameter als String
export function buildEffectString(values: number[]): string {
  return values.join(',');
}