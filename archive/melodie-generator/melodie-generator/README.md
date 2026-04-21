# 🎵 MelodieGenerator

Ein moderner, generativer Melodiegenerator mit Echtzeit-Audiovisualisierung.

## ✨ Features

- **Modernes Glassmorphism Design** mit Purple/Indigo/Blue Farbverläufen
- **Echtzeit Canvas Visualizer** mit animierten Audio-Wellen
- **Umfangreiche Steuerung**:
  - BPM Slider (60-200)
  - Chaos Level (0-100%)
  - Länge (1-60 Minuten)
  - Tonart Auswahl (alle Dur/Moll Tonarten)
  - Wellenform Auswahl (Sine, Square, Sawtooth, Triangle)
- **Responsive Design** (Mobile-first)
- **Smooth Transitions** und Hover-Effects
- **Loading States** für alle Interaktionen

## 🛠️ Technologie-Stack

- React 18.3+ mit TypeScript
- TailwindCSS 3.4+
- Vite 5.4+
- react-icons (Lucide Icons)

## 🚀 Installation

```bash
# Dependencies installieren
npm install

# Development Server starten
npm run dev

# Production Build erstellen
npm run build

# Production Build previewen
npm run preview
```

## 📁 Projektstruktur

```
melodie-generator/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── Header.tsx          # App Header mit Titel & Icon
│   │   ├── Visualizer.tsx      # Canvas Audio-Visualizer
│   │   ├── ControlPanel.tsx    # Alle Einstellungen (Slider, Dropdowns)
│   │   ├── PlayControls.tsx    # Play/Stop Buttons
│   │   └── Footer.tsx          # Footer mit Info-Text
│   ├── App.tsx                 # Hauptkomponente
│   ├── App.css                 # Globale Glassmorphism Styles
│   ├── index.css               # Tailwind & Custom Styles
│   └── main.tsx                # Entry Point
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 🎨 Design-Features

- **Glassmorphism Cards**: `bg-white/10 backdrop-blur-md border-white/20`
- **Farbverläufe**: `bg-gradient-to-br from-purple via-indigo to-blue`
- **Chroma Progress Bars**: Animierte Verlaufsbalken für alle Slider
- **Hover Effects**: Scale, Shadow, Brightness Transitions
- **Active States**: Pressed Button Effects
- **Loading States**: Spinner und Disabled States

## 📱 Responsive Breakpoints

- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md)
- **Desktop**: > 1024px (lg)

## 🎯 Usage

1. Einstellungen anpassen (BPM, Chaos, Länge, Tonart, Wellenform)
2. Play Button drücken zum Starten
3. Visualizer zeigt die generierte Melodie in Echtzeit
4. Stop Button zum Beenden

## 📄 Lizenz

MIT
