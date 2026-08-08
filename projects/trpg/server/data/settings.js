export const settingPresets = [
  {
    name: 'Fantasy',
    slug: 'fantasy',
    description: 'Klassisches Mittelalter-Fantasy mit Magie, Drachen und Abenteuern',
    tone: 'epic',
    classes: [
      { name: 'Krieger', desc: 'Meister der Waffen und Rüstungen', base_hp: 24, skills: ['Kampftechnik', 'Schildwall'] },
      { name: 'Magier', desc: 'Beherrscher der arkanen Künste', base_hp: 14, mana: 20, skills: ['Feuerball', 'Heilung'] },
      { name: 'Schurke', desc: 'Meister des Diebstahls und der Täuschung', base_hp: 18, skills: ['Schleichen', 'Fallen entschärfen'] },
      { name: 'Ranger', desc: 'Waldläufer und Meister der Fernkampfwaffen', base_hp: 20, skills: ['Bogenschuss', 'Tierfreund'] },
      { name: 'Kleriker', desc: 'Geweihter Heiler und Dämonenjäger', base_hp: 20, mana: 15, skills: ['Segen', 'Untoten-Vertreibung'] }
    ],
    starting_items: ['Abenteurer-Rucksack', 'Tagesration', 'Wasserschlauch', 'Fackel']
  },
  {
    name: 'Sci-Fi',
    slug: 'scifi',
    description: 'Weites Weltall, Alien-Zivilisationen, High-Tech-Ausrüstung',
    tone: 'awe',
    classes: [
      { name: 'Pilot', desc: 'Meister der Raumschiffe und Navigation', base_hp: 18, skills: ['Raumschiff-Steuerung', 'Notfall-Landung'] },
      { name: 'Techniker', desc: 'Expert für Maschinen und Cybernetik', base_hp: 16, skills: ['Hacken', 'Reparatur'] },
      { name: 'Söldner', desc: 'Gefechtserprobter Kämpfer', base_hp: 24, skills: ['Schusswaffen', 'Nahkampf'] },
      { name: 'Psioniker', desc: 'Mentale Kräfte und Telepathie', base_hp: 14, mana: 20, skills: ['Telekinese', 'Gedankenlesen'] }
    ],
    starting_items: ['EVA-Suit', 'Plasma-Pistole', 'Multitool', 'Rationen']
  },
  {
    name: 'Post-Apokalypse',
    slug: 'postapo',
    description: 'Die Welt nach dem Kollaps. Überleben ist alles.',
    tone: 'grim',
    classes: [
      { name: 'Überlebender', desc: 'Abgehärteter Überlebenskünstler', base_hp: 22, skills: ['Fellhandwerk', 'Wasser finden'] },
      { name: 'Scavenger', desc: 'Meister der Müllsuche und Improvisation', base_hp: 18, skills: ['Plündern', 'Flicken'] },
      { name: 'Scharfschütze', desc: 'Präzise aus der Distanz', base_hp: 20, skills: ['Scharfschuss', 'Tarnung'] },
      { name: 'Mechaniker', desc: 'Lässt alles wieder laufen', base_hp: 18, skills: ['Fahrzeug-Reparatur', 'Waffen-Mod'] }
    ],
    starting_items: ['Flickzeug', 'Messer', 'Wasserflasche', 'Konservendose']
  },
  {
    name: 'Horror',
    slug: 'horror',
    description: 'Düstere Atmosphäre, übernatürliche Bedrohungen, Überleben',
    tone: 'terrifying',
    classes: [
      { name: 'Ermittler', desc: 'Aufklärer okkulter Verbrechen', base_hp: 18, skills: ['Ermittlung', 'Verhör'] },
      { name: 'Okkultist', desc: 'Kenner dunkler Rituale', base_hp: 14, mana: 18, skills: ['Ritual', 'Schutzkreis'] },
      { name: 'Überlebender', desc: 'Hat schon Schlimmes erlebt', base_hp: 22, skills: ['Flucht', 'Verstecken'] },
      { name: 'Arzt', desc: 'Mediziner in einer Welt ohne Logik', base_hp: 16, skills: ['Erste Hilfe', 'Anatomie'] }
    ],
    starting_items: ['Taschenlampe', 'Notizbuch', 'Erste-Hilfe-Set', 'Talisman']
  },
  {
    name: 'Cyberpunk',
    slug: 'cyberpunk',
    description: 'Neon, Megakonzerne, Cyberware, Straßenkriminalität',
    tone: 'noir',
    classes: [
      { name: 'Netrunner', desc: 'Hacker im Cyberspace', base_hp: 14, mana: 22, skills: ['Hacken', 'ICE-Brecher'] },
      { name: 'Solo', desc: 'Profikiller und Leibwächter', base_hp: 24, skills: ['Feuerwaffen', 'Nahkampf'] },
      { name: 'Techie', desc: 'Technik-Experte und Erfinder', base_hp: 18, skills: ['Waffen-Mod', 'Cyberware'] },
      { name: 'Fixer', desc: 'Informant und Händler', base_hp: 18, skills: ['Kontakte', 'Schwarzmarkt'] }
    ],
    starting_items: ['Cyberdeck', 'Pistole', 'Smartphone', '100 Eddies']
  }
];
