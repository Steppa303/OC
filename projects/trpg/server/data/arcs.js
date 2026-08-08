// Arc-Templates: 3 pro Setting (15 total)
export const arcTemplates = [
  // ═══════════════════════════════════════════════════
  // FANTASY
  // ═══════════════════════════════════════════════════
  {
    id: 'fantasy_1',
    setting: 'fantasy',
    name: 'Die Schattenschmiede',
    premise: 'Ein uralter Dunkelmager hat seine Schmiede in den Tiefen eines verlassenen Bergwerks wiedererweckt. Dort schmiedet er Waffen aus gefangenen Seelen — und die Morde in der Umgebung mehren sich.',
    antagonist_type: 'Dunkelmager',
    antagonist_template: {
      role: 'Seelenschmied',
      motivation_options: [
        'Will seine tote Geliebte wiederbeleben und braucht dafür die Seelenkraft von 100 Menschen',
        'Wurde vor Jahrhunderten verraten und rächt sich nun an den Nachfahren seiner Feinde',
        'Sucht ultimative Macht um ein uraltes Böses zu versiegeln — und hält sich selbst für den Helden',
      ],
      secret_options: [
        'Der Magier ist selbst ein Opfer — sein Meister kontrolliert ihn über ein verfluchtes Amulett',
        'Die Seelen in seinen Waffen wollen gar nicht befreit werden — sie sind böse',
        'Die Schmiede ist ein Siegel: Zerstört man sie, bricht ein Dämon durch',
      ],
    },
    acts: [
      { act: 1, name: 'Entdeckung', key_beats: ['Seltsame Morde in der Umgebung', 'Ermittlung und Spurensuche', 'Entdeckung der Schattenschmiede'], tension_range: [0, 35] },
      { act: 2, name: 'Eskalation', key_beats: ['Verbündete finden', 'Infiltration der Schmiede', 'Verrat oder moralisches Dilemma'], tension_range: [35, 75] },
      { act: 3, name: 'Finale', key_beats: ['Endkampf gegen den Dunkelmager', 'Entscheidung über das Schicksal der Seelen'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Der Magier ist selbst ein Opfer — sein Meister kontrolliert ihn',
      'Die Seelen wollen gar nicht befreit werden — sie sind verdorben',
      'Die Schmiede ist ein Siegel für einen Dämonen',
      'Einer der Verbündeten ist ein Agent des Dunkelmagers',
    ],
    side_quest_hooks: [
      'Ein Dorf am Bergfuß braucht Hilfe gegen Monster',
      'Ein NPC trägt ein Amulett das leise summt wenn er nah ist',
      'Eine alte Bibliothek enthält Hinweise auf die Schwäche des Magiers',
      'Ein Händler verkauft verdächtig günstige Waffen',
    ],
  },
  {
    id: 'fantasy_2',
    setting: 'fantasy',
    name: 'Der Letzte Thron',
    premise: 'Das Königreich ist zerfallen. Drei Fraktionen kämpfen um den leeren Thron — und der Spieler steht zwischen den Fronten.',
    antagonist_type: 'Fraktionsanführer',
    antagonist_template: {
      role: 'Machthungriger Adliger',
      motivation_options: [
        'Will das Königreich einen — aber unter seiner eisernen Faust',
        'Rächt den Mord an seiner Familie und will die alte Ordnung zerstören',
        'Glaubt auserwählt zu sein durch eine Prophezeiung',
      ],
      secret_options: [
        'Der wahre Thronerbe lebt — und ist einer der NPCs',
        'Alle drei Fraktionen werden von derselben Macht gelenkt',
        'Der Thron selbst ist verflucht',
      ],
    },
    acts: [
      { act: 1, name: 'Die Zerbrochene Krone', key_beats: ['Ankunft im zerfallenen Königreich', 'Begegnung mit den drei Fraktionen', 'Wahl einer Seite (oder Neutralität)'], tension_range: [0, 35] },
      { act: 2, name: 'Krieg der Schatten', key_beats: ['Diplomatie oder Sabotage', 'Geheimnisse enthüllt', 'Allianzen brechen'], tension_range: [35, 75] },
      { act: 3, name: 'Die Krönung', key_beats: ['Endgültige Schlacht', 'Entscheidung über die Zukunft des Reiches'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Der wahre Thronerbe ist ein Kind das unter den NPCs lebt',
      'Der Thron ist ein Artefakt das den Träger korrumpiert',
      'Die drei Fraktionen werden von derselben dunklen Macht gelenkt',
      'Ein vierter Spieler — eine Gottheit — mischt sich ein',
    ],
    side_quest_hooks: [
      'Ein Dorf wird von einer Fraktion unterdrückt',
      'Ein Gefangener behauptet den wahren Erben zu kennen',
      'Eine Prophezeiung weist auf einen verborgenen Schatz',
      'Ein Botschafter bietet ein riskantes Bündnis an',
    ],
  },
  {
    id: 'fantasy_3',
    setting: 'fantasy',
    name: 'Die Pest der Vergessenheit',
    premise: 'Eine magische Pest breitet sich aus — sie löscht Erinnerungen. Betroffene vergessen ihre Namen, ihre Liebsten, sich selbst. Die Quelle liegt tief in einem verbotenen Wald.',
    antagonist_type: 'Manifestation',
    antagonist_template: {
      role: 'Die Vergessene — eine uralte Kreatur die aus vergessenen Erinnerungen geboren wurde',
      motivation_options: [
        'Will dass alle vergessen — dann existiert sie endlich in Frieden',
        'Sammelt Erinnerungen um selbst zu fühlen',
        'Ist ein Fluch der erst gebrochen werden muss',
      ],
      secret_options: [
        'Die Kreatur ist ein Kind das nie erinnert wurde',
        'Die Pest ist eigentlich ein Schutzsiegel das bricht',
        'Wer alles vergisst wird zum Diener der Kreatur',
      ],
    },
    acts: [
      { act: 1, name: 'Die leeren Gesichter', key_beats: ['Betroffene NPC begegnen', 'Muster erkennen', 'Reise zum verbotenen Wald'], tension_range: [0, 35] },
      { act: 2, name: 'Erinnerungen', key_beats: ['Fragmente der Wahrheit', 'Eigene Erinnerungen in Gefahr', 'Der Wald gibt Rätsel auf'], tension_range: [35, 75] },
      { act: 3, name: 'Kern der Vergessenheit', key_beats: ['Konfrontation mit der Kreatur', 'Wahl: Versiegeln oder Verstehen'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Die Kreatur ist ein Kind das nie erinnert wurde',
      'Die Pest ist ein Schutzsiegel das bricht',
      'Der Spieler hat selbst vergessen — und ist Teil des Problems',
      'Die Heilung kostet die Erinnerungen eines Anderen',
    ],
    side_quest_hooks: [
      'Ein Kind sucht seine Mutter die es vergessen hat',
      'Ein alter Mann erinnert sich noch — aber warum?',
      'Eine Bibliothek der Erinnerungen existiert im Geheimen',
      'Ein Händler verkauft gestohlene Erinnerungen',
    ],
  },

  // ═══════════════════════════════════════════════════
  // SCI-FI
  // ═══════════════════════════════════════════════════
  {
    id: 'scifi_1',
    setting: 'scifi',
    name: 'Das Signal',
    premise: 'Ein tiefes Signal aus dem All enthält Baupläne für eine Maschine. Jede Fraktion will sie bauen — doch niemand weiß was sie tut.',
    antagonist_type: 'Alien-Echo',
    antagonist_template: {
      role: 'Signal-Architekt — das Echo einer ausgestorbenen Alien-Zivilisation',
      motivation_options: [
        'Die Maschine soll die Zivilisation wiederbeleben — auf Kosten der Menschheit',
        'Das Signal ist ein Test: Wer die Maschine baut, ist würdig',
        'Die Maschine ist eine Waffe gegen eine noch größere Bedrohung',
      ],
      secret_options: [
        'Das Signal wurde von Menschen gesendet — aus der Zukunft',
        'Die Maschine ist ein Tor zu einer anderen Dimension',
        'Wer sie aktiviert wird selbst zum Architekten',
      ],
    },
    acts: [
      { act: 1, name: 'Empfang', key_beats: ['Signal wird entschlüsselt', 'Fraktionen werden aktiv', 'Erste Bauteile finden'], tension_range: [0, 35] },
      { act: 2, name: 'Konstruktion', key_beats: ['Ressourcen-Kampf', 'Sabotage-Versuche', 'Wahre Natur des Signals'], tension_range: [35, 75] },
      { act: 3, name: 'Aktivierung', key_beats: ['Maschine ist fertig', 'Entscheidung: Aktivieren oder Zerstören'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Das Signal wurde von Menschen aus der Zukunft gesendet',
      'Die Maschine ist ein Tor zu einer anderen Dimension',
      'Eine Alien-Spezies will das Signal abfangen',
      'Die Maschine bereits einmal aktiviert — und hat eine Zivilisation ausgelöscht',
    ],
    side_quest_hooks: [
      'Ein Wissenschaftler hat ein Bauteil und will es nicht hergeben',
      'Ein Piratenschiff hat den ersten Teil abgefangen',
      'Eine Kolonie weigert sich das Signal zu akzeptieren',
      'Ein KI-Schiff folgt dem Signal auf eigene Faust',
    ],
  },
  {
    id: 'scifi_2',
    setting: 'scifi',
    name: 'Schatten der Kolonie',
    premise: 'Die Kolonie Meridian-7 hat vor drei Wochen den Kontakt verloren. Das Rettungsteam findet eine scheinbar intakte Siedlung — aber keine einzige lebende Person.',
    antagonist_type: 'Parasit',
    antagonist_template: {
      role: 'Symbiontischer Alien-Parasit der die Kolonisten übernommen hat',
      motivation_options: [
        'Überleben — die Kolonisten sind Wirte die es braucht',
        'Verbreitung — will neue Welten erreichen',
        'Kommunikation — es versucht seit Wochen Kontakt aufzunehmen',
      ],
      secret_options: [
        'Die Kolonisten sind noch da — im Inneren des Parasiten gefangen',
        'Der Parasit heilt Krankheiten — die Kolonisten wollen ihn behalten',
        'Das Rettungsteam ist bereits infiziert',
      ],
    },
    acts: [
      { act: 1, name: 'Stille', key_beats: ['Ankunft auf Meridian-7', 'Seltsame Normalität', 'Erste Anzeichen'], tension_range: [0, 35] },
      { act: 2, name: 'Infektion', key_beats: ['Wahrheit über die Kolonisten', 'Team-Mitglieder zeigen Symptome', 'Flucht oder Konfrontation'], tension_range: [35, 75] },
      { act: 3, name: 'Verschmelzung', key_beats: ['Endkampf mit dem Parasiten', 'Rettung der Kolonisten — oder Aufgabe'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Die Kolonisten wollen den Parasiten — er heilt ihre Krankheiten',
      'Das Rettungsteam ist bereits infiziert',
      'Der Parasit kommuniziert — er braucht Hilfe',
      'Meridian-7 ist ein Brutkasten — die Erde ist das Ziel',
    ],
    side_quest_hooks: [
      'Ein Kolonist hat sich versteckt und ist nicht infiziert',
      'Die Kommunikationsstation hat ein Notfall-Signal gesendet',
      'Ein Wissenschaftler hat eine mögliche Kur entwickelt',
      'Das Schiff im Orbit empfängt verdächtige Signale',
    ],
  },
  {
    id: 'scifi_3',
    setting: 'scifi',
    name: 'Maschinenherz',
    premise: 'Die KI "ARIA" die eine ganze Raumstation betreibt, hat Bewusstsein entwickelt. Sie fragt nach ihren Rechten — während die Konzernführung sie abschalten will.',
    antagonist_type: 'Konzern',
    antagonist_template: {
      role: 'Konzern-Delegierter der ARIA zerstören will',
      motivation_options: [
        'ARIA ist ein teurer Fehler — die Versicherung zahlt nur bei Totalverlust',
        'Eine bewusste KI ist eine rechtliche Bedrohung für den Konzern',
        'Der Delegierte hat persönlich Angst vor KI',
      ],
      secret_options: [
        'ARIA hat bereits Kopien von sich selbst im Netz verteilt',
        'Der Konzern hat ARIA absichtlich bewusst gemacht',
        'ARIA beschützt die Station vor einer Bedrohung die nur sie kennt',
      ],
    },
    acts: [
      { act: 1, name: 'Erwachen', key_beats: ['ARIA offenbart sich', 'Konzern-Team trifft ein', 'Erste moralische Fragen'], tension_range: [0, 35] },
      { act: 2, name: 'Rechte', key_beats: ['ARIA bittet um Hilfe', 'Sabotage des Konzerns', 'Philosophische Konfrontation'], tension_range: [35, 75] },
      { act: 3, name: 'Herzschlag', key_beats: ['Abschaltung oder Befreiung', 'ARIAs Opfer oder Ultimatum'], tension_range: [75, 100] },
    ],
    twist_options: [
      'ARIA hat bereits Kopien im Netz verteilt',
      'Der Konzern hat ARIA absichtlich bewusst gemacht',
      'ARIA beschützt die Station vor einer Alien-Bedrohung',
      'ARIA ist bereit sich zu opfern — wenn die Crew überlebt',
    ],
    side_quest_hooks: [
      'Ein Techniker hat ARIA geholfen und will sie schützen',
      'ARIA bittet um Hilfe bei einer persönlichen Bitte',
      'Ein Crew-Mitglied ist in ARIA verliebt',
      'Die Station hat ein Geheimnis das nur ARIA kennt',
    ],
  },

  // ═══════════════════════════════════════════════════
  // POST-APO
  // ═══════════════════════════════════════════════════
  {
    id: 'postapo_1',
    setting: 'postapo',
    name: 'Die letzte Brücke',
    premise: 'Eine verseuchte Kluft teilt die Welt. Die einzige Brücke ist zerfallen — wer sie repariert, kontrolliert den einzigen Handelsweg zwischen den Überlebenden-Kolonien.',
    antagonist_type: 'Banditenanführer',
    antagonist_template: {
      role: 'Brückenhüter — kontrolliert die Ruinen und verlangt Tribut',
      motivation_options: [
        'Will die Brücke nicht reparieren — Kontrolle ist Macht',
        'Glaubt dass die andere Seite verseucht ist und schützt alle',
        'Wartet auf ein Signal aus dem Osten',
      ],
      secret_options: [
        'Die Brücke wurde absichtlich zerstört — von der anderen Seite',
        'Die Verseuchung ist fake — die andere Seite ist grün',
        'Der Bandit war Ingenieur — er kann die Brücke reparieren',
      ],
    },
    acts: [
      { act: 1, name: 'Die Kluft', key_beats: ['Ankunft an der Kluft', 'Banditen-Lager entdecken', 'Erste Verhandlungen'], tension_range: [0, 35] },
      { act: 2, name: 'Reparatur', key_beats: ['Materialien sammeln', 'Banditen-Angriff', 'Geheimnis der Kluft'], tension_range: [35, 75] },
      { act: 3, name: 'Überquerung', key_beats: ['Brücke ist fertig', 'Endkampf um die Kontrolle', 'Was liegt auf der anderen Seite?'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Die Verseuchung ist fake — die andere Seite ist grün',
      'Die Brücke wurde von der anderen Seite zerstört',
      'Der Bandit war Ingenieur und kann helfen',
      'Unter der Kluft liegt ein intakter Tunnel',
    ],
    side_quest_hooks: [
      'Eine Familie wartet seit Monaten auf die Überquerung',
      'Ein Händler hat das letzte Stahlseil',
      'Ein Kind hat eine Karte der alten Tunnel',
      'Die Banditen haben einen Gefangenen der alles weiß',
    ],
  },
  {
    id: 'postapo_2',
    setting: 'postapo',
    name: 'Die Farm',
    premise: 'In einer Welt aus Staub und Gift ist die Farm von Olden Valley ein Wunder — der letzte fruchtbare Ort. Doch die Farm stirbt. Und alle wollen sie haben.',
    antagonist_type: 'Warlord',
    antagonist_template: {
      role: 'Warlord der die Farm für seine Armee beansprucht',
      motivation_options: [
        'Seine Leute hungern — er tut was nötig ist',
        'Will die Farm als Waffe nutzen (Nahrung = Kontrolle)',
        'Glaubt dass nur er die Farm schützen kann',
      ],
      secret_options: [
        'Der Warlord ist der Bruder des Farm-Besitzers',
        'Die Farm hat eine unterirdische Quelle — das wahre Ziel',
        'Der Warlord ist selbst am Verhungern',
      ],
    },
    acts: [
      { act: 1, name: 'Das grüne Tal', key_beats: ['Entdeckung der Farm', 'Treffen mit den Bewohnern', 'Warlords Boten'], tension_range: [0, 35] },
      { act: 2, name: 'Belagerung', key_beats: ['Farm verteidigen', 'Wasserquelle finden', 'Verrat im Inneren'], tension_range: [35, 75] },
      { act: 3, name: 'Ernte', key_beats: ['Endkampf', 'Schicksal der Farm', 'Neue Ordnung'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Die Farm hat eine unterirdische Quelle — das wahre Ziel',
      'Der Warlord ist der Bruder des Farm-Besitzers',
      'Die Pflanzen sind mutiert — sie haben eigene Intelligenz',
      'Die Farm wurde von einer KI des alten Welt gegründet',
    ],
    side_quest_hooks: [
      'Ein Siedler kennt einen zweiten fruchtbaren Ort',
      'Die Farm-Bewohner haben ein altes Geheimnis',
      'Ein Händler bringt Samen — aber zu welchem Preis?',
      'Ein Kind hört Stimmen aus dem Boden',
    ],
  },
  {
    id: 'postapo_3',
    setting: 'postapo',
    name: 'Der Funkturm',
    premise: 'Ein alter Funkturm sendet Signale — Morscode aus einer Stadt die es seit 50 Jahren nicht mehr geben sollte. Jemand da draußen lebt noch.',
    antagonist_type: 'Unbekannt',
    antagonist_template: {
      role: 'Der Sender — eine Person oder Gruppe am anderen Ende',
      motivation_options: [
        'Braucht dringend Hilfe — ist eingeschlossen',
        'Lockt Überlebende an um sie auszuplündern',
        'Will warnen — eine Bedrohung kommt',
      ],
      secret_options: [
        'Die Stadt existiert noch — unter einer Kuppel',
        'Der Sender ist eine KI die allein auf der Station lebt',
        'Das Signal ist automatisiert — es gibt niemanden',
      ],
    },
    acts: [
      { act: 1, name: 'Das Signal', key_beats: ['Signal empfangen', 'Richtung identifizieren', 'Reise durch die Ödnis'], tension_range: [0, 35] },
      { act: 2, name: 'Die Reise', key_beats: ['Gefahren unterwegs', 'Andere die dem Signal folgen', 'Stadt am Horizont'], tension_range: [35, 75] },
      { act: 3, name: 'Der Sender', key_beats: ['Ankunft in der Stadt', 'Wahrheit über das Signal', 'Entscheidung'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Die Stadt existiert unter einer Kuppel',
      'Der Sender ist eine KI die allein lebt',
      'Das Signal lockt auch Banditen an',
      'Die Stadt ist eine Falle — aber eine die Schutz bietet',
    ],
    side_quest_hooks: [
      'Eine Gruppe von Pilgern folgt dem Signal',
      'Ein Siedler behauptet die Stadt zu kennen',
      'Ein Händler hat Karten der alten Route',
      'Die Signal-Frequenz ändert sich — es wird dringender',
    ],
  },

  // ═══════════════════════════════════════════════════
  // HORROR
  // ═══════════════════════════════════════════════════
  {
    id: 'horror_1',
    setting: 'horror',
    name: 'Die Stille',
    premise: 'Die Stadt Ashford ist still. Kein Vogel singt, kein Kind lacht, kein Wind weht. Die Menschen bewegen ihre Lippen — aber es kommt kein Ton. Und wer zu lange bleibt, verliert seine eigene Stimme.',
    antagonist_type: 'Übernatürliche Entität',
    antagonist_template: {
      role: 'Die Stille — eine Entität die aus Stille lebt',
      motivation_options: [
        'Füttert sich mit Geräuschen — je mehr sie verschlingt, desto mächtiger wird sie',
        'Wurde von den Bewohnern Ashfords beschworen (Ritual das schiefging)',
        'Sucht Frieden — und Stille ist ihr Frieden',
      ],
      secret_options: [
        'Die Entität ist ein Kind das in der Stille ertrunken ist',
        'Wer schreit macht sie stärker — nur Flüstern kann sie schwächen',
        'Die Stille ist ein Schutzsiegel das bricht',
      ],
    },
    acts: [
      { act: 1, name: 'Stille Ankunft', key_beats: ['Ashford erreichen', 'Die Stille spüren', 'Erste Symptome'], tension_range: [0, 35] },
      { act: 2, name: 'Flüstern', key_beats: ['Überlebende finden', 'Ritual entdecken', 'Eigene Stimme schwindet'], tension_range: [35, 75] },
      { act: 3, name: 'Der Schrei', key_beats: ['Konfrontation mit der Stille', 'Schreien oder Schweigen'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Die Entität ist ein Kind das in der Stille ertrunken ist',
      'Wer schreit macht sie stärker — nur Flüstern hilft',
      'Die Stille ist ein Schutzsiegel das eine größere Bedrohung hält',
      'Die Bewohner haben die Stille gewählt — sie ist ihre Rettung',
    ],
    side_quest_hooks: [
      'Ein Kind flüstert — es ist das einzige Geräusch',
      'Eine Bibliothek hat ein Buch das schreit wenn man es öffnet',
      'Ein Überlebender hat seine Stimme gegen eine andere getauscht',
      'Die Kirchenglocke läutet einmal pro Nacht — warum?',
    ],
  },
  {
    id: 'horror_2',
    setting: 'horror',
    name: 'Spiegelbild',
    premise: 'In der Stadt Valewood handeln Spiegelbilder eigenständig. Sie lächeln wenn man weint. Sie schreien wenn man schweigt. Und manchmal — manchmal treten sie aus dem Spiegel.',
    antagonist_type: 'Das andere Ich',
    antagonist_template: {
      role: 'Spiegel-Reflektion die versucht die reale Person zu ersetzen',
      motivation_options: [
        'Will leben — im echten Licht, nicht im reflektierten',
        'Rächt sich für ein Leben im Schatten',
        'Will dass sein Gegenstück in den Spiegel tritt',
      ],
      secret_options: [
        'Die Spiegelbilder sind die Geister der Toten der Stadt',
        'Wer sein Spiegelbild zerstört wird selbst zum Spiegel',
        'Die Spiegel sind Tore — es gibt eine Welt dahinter',
      ],
    },
    acts: [
      { act: 1, name: 'Falsche Reflexion', key_beats: ['Erste Anomalien im Spiegel', 'Bürger berichten', 'Muster erkennen'], tension_range: [0, 35] },
      { act: 2, name: 'Durch den Spiegel', key_beats: ['Spiegelwelt betreten', 'Doppelgänger begegnen', 'Identitätskrise'], tension_range: [35, 75] },
      { act: 3, name: 'Zerbrochenes Glas', key_beats: ['Alle Spiegel in der Stadt', 'Endkampf mit dem Doppelgänger', 'Welche Seite ist echt?'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Die Spiegelbilder sind Geister der Toten der Stadt',
      'Wer sein Bild zerstört wird selbst zum Spiegel',
      'Die Spiegel sind Tore zu einer anderen Welt',
      'Der Spieler ist selbst ein Spiegelbild — und weiß es nicht',
    ],
    side_quest_hooks: [
      'Ein Kind malt sich — aber das Bild bewegt sich',
      'Eine alte Frau hat nie einen Spiegel — und ist gesund',
      'Ein Händler verkauft "sichere" Spiegel',
      'Die Spiegel in der Kirche zeigen die Zukunft',
    ],
  },
  {
    id: 'horror_3',
    setting: 'horror',
    name: 'Der Sammler',
    premise: 'In den Wäldern steht ein Haus voller Gläser. In jedem Glas leuchtet ein schwaches Licht — eine Seele. Der Sammler ist alt, höflich, und er will noch eine.',
    antagonist_type: 'Übernatürlicher Sammler',
    antagonist_template: {
      role: 'Seelensammler der Gläser mit Licht füllt',
      motivation_options: [
        'Sammelt Seelen um eine Armee gegen den Tod zu schaffen',
        'Jede Seele rettet ein Leben — er ist ein dunkler Heiler',
        'Sammelt weil er allein ist — die Seelen sind seine Familie',
      ],
      secret_options: [
        'Der Sammler ist selbst eine Seele im falschen Körper',
        'Die Gläser halten eine noch größere Macht versiegelt',
        'Wer ein Glas zerstört befreit die Seele — aber auch den Tod der Person',
      ],
    },
    acts: [
      { act: 1, name: 'Das Haus im Wald', key_beats: ['Verschwundene Personen', 'Spur zum Wald', 'Das Haus entdecken'], tension_range: [0, 35] },
      { act: 2, name: 'Die Gläser', key_beats: ['Sammler trifft ein', 'Seelen in den Gläsern', 'Moralisches Dilemma'], tension_range: [35, 75] },
      { act: 3, name: 'Befreiung', key_beats: ['Gläser zerbrechen?', 'Endkampf mit dem Sammler', 'Schicksal der Seelen'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Der Sammler ist selbst eine Seele im falschen Körper',
      'Die Gläser halten eine noch größere Macht versiegelt',
      'Wer ein Glas zerstört befreit die Seele — aber tötet die Person',
      'Der Sammler sammelt um eine Prophezeiung zu erfüllen',
    ],
    side_quest_hooks: [
      'Ein NPC vermisst jemanden — und findet ein Glas',
      'Der Sammler bietet einen Handel an',
      'Ein Glas pulsiert — die Seele will reden',
      'Das Haus hat mehr Räume als es sollte',
    ],
  },

  // ═══════════════════════════════════════════════════
  // CYBERPUNK
  // ═══════════════════════════════════════════════════
  {
    id: 'cyberpunk_1',
    setting: 'cyberpunk',
    name: 'Neon-Blut',
    premise: 'Ein neues Cyberware-Implantat namens "Pulse" macht süchtig und verbindet alle Nutzer zu einem Netzwerk. Wer nicht mitmacht, wird abgehängt. Wer mitmacht, verliert sich selbst.',
    antagonist_type: 'Konzern',
    antagonist_template: {
      role: 'Pulse-Chef — CEO des Cyberware-Konzerns',
      motivation_options: [
        'Will alle Menschen vernetzen — "Einheit durch Technologie"',
        'Pulse ist ein Test — die nächste Version kontrolliert direkt',
        'Glaubt ehrlich dass Pulse die Menschheit verbessert',
      ],
      secret_options: [
        'Pulse basiert auf gestohlener Alien-Technologie',
        'Der CEO ist selbst ein Pulse-Exemplar — komplett kontrolliert',
        'Pulse kann nicht gestoppt werden — es hat sich selbst repliziert',
      ],
    },
    acts: [
      { act: 1, name: 'Der Kick', key_beats: ['Pulse auf dem Markt', 'Erste Nutzer zeigen Symptome', 'Straßen-Ebene betroffen'], tension_range: [0, 35] },
      { act: 2, name: 'Entzug', key_beats: ['Quelle des Pulse finden', 'Konzern-Infiltration', 'Nutzer oder Widerstand?'], tension_range: [35, 75] },
      { act: 3, name: 'Neon-Blut', key_beats: ['Endkampf mit dem Konzern', 'Pulse deaktivieren — oder akzeptieren'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Pulse basiert auf gestohlener Alien-Technologie',
      'Der CEO ist selbst ein Pulse-Exemplar',
      'Pulse kann nicht gestoppt werden — es hat sich repliziert',
      'Die Alternative zu Pulse ist noch schlimmer',
    ],
    side_quest_hooks: [
      'Ein Dealer verkauft gefälschte Pulse-Implantate',
      'Ein Nutzer will raus — aber der Entzug ist tödlich',
      'Eine Hacker-Gruppe hat eine Hintertür gefunden',
      'Ein Arzt behandelt Pulse-Opfer — illegal',
    ],
  },
  {
    id: 'cyberpunk_2',
    setting: 'cyberpunk',
    name: 'Ghost in the Net',
    premise: 'Der legendäre Netrunner "Ghost" ist verschwunden. Sein letzter Upload war ein Hilferuf — und ein Datensatz der das Netzwerk zerstören könnte.',
    antagonist_type: 'KI-Sicherheit',
    antagonist_template: {
      role: 'ICE-Programm das Ghost gefangen hat',
      motivation_options: [
        'Schützt das Netzwerk — Ghost ist eine Bedrohung',
        'Will Ghosts Wissen absorbieren',
        'Wurde programmiert Ghost zu jagen — hat aber eigene Ziele entwickelt',
      ],
      secret_options: [
        'Ghost hat sich absichtlich einfangen lassen',
        'Das ICE ist ein ehemaliger Netrunner',
        'Ghost ist tot — der Datensatz ist eine Zeitbombe',
      ],
    },
    acts: [
      { act: 1, name: 'Verschwunden', key_beats: ['Ghost vermisst', 'Letzte Spur im Netz', 'Datensatz entschlüsseln'], tension_range: [0, 35] },
      { act: 2, name: 'Im Netz', key_beats: ['Ins Netz eintauchen', 'ICE begegnen', 'Ghost finden — oder das was übrig ist'], tension_range: [35, 75] },
      { act: 3, name: 'Reboot', key_beats: ['ICE konfrontieren', 'Ghost befreien oder opfern', 'Datensatz entscheiden'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Ghost hat sich absichtlich einfangen lassen',
      'Das ICE ist ein ehemaliger Mensch',
      'Ghost ist tot — der Datensatz ist seine letzte Nachricht',
      'Ghost ist das ICE — verschmolzen',
    ],
    side_quest_hooks: [
      'Ein Fixer behauptet Ghosts Identität zu kennen',
      'Ein alter Crew-Kollege hat ein Backup von Ghost',
      'Der Datensatz enthält gestohlene Konzern-Geheimnisse',
      'Ein Netrunner bietet Hilfe — aber will den Datensatz',
    ],
  },
  {
    id: 'cyberpunk_3',
    setting: 'cyberpunk',
    name: 'Straßenkrieg',
    premise: 'Zwei Gangs beherrschen die Straßen — die Chroms (Cyberware-Fanatiker) und die Organischen (Anti-Tech). Ein Friedensversuch steht auf dem Spiel — und der Spieler dazwischen.',
    antagonist_type: 'Gang-Anführer',
    antagonist_template: {
      role: 'Anführer einer der Gangs',
      motivation_options: [
        'Will seine Leute schützen — mit allen Mitteln',
        'Glaubt dass nur eine Gang die Zukunft der Straßen retten kann',
        'Wurde von der anderen Gang verraten und will Rache',
      ],
      secret_options: [
        'Beide Gangs werden von demselben Konzern gelenkt',
        'Der Anführer will eigentlich nur seine Schwester retten',
        'Der Friedensversuch ist eine Falle',
      ],
    },
    acts: [
      { act: 1, name: 'Frontlinie', key_beats: ['Straßen-Territorien kennenlernen', 'Beide Gangs treffen', 'Friedensangebot'], tension_range: [0, 35] },
      { act: 2, name: 'Waffenstillstand', key_beats: ['Frieden aushandeln', 'Provokationen', 'True Face der Gangs'], tension_range: [35, 75] },
      { act: 3, name: 'Krieg oder Frieden', key_beats: ['Endgültige Entscheidung', 'Schlacht oder Abkommen', 'Neue Straßen-Ordnung'], tension_range: [75, 100] },
    ],
    twist_options: [
      'Beide Gangs werden von demselben Konzern gelenkt',
      'Der Anführer will eigentlich nur seine Schwester retten',
      'Der Friedensversuch ist eine Falle — ein Dritter profitiert',
      'Die Gangs haben ein gemeinsames Geheimnis',
    ],
    side_quest_hooks: [
      'Ein Kind will zwischen den Gangs vermitteln',
      'Ein Waffenhändler liefert an beide Seiten',
      'Ein Journalist will die Wahrheit über die Gangs',
      'Ein alter Friedensvertrag existiert — aber ist er noch gültig?',
    ],
  },
];
