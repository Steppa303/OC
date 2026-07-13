// ─── Synth Card (Card Wrapper) ─────────────────────────────────────────
// Lightweight wrapper around the SynthModule content styled as a Card
// (like OscillatorCard, FilterCard, EnvelopeCard) for the card stack view.

import { Radio } from 'lucide-react'
import { CardHeader } from '@/components/touch/CardHeader'
import { SynthModule } from './synth'
import type { CardProps } from '@/types/amy'

export function SynthCard({
  id,
  params,
  onParamChange,
  onSendWire,
  cardIndex,
  totalCards,
  chainInfo,
}: CardProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <CardHeader
        title={`Synth ${params.synth ?? 0}`}
        icon={<Radio size={16} />}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <SynthModule
          id={id}
          params={params}
          onParamChange={onParamChange}
          onSendWire={onSendWire}
        />
      </div>
    </div>
  )
}

export default SynthCard