import { memo, useMemo, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Display, NodeRow, Panel, Select, Slider, Toggle } from '@amy/ui';
import {
  DEVICE_MODULE_TYPE,
  deviceFromState,
  deviceToManifest,
  jackLabel,
  registry,
  type ModuleJack,
  type ModuleParam,
} from '@amy/modules';
import { usePatchStore } from './patchStore';
import { PianoKeys } from './PianoKeys';
import { AudioMeter } from './audioInput';
import { ScopeDisplay } from './ScopeDisplay';
import { DrumGrid, StepSeq } from './Sequencers';
import { useOpenMenu, type ContextMenuItem } from './ContextMenu';
import { jackMenu, moduleMenu } from './moduleMenu';
import { colorCss } from './colorTags';

/** Node data is just the id; the instance is read live from the store so param
 *  changes re-render without rebuilding the React Flow node array. */
export interface ModuleNodeData extends Record<string, unknown> {
  moduleId: string;
}

/** Sensible slider step: fine for small ranges, whole steps for large ones. */
function sliderStep(min: number, max: number): number {
  return max - min <= 4 ? 0.01 : 1;
}

/** The inner control for a param row (slider for knob/slider, select/toggle otherwise). */
const ParamControl = memo(function ParamControl({
  moduleId,
  param,
  value,
}: {
  moduleId: string;
  param: ModuleParam;
  value: string | number | boolean;
}) {
  const setParam = usePatchStore((s) => s.setParam);
  switch (param.control) {
    case 'select':
      return (
        <Select
          label={param.label}
          value={String(value)}
          options={param.options ?? []}
          onChange={(v) => setParam(moduleId, param.id, v)}
        />
      );
    case 'toggle':
      return (
        <Toggle
          label={param.label}
          checked={Boolean(value)}
          onChange={(v) => setParam(moduleId, param.id, v)}
        />
      );
    // knob + slider both render as a horizontal row slider (Stufe 2).
    default: {
      const min = param.min ?? 0;
      const max = param.max ?? 1;
      return (
        <Slider
          label={param.label}
          value={typeof value === 'number' ? value : Number(param.default)}
          min={min}
          max={max}
          step={sliderStep(min, max)}
          {...(param.unit !== undefined ? { unit: param.unit } : {})}
          onChange={(v) => setParam(moduleId, param.id, v)}
        />
      );
    }
  }
});

/** A single edge socket: kind-colored dot + a React Flow handle that carries the
 *  jack id. Right-click opens the jack menu (P7-02). Renders a stub (handle only,
 *  no dot) when a connected advanced jack is collapsed (P5-07). */
function NodePin({
  jack,
  connected,
  stub,
  onJackContext,
}: {
  jack: ModuleJack;
  connected: boolean;
  stub: boolean;
  onJackContext: (e: ReactMouseEvent, jackId: string, label: string) => void;
}) {
  return (
    <span
      className={`nodrag node-pin-slot${stub ? ' node-pin-stub' : ''}`}
      data-jack={jack.id}
      title={jackLabel(jack)}
      onContextMenu={(e) => onJackContext(e, jack.id, jackLabel(jack))}
    >
      {!stub && (
        <span className={`ui-node-pin ui-node-pin-${jack.kind}${connected ? ' connected' : ''}`} aria-hidden="true" />
      )}
      <Handle
        type={jack.dir === 'out' ? 'source' : 'target'}
        position={jack.dir === 'out' ? Position.Right : Position.Left}
        id={jack.id}
        className={`node-handle jack-handle-${jack.kind}${stub ? ' node-handle-stub' : ''}`}
      />
    </span>
  );
}

function AdvancedToggle({ moduleId, advanced }: { moduleId: string; advanced: boolean }) {
  const setAdvanced = usePatchStore((s) => s.setAdvanced);
  return (
    <button
      type="button"
      className="nodrag module-advanced-toggle"
      data-testid={`advanced-toggle-${moduleId}`}
      aria-pressed={advanced}
      title={advanced ? 'Hide advanced controls' : 'Show advanced controls'}
      onClick={() => setAdvanced(moduleId, !advanced)}
    >
      {advanced ? '⌃ less' : '⌄ more'}
    </button>
  );
}

