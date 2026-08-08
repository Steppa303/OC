import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, Sword, Shield, ChevronDown, ChevronUp, Trash2, ArrowRightLeft } from 'lucide-react';
import useGameStore from '../store';
import { api } from '../lib/api';

const slotIcons = {
  weapon: Sword,
  armor: Shield,
  shield: Shield,
  acc1: Package,
  acc2: Package,
};

const slotLabels = {
  weapon: 'Waffe',
  armor: 'Rüstung',
  shield: 'Schild',
  acc1: 'Accessoire 1',
  acc2: 'Accessoire 2',
};

// Type → Slot mapping
function typeToSlot(type) {
  const t = (type || '').toLowerCase();
  if (t === 'weapon' || t === 'waffe') return 'weapon';
  if (t === 'armor' || t === 'rüstung') return 'armor';
  if (t === 'shield' || t === 'schild') return 'shield';
  // Accessories for everything else
  return null; // caller picks acc1 or acc2
}

function resolveEquipSlot(item, equipment) {
  const slot = typeToSlot(item.type);
  if (slot) return slot;
  // Pick first free accessory slot, or acc1 if both full
  if (!equipment.acc1) return 'acc1';
  if (!equipment.acc2) return 'acc2';
  return 'acc1';
}

export default function InventoryPanel({ embedded = false }) {
  const inventory = useGameStore((s) => s.inventory);
  const equipment = useGameStore((s) => s.equipment);
  const toggleInventory = useGameStore((s) => s.toggleInventory);
  const setInventory = useGameStore((s) => s.setInventory);
  const setEquipment = useGameStore((s) => s.setEquipment);
  const saveId = useGameStore((s) => s.saveId);
  const [expandedItem, setExpandedItem] = useState(null);

  const handleEquip = (index) => {
    const item = inventory[index];
    if (!item) return;
    const itemName = typeof item === 'string' ? item : item.name;
    const itemType = typeof item === 'object' ? item.type : null;
    const slot = resolveEquipSlot({ type: itemType }, equipment);

    // If slot is occupied, move old item to inventory
    const newEquipment = { ...equipment };
    const oldItem = newEquipment[slot];
    const newInventory = [...inventory];
    newInventory.splice(index, 1);
    if (oldItem) {
      newInventory.push(oldItem);
    }
    newEquipment[slot] = typeof item === 'string' ? item : item;

    setEquipment(newEquipment);
    setInventory(newInventory);
  };

  const handleUnequip = (slot) => {
    const item = equipment[slot];
    if (!item) return;
    const newEquipment = { ...equipment, [slot]: null };
    const newInventory = [...inventory, item];
    setEquipment(newEquipment);
    setInventory(newInventory);
  };

  const handleDrop = (index) => {
    const newInventory = [...inventory];
    newInventory.splice(index, 1);
    setInventory(newInventory);
  };

  const getItemDetails = (item) => {
    if (typeof item === 'string') return null;
    return item;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-primary/10">
        <h2 className="text-lg font-bold">Inventar</h2>
        {embedded && (
          <button onClick={toggleInventory} className="p-2 rounded-lg text-text/40 hover:text-text min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Equipment Slots */}
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 text-text/60">Ausrüstung</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(equipment).map(([slot, item]) => {
              const Icon = slotIcons[slot] || Package;
              const itemName = item ? (typeof item === 'string' ? item : item.name) : null;
              return (
                <motion.button
                  key={slot}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => item && handleUnequip(slot)}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-colors min-h-[48px] text-left ${
                    item
                      ? 'bg-primary/5 border-primary/20 hover:border-primary/40 cursor-pointer'
                      : 'bg-bg-dark/40 border-transparent'
                  }`}
                >
                  <Icon size={16} className={item ? 'text-primary/60' : 'text-text/30'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-text/30">{slotLabels[slot]}</div>
                    <div className={`text-xs truncate ${item ? 'text-text/80' : 'text-text/40'}`}>
                      {itemName || '— Leer —'}
                    </div>
                  </div>
                  {item && (
                    <ArrowRightLeft size={12} className="text-text/20" />
                  )}
                </motion.button>
              );
            })}
          </div>
          <p className="text-[10px] text-text/20 mt-2">Klick auf Slot → Unequip zurück in Rucksack</p>
        </div>

        {/* Backpack */}
        <div className="glass rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 text-text/60">
            Rucksack ({inventory.length} Items)
          </h3>
          {inventory.length === 0 ? (
            <div className="text-center py-8 text-text/20 text-sm">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              Dein Rucksack ist leer.
            </div>
          ) : (
            <div className="space-y-2">
              {inventory.map((item, i) => {
                const details = getItemDetails(item);
                const isExpanded = expandedItem === i;
                const itemName = typeof item === 'string' ? item : item.name;

                return (
                  <motion.div
                    key={`${itemName}-${i}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl bg-bg-dark/40 border border-transparent hover:border-primary/10 transition-colors overflow-hidden"
                  >
                    {/* Item Row */}
                    <div className="flex items-center gap-3 p-2 min-h-[44px]">
                      <Package size={14} className="text-text/30 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{itemName}</div>
                        {details?.type && (
                          <div className="text-[10px] text-text/30 capitalize">{details.type}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Expand/Collapse */}
                        {details && (
                          <button
                            onClick={() => setExpandedItem(isExpanded ? null : i)}
                            className="p-1.5 rounded-lg text-text/30 hover:text-text/60 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}

                        {/* Equip */}
                        <button
                          onClick={() => handleEquip(i)}
                          className="p-1.5 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                          title="Equip"
                        >
                          <ArrowRightLeft size={14} />
                        </button>

                        {/* Drop */}
                        <button
                          onClick={() => handleDrop(i)}
                          className="p-1.5 rounded-lg text-danger/40 hover:text-danger hover:bg-danger/10 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                          title="Drop"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && details && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 pt-1 border-t border-primary/5 space-y-1">
                            {details.damage && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-text/40">Schaden</span>
                                <span className="text-danger/80">{details.damage}</span>
                              </div>
                            )}
                            {details.effect && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-text/40">Effekt</span>
                                <span className="text-success/80">{details.effect}</span>
                              </div>
                            )}
                            {details.weight != null && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-text/40">Gewicht</span>
                                <span className="text-text/60">{details.weight} kg</span>
                              </div>
                            )}
                            {details.description && (
                              <p className="text-[11px] text-text/40 italic mt-1">{details.description}</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
