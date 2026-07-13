// ─── AMY Wire Bridge ──────────────────────────────────────────────────
// Generates proper AMY wire messages from card params for live parameter
// updates on the connected AMY board.

/**
 * Generate AMY wire message from card params
 */
export function cardParamsToWire(
  moduleType: string,
  params: Record<string, any>,
): string {
  switch (moduleType) {
    case 'oscillator': {
      const osc = params.osc ?? 0
      const wave = params.wave ?? 0
      const freq = params.freq ?? 440
      const amp = params.amp ?? 1
      const pan = params.pan ?? 0.5
      const bus = params.bus ?? 0
      return `v${osc}w${wave}f${freq}a${amp}Q${pan}y${bus}`
    }
    case 'filter': {
      const osc = params.osc ?? 0
      const type = params.filter_type ?? 1
      const cutoff = params.cutoff ?? 8000
      const res = params.resonance ?? 0.7
      return `v${osc}G${type}F${cutoff}R${res}`
    }
    case 'envelope': {
      const osc = params.osc ?? 0
      const egId = params.egId ?? 0
      const attack = params.attack ?? 100
      const decay = params.decay ?? 200
      const sustain = params.sustain ?? 0.5
      const release = params.release ?? 300
      const egType = params.eg_type ?? 0
      const bpKey = egId === 0 ? 'bp0' : 'bp1'
      // Build breakpoint string from ADSR
      const totalA = attack
      const totalAD = totalA + decay
      const totalADR = totalAD + release
      const bpStr = `${totalA},1,${totalAD},${sustain},${totalADR},0`
      return `v${osc}${bpKey === 'bp0' ? 'A' : 'B'}${bpStr}T${egType}`
    }
    case 'lfo': {
      const osc = params.osc ?? 0
      const modSource = params.lfoId ?? 1
      return `v${osc}L${modSource}`
    }
    default:
      return ''
  }
}

/**
 * Send individual card param changes as live AMY wire messages
 */
export function sendCardParamUpdate(
  moduleType: string,
  key: string,
  value: any,
  params: Record<string, any>,
  sendWire: (wire: string) => void,
): void {
  const osc = params.osc ?? 0

  switch (moduleType) {
    case 'oscillator':
      if (key === 'wave') sendWire(`v${osc}w${value}`)
      else if (key === 'freq') sendWire(`v${osc}f${value}`)
      else if (key === 'amp') sendWire(`v${osc}a${value}`)
      else if (key === 'pan') sendWire(`v${osc}Q${value}`)
      else if (key === 'bus') sendWire(`v${osc}y${value}`)
      else if (key === 'detune') sendWire(`v${osc}d${value}`)
      else if (key === 'portamento') sendWire(`v${osc}m${value}`)
      break

    case 'filter':
      if (key === 'filter_type') sendWire(`v${osc}G${value}`)
      else if (key === 'cutoff') sendWire(`v${osc}F${value}`)
      else if (key === 'resonance') sendWire(`v${osc}R${value}`)
      else if (key === 'modEg1') {
        // EG1 → filter_freq modulation amount
        // This is sent via the filter_freq coef eg1 slot
        sendWire(`v${osc}F0,0,0,${value},0,0,0,0,0`)
      }
      else if (key === 'modLfo') {
        sendWire(`v${osc}F0,0,0,0,0,${value},0,0,0`)
      }
      break

    case 'envelope': {
      const egId = params.egId ?? 0
      const bpKey = egId === 0 ? 'bp0' : 'bp1'
      const attack = key === 'attack' ? value : (params.attack ?? 100)
      const decay = key === 'decay' ? value : (params.decay ?? 200)
      const sustain = key === 'sustain' ? value : (params.sustain ?? 0.5)
      const release = key === 'release' ? value : (params.release ?? 300)
      const egType = key === 'eg_type' ? value : (params.eg_type ?? 0)

      const totalA = attack
      const totalAD = totalA + decay
      const totalADR = totalAD + release
      const bpStr = `${totalA},1,${totalAD},${sustain},${totalADR},0`

      if (key === 'eg_type') {
        sendWire(`v${osc}${egId === 0 ? 'T' : 'X'}${value}`)
      } else {
        sendWire(`v${osc}${egId === 0 ? 'A' : 'B'}${bpStr}`)
      }
      break
    }

    case 'lfo':
      if (key === 'freq') sendWire(`v${osc}L${osc}`) // set mod source
      else if (key === 'wave') sendWire(`v${osc}w${value}`)
      break
  }
}