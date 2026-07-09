import { motion } from 'framer-motion';
import { Clock, HardDrive, CheckCircle } from 'lucide-react';

export default function HistoryPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pt-4"
    >
      <h1 className="text-lg font-bold mb-4" style={{ color: 'var(--tg-text-color)' }}>📜 History</h1>
      <div className="text-center py-16">
        <div className="text-4xl mb-3">📜</div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--tg-text-color)' }}>Noch keine History</p>
        <p className="text-xs" style={{ color: 'var(--tg-hint-color)' }}>
          Abgeschlossene Downloads erscheinen hier
        </p>
      </div>
    </motion.div>
  );
}