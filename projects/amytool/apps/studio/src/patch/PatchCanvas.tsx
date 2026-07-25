import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type IsValidConnection,
  type Node,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';
import { usePatchStore } from './patchStore';
import { ModuleNode, type ModuleNodeData } from './ModuleNode';
import { CableEdge } from './CableEdge';
import { Palette } from './Palette';
import { Transport } from './Transport';
import { PatchBar } from './PatchBar';
import { StarterGallery } from './StarterGallery';
import { OnboardingTour } from './OnboardingTour';
import { CommandPalette } from './CommandPalette';
import { ContextMenu, MenuProvider, type ContextMenuState } from './ContextMenu';
import { useToastStore } from './toastStore';
import { GeneratePanel } from '../llm/GeneratePanel';
import { EditBox } from '../llm/EditBox';
import { hpToPx, pxToHp, SNAP_GRID } from './geometry';
import './patch.css';

const nodeTypes: NodeTypes = { module: ModuleNode };
const edgeTypes: EdgeTypes = { cable: CableEdge };

function connToRefs(conn: Connection | Edge) {
  return {
    from: { module: conn.source, jack: conn.sourceHandle ?? '' },
    to: { module: conn.target, jack: conn.targetHandle ?? '' },
  };
}

function CanvasInner() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const pushToast = useToastStore((s) => s.push);
  const [genOpen, setGenOpen] = useState(false);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const cableTidy = usePatchStore((s) => s.cableTidy);
  const setCableTidy = usePatchStore((s) => s.setCableTidy);

  const { modules, cables, dragPx, selectedIds, selectedEdgeIds } = usePatchStore(
    useShallow((s) => ({
      modules: s.doc.modules,
      cables: s.doc.cables,
      dragPx: s.dragPx,
      selectedIds: s.selectedIds,
      selectedEdgeIds: s.selectedEdgeIds,
    })),
  );
  const setDragPx = usePatchStore((s) => s.setDragPx);
  const commitDrag = usePatchStore((s) => s.commitDrag);
  const removeModules = usePatchStore((s) => s.removeModules);
  const duplicateModules = usePatchStore((s) => s.duplicateModules);
  const setSelected = usePatchStore((s) => s.setSelected);
  const setSelectedEdges = usePatchStore((s) => s.setSelectedEdges);
  const addModule = usePatchStore((s) => s.addModule);
  const insertGroup = usePatchStore((s) => s.insertGroup);
  const addCable = usePatchStore((s) => s.addCable);
  const removeCables = usePatchStore((s) => s.removeCables);
  const undo = usePatchStore((s) => s.undo);
  const redo = usePatchStore((s) => s.redo);

  const nodes = useMemo<Node<ModuleNodeData>[]>(
    () =>
      modules.map((m) => ({
        id: m.id,
        type: 'module',
        position: dragPx[m.id] ?? hpToPx(m.pos),
        data: { moduleId: m.id },
        selected: selectedIds.includes(m.id),
      })),
    [modules, dragPx, selectedIds],
  );

  const edges = useMemo<Edge[]>(
    () =>
      cables.map((c) => ({
        id: c.id,
        source: c.from.module,
        sourceHandle: c.from.jack,
        target: c.to.module,
        targetHandle: c.to.jack,
        type: 'cable',
        data: { kind: c.kind },
        selected: selectedEdgeIds.includes(c.id),
      })),
    [cables, selectedEdgeIds],
  );

  const showToast = useCallback((message: string) => pushToast(message, 'error'), [pushToast]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nextSelected = new Set(selectedIds);
      const toRemove: string[] = [];
      let selectionChanged = false;
      for (const c of changes) {
        if (c.type === 'position' && c.position) {
          setDragPx(c.id, c.position);
        } else if (c.type === 'select') {
          selectionChanged = true;
          if (c.selected) nextSelected.add(c.id);
          else nextSelected.delete(c.id);
        } else if (c.type === 'remove') {
          toRemove.push(c.id);
        }
      }
      if (toRemove.length > 0) removeModules(toRemove);
      else if (selectionChanged) setSelected([...nextSelected]);
    },
    [selectedIds, setDragPx, removeModules, setSelected],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nextSelected = new Set(selectedEdgeIds);
      const toRemove: string[] = [];
      let selectionChanged = false;
      for (const c of changes) {
        if (c.type === 'select') {
          selectionChanged = true;
          if (c.selected) nextSelected.add(c.id);
          else nextSelected.delete(c.id);
        } else if (c.type === 'remove') {
          toRemove.push(c.id);
        }
      }
      if (toRemove.length > 0) removeCables(toRemove);
      else if (selectionChanged) setSelectedEdges([...nextSelected]);
    },
    [selectedEdgeIds, removeCables, setSelectedEdges],
  );

  // Allow any output→input drop through to onConnect so we can report *why* an
  // illegal one is refused. React Flow drops the target handle entirely when
  // isValidConnection is false, so validation + the reason toast both live in
  // onConnect, which always fires for a released connection.
  const isValidConnection = useCallback<IsValidConnection>(() => true, []);

  const onConnect = useCallback(
    (conn: Connection) => {
      const { from, to } = connToRefs(conn);
      const result = addCable(from, to);
      if (!result.ok && result.reason) showToast(result.reason);
    },
    [addCable, showToast],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedIds.length > 0) duplicateModules(selectedIds);
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    },
    [selectedIds, duplicateModules, undo, redo],
  );

  const place = useCallback(
    (type: string, hp: { x: number; y: number }) => {
      if (type.startsWith('group.')) insertGroup(type, hp);
      else addModule(type, hp);
    },
    [addModule, insertGroup],
  );

  const addAtCenter = useCallback(
    (type: string) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      const px = rect
        ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 3 })
        : { x: 0, y: 0 };
      place(type, pxToHp(px));
    },
    [screenToFlowPosition, place],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData('application/amy-module');
      if (!type) return;
      e.preventDefault();
      place(type, pxToHp(screenToFlowPosition({ x: e.clientX, y: e.clientY })));
    },
    [screenToFlowPosition, place],
  );

  return (
    <MenuProvider value={setMenu}>
    <div className="patch-workspace" onKeyDown={onKeyDown} tabIndex={0}>
      <Palette onAdd={addAtCenter} />
      <div
        className="patch-canvas"
        ref={wrapperRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="patch-topbar">
          <Transport />
          <PatchBar />
          <button
            type="button"
            className={`patch-tidy-btn${cableTidy ? ' patch-tidy-btn-active' : ''}`}
            data-testid="cable-tidy-toggle"
            aria-pressed={cableTidy}
            onClick={() => setCableTidy(!cableTidy)}
            title={cableTidy ? 'Cables: tidy (click for hanging)' : 'Cables: hanging (click for tidy)'}
          >
            {cableTidy ? '⎯ tidy' : '⌇ sag'}
          </button>
          <button
            type="button"
            className="patch-generate-btn"
            data-testid="canvas-generate"
            onClick={() => setGenOpen((o) => !o)}
            title="Generate a patch from a prompt"
          >
            ✨
          </button>
          {modules.length > 0 && <EditBox />}
        </div>
        {genOpen && (
          <div className="patch-generate-overlay">
            <div className="patch-generate-head">
              <span>Generate a patch</span>
              <button type="button" onClick={() => setGenOpen(false)} aria-label="close generate">
                ✕
              </button>
            </div>
            <GeneratePanel />
          </div>
        )}
        {modules.length === 0 && (
          <div className="patch-empty">
            <p className="patch-empty-title">Empty rack</p>
            <p className="patch-empty-hint">
              Drag a module from the palette, press <kbd>⌘K</kbd> to add one, or hit ✨ to generate a
              patch from a prompt.
            </p>
          </div>
        )}
        <StarterGallery />
        <OnboardingTour />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={commitDrag}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
          snapToGrid
          snapGrid={SNAP_GRID}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
          minZoom={0.2}
          maxZoom={1.5}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border-panel)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      <CommandPalette onGenerate={() => setGenOpen(true)} />
    </div>
    </MenuProvider>
  );
}

export function PatchCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
