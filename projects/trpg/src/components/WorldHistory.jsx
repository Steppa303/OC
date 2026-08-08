import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Users, Clock, ChevronDown, ChevronRight, Skull, Heart, AlertTriangle, Handshake, Search, Zap, Globe } from 'lucide-react';
import { api } from '../lib/api';

const eventIcons = {
  death: { icon: Skull, color: 'text-red-400' },
  alliance: { icon: Handshake, color: 'text-green-400' },
  destruction: { icon: AlertTriangle, color: 'text-orange-400' },
  discovery: { icon: Search, color: 'text-cyan-400' },
  quest: { icon: Zap, color: 'text-amber-400' },
  faction_change: { icon: Globe, color: 'text-purple-400' },
  other: { icon: Clock, color: 'text-text/50' },
};

const statusColors = {
  alive: 'text-green-400',
  dead: 'text-red-400',
  missing: 'text-amber-400',
  hostile: 'text-red-500',
  allied: 'text-green-500',
};

const stateColors = {
  'intakt': 'text-green-400',
  'zerstört': 'text-red-400',
  'verlassen': 'text-amber-400',
};

export default function WorldHistory({ worldId, embedded = false }) {
  const [world, setWorld] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('events');
  const [expandedNpcs, setExpandedNpcs] = useState({});

  useEffect(() => {
    if (!worldId) return;
    setLoading(true);
    Promise.all([
      api.getWorld(worldId),
      api.getWorldHistory(worldId),
    ]).then(([w, e]) => {
      setWorld(w);
      setEvents(e);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [worldId]);

  if (!worldId) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!world) {
    return (
      <div className="p-4 text-center text-text/30">
        <Globe size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Keine Welt-Daten verfügbar</p>
      </div>
    );
  }

  const tabs = [
    { id: 'events', label: 'Events', count: events.length },
    { id: 'npcs', label: 'NPCs', count: world.npcs?.length || 0 },
    { id: 'locations', label: 'Orte', count: world.locations?.length || 0 },
    { id: 'factions', label: 'Fraktionen', count: world.factions?.length || 0 },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* World Header */}
      <div className="px-4 py-3 border-b border-primary/10">
        <h3 className="font-semibold text-sm text-text">{world.name}</h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-text/40">
          {world.arc && <span>📖 {world.arc.name}</span>}
          <span>Akt {world.world_state?.current_act || 1}/3</span>
          <span>Tension: {world.world_state?.tension || 0}%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-primary/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 text-xs text-center transition-colors ${
              activeTab === t.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-text/40 hover:text-text/60'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Events Timeline */}
        {activeTab === 'events' && (
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-xs text-text/30 text-center py-4">Noch keine Events</p>
            ) : (
              events.map((e, i) => {
                const { icon: Icon, color } = eventIcons[e.event_type] || eventIcons.other;
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <div className={`p-1 rounded-full ${color}`}>
                        <Icon size={12} />
                      </div>
                      {i < events.length - 1 && <div className="w-px flex-1 bg-primary/10 mt-1" />}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <p className="text-xs text-text/80">{e.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text/30">
                        {e.npc_involved && <span>👤 {e.npc_involved}</span>}
                        {e.location_involved && <span>📍 {e.location_involved}</span>}
                        {e.turn_number && <span>Turn {e.turn_number}</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* NPCs */}
        {activeTab === 'npcs' && (
          <div className="space-y-2">
            {(world.npcs || []).map((npc, i) => (
              <motion.div
                key={npc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{npc.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      npc.status === 'alive' ? 'bg-green-500/10 text-green-400' :
                      npc.status === 'dead' ? 'bg-red-500/10 text-red-400' :
                      npc.status === 'hostile' ? 'bg-red-600/10 text-red-500' :
                      npc.status === 'allied' ? 'bg-green-600/10 text-green-500' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {npc.status}
                    </span>
                  </div>
                  <button
                    onClick={() => setExpandedNpcs(prev => ({ ...prev, [npc.id]: !prev[npc.id] }))}
                    className="text-text/30"
                  >
                    {expandedNpcs[npc.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
                <div className="text-xs text-text/50 mt-1">
                  {npc.role && <span>{npc.role}</span>}
                  {npc.location && <span className="ml-2">📍 {npc.location}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-text/40">Attitude:</span>
                  <div className="flex-1 h-1 bg-bg-dark/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        npc.attitude > 0 ? 'bg-green-500' : npc.attitude < 0 ? 'bg-red-500' : 'bg-gray-500'
                      }`}
                      style={{ width: `${Math.abs(npc.attitude)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text/40 w-6 text-right">{npc.attitude}</span>
                </div>
                <AnimatePresence>
                  {expandedNpcs[npc.id] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {npc.backstory && (
                        <p className="text-xs text-text/40 mt-2 leading-relaxed">{npc.backstory}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
            {(!world.npcs || world.npcs.length === 0) && (
              <p className="text-xs text-text/30 text-center py-4">Keine NPCs bekannt</p>
            )}
          </div>
        )}

        {/* Locations */}
        {activeTab === 'locations' && (
          <div className="space-y-2">
            {(world.locations || []).map((loc, i) => (
              <motion.div
                key={loc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-3"
              >
                <div className="flex items-center gap-2">
                  <MapPin size={14} className={loc.discovered ? 'text-cyan-400' : 'text-text/20'} />
                  <span className={`text-sm font-medium ${loc.discovered ? 'text-text' : 'text-text/30'}`}>
                    {loc.discovered ? loc.name : '???'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    loc.state === 'intakt' ? 'bg-green-500/10 text-green-400' :
                    loc.state === 'zerstört' ? 'bg-red-500/10 text-red-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {loc.state}
                  </span>
                </div>
                {loc.discovered && loc.description && (
                  <p className="text-xs text-text/40 mt-1 line-clamp-2">{loc.description}</p>
                )}
                {loc.connections?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {loc.connections.map((c, ci) => (
                      <span key={ci} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/50">
                        → {c}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
            {(!world.locations || world.locations.length === 0) && (
              <p className="text-xs text-text/30 text-center py-4">Keine Orte erkundet</p>
            )}
          </div>
        )}

        {/* Factions */}
        {activeTab === 'factions' && (
          <div className="space-y-2">
            {(world.factions || []).map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{f.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    f.attitude === 'friendly' ? 'bg-green-500/10 text-green-400' :
                    f.attitude === 'hostile' ? 'bg-red-500/10 text-red-400' :
                    'bg-gray-500/10 text-gray-400'
                  }`}>
                    {f.attitude}
                  </span>
                </div>
                {f.description && (
                  <p className="text-xs text-text/40 mt-1 line-clamp-2">{f.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-text/40">Power:</span>
                  <div className="flex-1 h-1.5 bg-bg-dark/80 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400"
                      style={{ width: `${f.power_level || 50}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-text/40 w-6 text-right">{f.power_level || 50}</span>
                </div>
              </motion.div>
            ))}
            {(!world.factions || world.factions.length === 0) && (
              <p className="text-xs text-text/30 text-center py-4">Keine Fraktionen bekannt</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
