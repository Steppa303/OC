import { create } from 'zustand';

const useGameStore = create((set, get) => ({
  // Character
  character: null,
  setCharacter: (char) => set({ character: char }),
  updateHP: (delta) =>
    set((s) => ({
      character: s.character
        ? { ...s.character, hp: Math.max(0, Math.min(s.character.hp + delta, s.character.max_hp)) }
        : null,
    })),
  updateMana: (delta) =>
    set((s) => ({
      character: s.character
        ? { ...s.character, mana: Math.max(0, Math.min(s.character.mana + delta, s.character.max_mana)) }
        : null,
    })),
  updateXP: (amount) =>
    set((s) => ({
      character: s.character ? { ...s.character, xp: s.character.xp + amount } : null,
    })),
  updateGold: (amount) =>
    set((s) => ({
      character: s.character ? { ...s.character, gold: s.character.gold + amount } : null,
    })),

  // Game
  saveId: null,
  currentScene: '',
  choices: [],
  turn: 0,
  setting: null,
  setSaveId: (id) => set({ saveId: id }),
  setCurrentScene: (scene) => set({ currentScene: scene }),
  setChoices: (choices) => set({ choices }),
  setTurn: (turn) => set({ turn }),
  setSetting: (setting) => set({ setting }),

  // Story Engine / World
  worldId: null,
  worldState: null,
  quests: [],
  tension: 0,
  currentAct: 1,
  arcName: null,
  setWorld: (worldId, worldState) => set({
    worldId,
    worldState,
    currentAct: worldState?.current_act || 1,
    tension: worldState?.tension || 0,
    quests: worldState?.quests || [],
    arcName: worldState?.arc_name || null,
  }),
  updateQuest: (quest) => set((s) => {
    const existing = s.quests.findIndex(q => q.name === quest.name);
    if (existing >= 0) {
      const newQuests = [...s.quests];
      newQuests[existing] = { ...newQuests[existing], ...quest };
      return { quests: newQuests };
    }
    return { quests: [...s.quests, quest] };
  }),
  updateTension: (tension) => set({ tension: Math.max(0, Math.min(100, tension)) }),
  updateCurrentAct: (act) => set({ currentAct: act }),
  setArcName: (name) => set({ arcName: name }),

  // Dice
  diceResult: null,
  diceRolling: false,
  startDiceRoll: () => set({ diceRolling: true, diceResult: null }),
  setDiceResult: (result) => set({ diceResult: result, diceRolling: false }),

  // Inventory
  inventory: [],
  equipment: { weapon: null, armor: null, shield: null, acc1: null, acc2: null },
  setInventory: (items) => set({ inventory: items }),
  addItem: (item) => set((s) => ({ inventory: [...s.inventory, item] })),
  removeItem: (index) =>
    set((s) => ({ inventory: s.inventory.filter((_, i) => i !== index) })),
  setEquipment: (eq) => set({ equipment: eq }),
  equipItem: (slot, item) =>
    set((s) => ({ equipment: { ...s.equipment, [slot]: item } })),

  // UI
  showInventory: false,
  showCharSheet: false,
  showSettings: false,
  toggleInventory: () => set((s) => ({ showInventory: !s.showInventory, showCharSheet: false, showLog: false })),
  toggleCharSheet: () => set((s) => ({ showCharSheet: !s.showCharSheet, showInventory: false, showLog: false })),
  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
  closeAllPanels: () => set({ showInventory: false, showCharSheet: false, showLog: false, showWorld: false }),

  // Game Log
  gameLog: [],
  setGameLog: (log) => set({ gameLog: log }),
  addLogEntry: (entry) => set((s) => ({ gameLog: [...s.gameLog, entry] })),

  // UI - Log Panel
  showLog: false,
  toggleLog: () => set((s) => ({ showLog: !s.showLog, showInventory: false, showCharSheet: false, showWorld: false })),

  // UI - World Panel
  showWorld: false,
  toggleWorld: () => set((s) => ({ showWorld: !s.showWorld, showInventory: false, showCharSheet: false, showLog: false })),

  // Level Up
  levelUp: false,
  setLevelUp: (v) => set({ levelUp: v }),

  // Loading
  loading: false,
  setLoading: (v) => set({ loading: v }),

  // User
  user: null,
  setUser: (user) => set({ user }),

  // Reset
  resetGame: () =>
    set({
      character: null,
      saveId: null,
      currentScene: '',
      choices: [],
      turn: 0,
      setting: null,
      diceResult: null,
      diceRolling: false,
      inventory: [],
      equipment: { weapon: null, armor: null, shield: null, acc1: null, acc2: null },
      showInventory: false,
      showCharSheet: false,
      showLog: false,
      showSettings: false,
      gameLog: [],
      levelUp: false,
      loading: false,
      worldId: null,
      worldState: null,
      quests: [],
      tension: 0,
      currentAct: 1,
      arcName: null,
    }),
}));

export default useGameStore;
