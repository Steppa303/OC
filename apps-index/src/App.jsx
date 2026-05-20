import { useState, useMemo } from 'react'

// App data
const apps = [
  {
    id: 1,
    name: 'Agent Dashboard',
    url: 'https://dashboard.steppa.online',
    screenshot: '/screenshot-dashboard.png',
    description: 'Monitoring-Interface für OpenClaw AI Agents. Live-Tracking von Subagent-Tasks, Status-Übersicht, Task-Historie mit Modell-Info und Laufzeiten.',
    tags: ['Monitoring', 'React', 'AI'],
    status: 'live'
  },
  {
    id: 2,
    name: 'Sampler',
    url: 'https://sampler.steppa.online',
    screenshot: '/screenshot-sampler.png',
    description: 'Granular Performance Sampler für Audio-Samples. Drag & Drop Audio-Import, Granular Engine, FX Chain, Performance Pad.',
    tags: ['Audio', 'WebAudio', 'Sampler'],
    status: 'live'
  },
  {
    id: 3,
    name: 'StepSampler',
    url: 'https://stepsampler.steppa.online',
    screenshot: '/screenshot-stepsampler.png',
    description: 'Granulator MK2 – Neumorphic Audio Workstation. Granular Synthese, Stutter Glitch Effects, Transport & Grid Sync.',
    tags: ['Audio', 'Granular', 'Synth'],
    status: 'live'
  },
  {
    id: 4,
    name: 'Config Editor',
    url: 'https://config.steppa.online',
    screenshot: '/screenshot-config.png',
    description: 'Online Config Editor für OpenClaw Workspace. Datei-Browser, Syntax-Highlighting, Bearbeiten und Speichern von Konfigurationsdateien.',
    tags: ['Editor', 'Config', 'OpenClaw'],
    status: 'live'
  },
  {
    id: 5,
    name: 'Calculator App',
    url: '#',
    screenshot: null,
    description: 'Moderner Taschenrechner mit React UI. Grundrechenarten, responsives Design, schnelle Berechnungen.',
    tags: ['Tool', 'React'],
    status: 'offline'
  },
  {
    id: 6,
    name: 'Melodie Generator',
    url: '#',
    screenshot: null,
    description: 'Web-basierter Melodie-Generator. Erzeugt musikalische Patterns und Sequenzen direkt im Browser.',
    tags: ['Audio', 'Generator'],
    status: 'offline'
  },
  {
    id: 7,
    name: 'Web Synth V2',
    url: '#',
    screenshot: null,
    description: 'Tone.js-basierter Web-Synthesizer. Virtueller Synthesizer mit verschiedenen Oszillatoren und Effekten.',
    tags: ['Audio', 'Synth', 'Tone.js'],
    status: 'offline'
  },
  {
    id: 8,
    name: 'Three.js Blob Animation',
    url: '#',
    screenshot: null,
    description: 'Animierte 3D-Blob-Visualisierung mit Three.js. Flüssige organische Formen mit Shader-Effekten.',
    tags: ['3D', 'Three.js', 'Visual'],
    status: 'offline'
  },
  {
    id: 9,
    name: 'Three.js Blob Engine',
    url: '#',
    screenshot: null,
    description: 'React 3D Experience mit Three.js Blob-Rendering. Interaktive 3D-Visualisierung als React-App.',
    tags: ['3D', 'React', 'Three.js'],
    status: 'offline'
  },
  {
    id: 10,
    name: 'Three.js Blob Simple',
    url: '#',
    screenshot: null,
    description: 'Minimalistische Three.js Blob-Demo. Einfache 3D-Blob-Animation ohne Framework-Overhead.',
    tags: ['3D', 'Three.js', 'Demo'],
    status: 'offline'
  },
  {
    id: 11,
    name: 'Flask Demo',
    url: '#',
    screenshot: null,
    description: 'Python Flask Web-App Demo. Backend-Beispiel mit Flask-Framework.',
    tags: ['Python', 'Flask', 'Demo'],
    status: 'offline'
  },
  {
    id: 12,
    name: 'Node.js Demo',
    url: '#',
    screenshot: null,
    description: 'Node.js Backend-Demo mit Express. Serverseitige JavaScript-Anwendung als Referenz-Implementierung.',
    tags: ['Node.js', 'Express', 'Demo'],
    status: 'offline'
  },
  {
    id: 13,
    name: 'PDF Generator',
    url: '#',
    screenshot: null,
    description: 'Python-basierte PDF-Generierung für Rezept-PDFs. Erzeugt formatierte PDF-Dokumente aus Daten.',
    tags: ['Python', 'PDF', 'Tool'],
    status: 'offline'
  },
  {
    id: 14,
    name: 'Polizei Scraper',
    url: '#',
    screenshot: null,
    description: 'Web-Scraper für Polizei-Inhalte mit E-Mail-Versand. Automatisiertes Scraping und Reporting.',
    tags: ['Python', 'Scraper', 'Automation'],
    status: 'offline'
  },
  {
    id: 15,
    name: 'WebMIDI Concept',
    url: '#',
    screenshot: null,
    description: 'WebMIDI API Konzept mit PDF-Integration. Experimentelle MIDI-Steuerung im Browser.',
    tags: ['MIDI', 'WebMIDI', 'Concept'],
    status: 'offline'
  },
  {
    id: 16,
    name: 'Test App',
    url: '#',
    screenshot: null,
    description: 'Test-App für Deployment-Validierung. Dient zum Testen von Build- und Deploy-Pipelines.',
    tags: ['Test', 'Demo'],
    status: 'offline'
  }
]

