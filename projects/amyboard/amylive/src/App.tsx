import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Library, Music, Settings, Sliders } from 'lucide-react'
import { Dashboard } from './pages/Dashboard'
import { Patches } from './pages/Patches'
import { LiveBoard } from './pages/LiveBoard'
import { MidiUnavailableBanner } from './components/Sidebar'

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const location = useLocation()
  const active = location.pathname === to

  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg text-[10px] font-medium transition-colors ${
        active
          ? 'text-[var(--color-primary)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
      }`}
    >
      {icon}
      {label}
    </Link>
  )
}

function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <MidiUnavailableBanner />

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live" element={<LiveBoard />} />
          <Route path="/patches" element={<Patches />} />
          <Route path="/settings" element={
            <div className="p-4 max-w-5xl mx-auto">
              <h1 className="text-xl font-bold mb-4">Settings</h1>
              <p className="text-sm text-[var(--color-text-dim)]">Coming soon...</p>
            </div>
          } />
        </Routes>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] z-50 lg:hidden">
        <div className="flex justify-around py-1">
          <NavLink to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <NavLink to="/live" icon={<Sliders size={18} />} label="Live" />
          <NavLink to="/patches" icon={<Library size={18} />} label="Patches" />
          <NavLink to="/settings" icon={<Settings size={18} />} label="Settings" />
        </div>
      </nav>

      {/* Desktop Top Nav */}
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)] z-50">
        <div className="max-w-7xl mx-auto w-full flex items-center gap-6 px-4 h-12">
          <Link to="/" className="font-bold text-sm flex items-center gap-2">
            <Music size={16} className="text-[var(--color-primary)]" />
            amylive
          </Link>
          <div className="flex gap-1">
            <NavLink to="/" icon={<LayoutDashboard size={14} />} label="Dashboard" />
            <NavLink to="/live" icon={<Sliders size={14} />} label="Live" />
            <NavLink to="/patches" icon={<Library size={14} />} label="Patches" />
            <NavLink to="/settings" icon={<Settings size={14} />} label="Settings" />
          </div>
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}