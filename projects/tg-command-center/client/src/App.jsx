import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store.js';
import InfiniteCanvas from './components/InfiniteCanvas.jsx';
import Toolbar from './components/Toolbar.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import EditModal from './components/EditModal.jsx';

export default function App() {
  const init = useStore(s => s.init);
  const loading = useStore(s => s.loading);
  const editingId = useStore(s => s.editingId);

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <motion.div
          className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg text-text overflow-hidden select-none" style={{ height: '100dvh' }}>
      <Toolbar />
      <div className="flex-1 relative overflow-hidden">
        <InfiniteCanvas />
      </div>
      <ContextMenu />
      <AnimatePresence>
        {editingId && <EditModal />}
      </AnimatePresence>
    </div>
  );
}