function ModuleNodeInner({ data }: NodeProps) {
  const moduleId = (data as ModuleNodeData).moduleId;
  const instance = usePatchStore((s) => s.doc.modules.find((m) => m.id === moduleId));
  const cables = usePatchStore((s) => s.doc.cables);
  const openMenu = useOpenMenu();
  const disconnectJack = usePatchStore((s) => s.disconnectJack);
  const highlightJackCables = usePatchStore((s) => s.highlightJackCables);
  const renameModule = usePatchStore((s) => s.renameModule);
  const replaceModule = usePatchStore((s) => s.replaceModule);
  const setModuleColor = usePatchStore((s) => s.setModuleColor);
  const copyModuleParams = usePatchStore((s) => s.copyModuleParams);
  const pasteModuleParams = usePatchStore((s) => s.pasteModuleParams);
  const clipboardType = usePatchStore((s) => s.paramClipboard?.type ?? null);
  const removeModules = usePatchStore((s) => s.removeModules);
  const connected = useMemo(() => {
    const set = new Set<string>();
    for (const c of cables) {
      if (c.from.module === moduleId) set.add(c.from.jack);
      if (c.to.module === moduleId) set.add(c.to.jack);
    }
    return set;
  }, [cables, moduleId]);
  // Device Modules (P6-03) render from the DeviceManifest embedded in their
  // instance state, not from the registry's empty core.device base entry.
  const deviceManifest = useMemo(() => {
    if (!instance || instance.type !== DEVICE_MODULE_TYPE) return null;
    const device = deviceFromState(instance.state);
    return device ? deviceToManifest(device) : null;
  }, [instance]);
  if (!instance) return null;
  const inst = instance;
  const manifest = deviceManifest ?? registry.byId(inst.type);
  if (!manifest) {
    return (
      <Panel name={inst.label} hp={6} node onClose={() => removeModules([moduleId])}>
        <Display kind="text" lines={['unknown module', inst.type]} />
      </Panel>
    );
  }

  const showAdvanced = inst.advanced;
  const hp = showAdvanced ? (manifest.advancedHp ?? manifest.hp) : manifest.hp;
  const visibleParams = manifest.params.filter((p) => !p.advanced || showAdvanced);
  const hasAdvanced =
    manifest.advancedHp !== undefined ||
    manifest.params.some((p) => p.advanced) ||
    manifest.jacks.some((j) => j.advanced);

  const onJackContext = (e: ReactMouseEvent, jackId: string, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    const hasCables = cables.some(
      (c) =>
        (c.from.module === moduleId && c.from.jack === jackId) ||
        (c.to.module === moduleId && c.to.jack === jackId),
    );
    openMenu(
      jackMenu({ x: e.clientX, y: e.clientY }, moduleId, jackId, label, hasCables, {
        disconnect: disconnectJack,
        highlight: highlightJackCables,
      }),
    );
  };

  const openModuleMenu = (x: number, y: number) => {
    openMenu(
      moduleMenu({ x, y }, inst, clipboardType === inst.type, {
        rename: (id) => {
          const next = window.prompt('Rename module', inst.label);
          if (next !== null) renameModule(id, next);
        },
        replace: replaceModule,
        setColor: setModuleColor,
        copyParams: copyModuleParams,
        pasteParams: pasteModuleParams,
        reopen: (items: ContextMenuItem[], title: string) => openMenu({ x, y, items, title }),
      }),
    );
  };

  // A jack should render (as a pin or stub) when it's non-advanced, advanced view
  // is on, or it's a connected advanced jack we keep as a stub (P5-07).
  const jackShows = (j: ModuleJack) => !j.advanced || showAdvanced || connected.has(j.id);
  const pinFor = (j: ModuleJack): ReactNode => (
    <NodePin
      jack={j}
      connected={connected.has(j.id)}
      stub={j.advanced && !showAdvanced}
      onJackContext={onJackContext}
    />
  );

  // Param rows consume any input jack linked to them (jack.param === param.id).
  const consumed = new Set<string>();
  const paramRows = visibleParams.map((p) => {
    const inJack = manifest.jacks.find((j) => j.dir === 'in' && j.param === p.id && jackShows(j));
    if (inJack) consumed.add(inJack.id);
    return (
      <NodeRow key={`p-${p.id}`} {...(inJack ? { leftPin: pinFor(inJack) } : {})}>
        <ParamControl moduleId={moduleId} param={p} value={inst.params[p.id] ?? (p.default as string | number | boolean)} />
      </NodeRow>
    );
  });

  // Remaining input jacks (not consumed by a param row) as their own input rows.
  const inputRows = manifest.jacks
    .filter((j) => j.dir === 'in' && !consumed.has(j.id) && jackShows(j))
    .map((j) => (
      <NodeRow key={`in-${j.id}`} leftPin={pinFor(j)}>
        {!(j.advanced && !showAdvanced) && <span className="ui-noderow-label">{jackLabel(j)}</span>}
      </NodeRow>
    ));

  // Output jacks as right-pinned rows.
  const outputRows = manifest.jacks
    .filter((j) => j.dir === 'out' && jackShows(j))
    .map((j) => (
      <NodeRow key={`out-${j.id}`} className="ui-noderow-out" rightPin={pinFor(j)}>
        <span className="ui-noderow-label">{jackLabel(j)}</span>
      </NodeRow>
    ));

  const widgets: ReactNode[] = [];
  if (manifest.id === 'core.keyboard')
    widgets.push(
      <PianoKeys key="keys" octave={Number(inst.params['octave'] ?? 4)} velocity={Number(inst.params['velocity'] ?? 1)} />,
    );
  if (manifest.id === 'core.audioin') widgets.push(<AudioMeter key="mic" />);
  if (manifest.id === 'core.drumgrid') widgets.push(<DrumGrid key="grid" moduleId={moduleId} />);
  if (manifest.id === 'core.stepseq16') widgets.push(<StepSeq key="seq" moduleId={moduleId} />);
  for (const d of manifest.displays) {
    if (d.kind === 'scope') widgets.push(<ScopeDisplay key={`d-${d.id}`} />);
    else if (d.kind === 'value')
      widgets.push(<Display key={`d-${d.id}`} kind="value" value={String(inst.params[d.source] ?? '')} label={d.id} />);
    else
      widgets.push(
        <Display key={`d-${d.id}`} kind="text" lines={String(inst.state[d.source] ?? '').split('\n').slice(0, 12)} />,
      );
  }

  return (
    <Panel
      name={inst.label}
      hp={hp}
      node
      {...(colorCss(inst.color) ? { accent: colorCss(inst.color) as string } : {})}
      onMenu={() => {
        const el = document.querySelector(`[data-id="${moduleId}"]`)?.getBoundingClientRect();
        openModuleMenu(el ? el.right - 8 : 0, el ? el.top + 24 : 0);
      }}
      onPanelContext={(e) => {
        e.preventDefault();
        openModuleMenu(e.clientX, e.clientY);
      }}
      onClose={() => removeModules([moduleId])}
    >
      <div className="nodrag module-rows">
        {hasAdvanced && (
          <div className="module-advanced-row">
            <AdvancedToggle moduleId={moduleId} advanced={showAdvanced} />
          </div>
        )}
        {paramRows}
        {inputRows}
        {widgets.length > 0 && (
          <NodeRow className="ui-noderow-wide">
            <div className="module-widgets">{widgets}</div>
          </NodeRow>
        )}
        {outputRows}
      </div>
    </Panel>
  );
}

export const ModuleNode = memo(ModuleNodeInner);