// Placeholder icon for offline apps
const PlaceholderIcon = () => (
  <svg className="w-14 h-14 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
  </svg>
)

// App Card Component
function AppCard({ app }) {
  const isLive = app.status === 'live'
  
  return (
    <div className="app-card fade-in">
      {/* Screenshot / Placeholder */}
      <div className="card-image">
        {app.screenshot ? (
          <img 
            src={app.screenshot} 
            alt={app.name}
            className="card-img"
            loading="lazy"
          />
        ) : (
          <div className="card-placeholder">
            <PlaceholderIcon />
          </div>
        )}
        
        {/* Status indicator */}
        <div className={`status-badge ${isLive ? 'status-live' : 'status-offline'}`}>
          <span className={`status-dot ${isLive ? 'dot-live' : 'dot-offline'}`} />
          <span className="status-text">{isLive ? 'Live' : 'Bald'}</span>
        </div>
      </div>
      
      {/* Content */}
      <div className="card-body">
        <h3 className="card-title">{app.name}</h3>
        <p className="card-desc">{app.description}</p>
        
        {/* Tags */}
        <div className="card-tags">
          {app.tags.map((tag, idx) => (
            <span key={idx} className="tag">
              {tag}
            </span>
          ))}
        </div>
        
        {/* Button */}
        <a 
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`card-btn ${isLive ? 'btn-live' : 'btn-offline'}`}
          onClick={(e) => !isLive && e.preventDefault()}
        >
          {isLive ? 'App öffnen →' : 'Bald verfügbar'}
        </a>
      </div>
    </div>
  )
}

// Header Component
function Header({ totalApps, liveCount }) {
  return (
    <header className="header">
      <div className="header-glow" />
      <p className="header-eyebrow">Projekte & Experimente</p>
      <h1 className="header-title">steppa<span className="title-dot">.</span>online</h1>
      <p className="header-subtitle">
        {liveCount} App{liveCount !== 1 ? 's' : ''} live · {totalApps} gesamt
      </p>
    </header>
  )
}

// Filter Bar Component
function FilterBar({ searchQuery, setSearchQuery, statusFilter, setStatusFilter, results }) {
  return (
    <div className="filter-bar">
      <div className="filter-inner">
        {/* Search */}
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Apps durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        {/* Status Filter */}
        <div className="filter-tabs">
          {['all', 'live', 'offline'].map((filter) => {
            const labels = { all: 'Alle', live: 'Live', offline: 'Offline' }
            const isActive = statusFilter === filter
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`filter-tab ${isActive ? 'tab-active tab-' + filter : ''}`}
              >
                {labels[filter]}
              </button>
            )
          })}
        </div>
      </div>
      
      {searchQuery && (
        <p className="filter-results">
          {results} Ergebnis{results !== 1 ? 'se' : ''}
        </p>
      )}
    </div>
  )
}

// Main App Component
function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      const matchesSearch = !searchQuery || 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter
      
      return matchesSearch && matchesStatus
    })
  }, [searchQuery, statusFilter])
  
  const liveCount = apps.filter(a => a.status === 'live').length
  
  return (
    <div className="page">
      <Header totalApps={apps.length} liveCount={liveCount} />
      
      <FilterBar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        results={filteredApps.length}
      />
      
      <main className="grid">
        {filteredApps.map((app, index) => (
          <div key={app.id} style={{ animationDelay: `${index * 0.06}s` }}>
            <AppCard app={app} />
          </div>
        ))}
      </main>
      
      {filteredApps.length === 0 && (
        <div className="empty">
          <p className="empty-title">Keine Apps gefunden</p>
          <p className="empty-sub">Versuch es mit einem anderen Suchbegriff</p>
        </div>
      )}
      
      <footer className="footer">
        <p>Built with React & TailwindCSS</p>
        <p className="footer-brand">steppa<span className="title-dot">.</span>online</p>
      </footer>
    </div>
  )
}

export default App
