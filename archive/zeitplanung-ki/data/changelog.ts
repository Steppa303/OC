
export type ChangeType = 'FEATURE' | 'IMPROVEMENT' | 'FIX';

export interface ChangelogItem {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: ChangelogItem[];
}

export const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: '1.8.0',
    date: '2024-06-15',
    title: 'Seamless Drag & Drop',
    changes: [
      { type: 'FEATURE', text: 'Interactive Planning: Ziehe Phasen jetzt per Drag & Drop direkt aus der Sidebar auf einen spezifischen Tag im Kalender.' },
      { type: 'IMPROVEMENT', text: 'Non-Blocking UI: Der "Planen"-Dialog blockiert nicht mehr die Sicht. Der Kalender bleibt im Hintergrund voll bedienbar.' }
    ]
  },
  {
    version: '1.7.0',
    date: '2024-06-12',
    title: 'Voice Command & Secure Share',
    changes: [
      { type: 'FEATURE', text: 'Voice Requests: Gäste können Aufgabenwünsche jetzt einfach einsprechen. Gemini 2.5 transkribiert und bereinigt den Text automatisch.' },
      { type: 'FIX', text: 'Secure Views: Geteilte Kalender-Links zeigen nun strikt nur noch Daten des Erstellers an. Fremde Projekte bleiben unsichtbar.' }
    ]
  },
  {
    version: '1.6.0',
    date: '2024-06-07',
    title: 'Tactical UI Polish',
    changes: [
      { type: 'IMPROVEMENT', text: 'Focus Drawer 2.0: Reduziert auf eine minimalistische, grüne Lasche. Maximale Screen-Real-Estate.' },
      { type: 'FIX', text: 'Calendar UX: Datum-Header ist nun klickbar zur Selektion. Zoom-Card öffnet sich nur noch bei Hover über die Tasks.' }
    ]
  },
  {
    version: '1.5.0',
    date: '2024-06-05',
    title: 'Smart Calendar Import',
    changes: [
      { type: 'FEATURE', text: 'Calendar Integration: Ziehe .ics Dateien direkt in den Magic Input. Termine werden automatisch analysiert und in den Plan übernommen.' },
      { type: 'IMPROVEMENT', text: 'Drag & Drop: Erweiterter Support für Dateiformate (E-Mail .eml & Kalender .ics).' }
    ]
  },
  {
    version: '1.4.1',
    date: '2024-05-29',
    title: 'Smart Metrics & Logic',
    changes: [
      { type: 'IMPROVEMENT', text: 'Smart Capacity Avg: Der 7-Day-Load berechnet den Durchschnitt nun intelligenter. Leere Wochenenden ziehen den Schnitt nicht mehr künstlich nach unten, es sei denn, es wird dort gearbeitet.' },
      { type: 'FIX', text: 'Visual Polish: Optimierter Kontrast für das Wochenend-Muster (Stripes) im Kalender.' }
    ]
  },
  {
    version: '1.4.0',
    date: '2024-05-28',
    title: 'Tactical Focus & Visual Clarity',
    changes: [
      { type: 'FEATURE', text: 'Project Highlighting: Klicke auf eine Aufgabe in der Detailansicht, um den gesamten Projektverlauf im Kalender hervorzuheben. Alles andere wird gedimmt.' },
      { type: 'IMPROVEMENT', text: 'Smart Weekends: Leere Wochenenden werden jetzt visuell stark zurückgenommen (gedimmt & schraffiert), um den Fokus auf die Werktage zu lenken.' },
      { type: 'FEATURE', text: 'Tactical Zoom: Wechsle nahtlos zwischen 90-Tage-Strategie (Macro), Monatsansicht und detaillierter Wochenplanung (Micro).' },
      { type: 'IMPROVEMENT', text: 'Granulare Außentermine: Du kannst jetzt einzelne Aufgaben im Quick-Edit als "Extern" markieren, ohne das ganze Projekt umzustellen.' }
    ]
  },
  {
    version: '1.3.0',
    date: '2024-05-25',
    title: 'Liquid Task Flow & Ghost Mode',
    changes: [
      { type: 'FEATURE', text: 'Liquid Task Flow: Aufgaben über 8h werden automatisch erkannt und intelligent auf freie Kapazitäten verteilt.' },
      { type: 'FEATURE', text: 'Ghost Preview: KI-Vorschläge erscheinen als "Geister-Kacheln" zur Vorschau direkt im Kalender.' },
      { type: 'IMPROVEMENT', text: 'Smart Status: Transparente Anzeige, was die KI gerade berechnet (Kapazitätsprüfung, Splitting, etc.).' }
    ]
  },
  {
    version: '1.2.0',
    date: '2024-05-22',
    title: 'Bug Tracker Release',
    changes: [
      { type: 'FEATURE', text: 'Integrierter Bug Tracker: Melde Fehler direkt über das Käfer-Symbol im Header.' },
      { type: 'IMPROVEMENT', text: 'Live-Notifications bei Status-Updates zu deinen Tickets.' },
      { type: 'FIX', text: 'Stabilere PDF-Texterkennung bei großen Dateien.' }
    ]
  },
  {
    version: '1.1.0',
    date: '2024-05-20',
    title: 'Mission: Außeneinsatz',
    changes: [
      { type: 'FEATURE', text: 'Automatische Ortserkennung: "Dreh in Hamburg" setzt jetzt den Ort.' },
      { type: 'FEATURE', text: 'Neue Visualisierung für Außentermine im Kalender (Cyan-Style).' },
      { type: 'IMPROVEMENT', text: 'Kompaktere Darstellung der Projektliste.' }
    ]
  },
  {
    version: '1.0.0',
    date: '2024-05-15',
    title: 'Initial Release',
    changes: [
      { type: 'FEATURE', text: 'Smart Planner AI Start: KI-gestützte Projektplanung.' },
      { type: 'FEATURE', text: 'Heatmap Kalender & Capacity Trend.' }
    ]
  }
];
