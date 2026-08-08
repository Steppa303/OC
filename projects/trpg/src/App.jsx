import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import useGameStore from './store';
import Layout from './components/Layout';
import StartScreen from './components/StartScreen';
import SettingSelector from './components/SettingSelector';
import CharacterCreator from './components/CharacterCreator';
import GameView from './components/GameView';
import CharacterSheet from './components/CharacterSheet';
import InventoryPanel from './components/InventoryPanel';

function App() {
  const location = useLocation();
  const setUser = useGameStore((s) => s.setUser);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setUser({
          id: user.id,
          firstName: user.first_name,
          username: user.username,
          userId: `telegram:${user.id}`,
        });
      }
    } else {
      // Fallback for browser testing
      setUser({
        id: 'test',
        firstName: 'Tester',
        username: 'testuser',
        userId: 'test:0',
      });
    }
  }, [setUser]);

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<StartScreen />} />
          <Route path="/settings" element={<SettingSelector />} />
          <Route path="/create" element={<CharacterCreator />} />
          <Route path="/game" element={<GameView />} />
          <Route path="/sheet" element={<CharacterSheet />} />
          <Route path="/inventory" element={<InventoryPanel />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}

export default App;
