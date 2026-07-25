import { PatchCanvas } from '../patch/PatchCanvas';
import { EngineProvider } from '../patch/engine';

export function PatchWorkspace() {
  return (
    <EngineProvider>
      <PatchCanvas />
    </EngineProvider>
  );
}
