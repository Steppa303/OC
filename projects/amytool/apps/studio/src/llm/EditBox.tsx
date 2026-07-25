import { useState } from 'react';
import { useGenerate } from './useGenerate';

/**
 * On-canvas edit instruction box (P2-07): "make the filter snappier" → the LLM
 * returns the full updated PatchPlan, applied as one undoable step (⌘Z reverts).
 */
export function EditBox() {
  const [instruction, setInstruction] = useState('');
  const gen = useGenerate();

  const submit = () => {
    if (instruction.trim() === '') return;
    void gen.edit(instruction).then(() => {
      if (gen.status !== 'error') setInstruction('');
    });
  };

  return (
    <div className="patch-edit-box" data-testid="edit-box">
      <input
        type="text"
        aria-label="Edit patch"
        placeholder="Edit patch… e.g. make the filter snappier"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <button
        type="button"
        data-testid="edit-submit"
        onClick={submit}
        disabled={gen.status === 'running' || instruction.trim() === ''}
      >
        {gen.status === 'running' ? 'Editing…' : 'Edit'}
      </button>
      {gen.status === 'error' && gen.error && (
        <span className="patch-edit-error" role="alert">
          {gen.error}
        </span>
      )}
    </div>
  );
}
