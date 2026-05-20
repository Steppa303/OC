
import { GoogleGenAI, Type } from "@google/genai";
import { AIPlanResponse, ProjectPhase, TimeOffDetails } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "dummy_key_to_prevent_crash" });

// --- AUDIO TRANSCRIPTION (Phase 3 Extension) ---
export const transcribeAudio = async (base64Audio: string): Promise<string> => {
  // Switched from 'gemini-2.5-flash-native-audio-preview-12-2025' to 'gemini-2.0-flash-exp'
  // to resolve 404 errors while maintaining audio capability.
  const model = "gemini-2.0-flash-exp";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav", // We will record/convert to wav/webm depending on browser, generally audio/mp3 or wav works best
              data: base64Audio
            }
          },
          {
            text: "Transkribiere diese Sprachnachricht. Es handelt sich um eine Aufgabe oder Projektanfrage. Fasse dich kurz, präzise und korrigiere Füllwörter (Ähs, Öhs). Gib NUR den Text zurück."
          }
        ]
      }
    });

    return response.text || "";
  } catch (e) {
    console.error("Transcription failed", e);
    throw new Error("Spracherkennung fehlgeschlagen.");
  }
};

// --- LIQUID TASK FLOW (Phase 1) ---

/**
 * Checks if the user input contains a duration greater than the daily limit (e.g. "20h").
 */
export const detectOversizeRequest = (text: string, dailyCapacity: number = 8): boolean => {
   const match = text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:h|std|stunden|hours)\b/i);
   if (match) {
      const hours = parseFloat(match[1].replace(',', '.'));
      return hours > dailyCapacity;
   }
   return false;
};

export type LiquidGranularity = 'coarse' | 'balanced' | 'fine';

/**
 * Splits a large task into smaller phases based on available calendar slots.
 */
export const calculateLiquidSchedule = async (
  projectTitle: string,
  totalHours: number,
  deadline: string,
  startDate: string, // NEW: Start Date constraint
  availableSlots: { date: string, freeHours: number }[],
  granularity: LiquidGranularity = 'balanced'
): Promise<{ name: string, hours: number, date: string, rationale: string }[]> => {
    const model = "gemini-3-flash-preview";

    // Filter slots: Only future dates >= startDate AND that have space
    const validSlots = availableSlots.filter(s => s.freeHours > 0 && s.date >= startDate);
    
    // Create a compact string representation of availability to save tokens
    const availabilityContext = validSlots.map(s => `${s.date}: ${s.freeHours}h frei`).join('\n');

    let grainPrompt = "";
    switch (granularity) {
        case 'coarse':
            grainPrompt = "Strategie: 'Große Blöcke'. Versuche, die Aufgabe in so WENIGE Teile wie möglich zu splitten. Fülle Tage komplett auf, bevor du den nächsten nimmst. Vermeide Kleinteiligkeit.";
            break;
        case 'fine':
            grainPrompt = "Strategie: 'Aggressive Atomisierung'. Zerlege das Projekt in viele kleine, detaillierte Teilschritte (max 2-4 Stunden pro Block). Verteile sie breiter, um Flexibilität zu erhöhen.";
            break;
        default: // balanced
            grainPrompt = "Strategie: 'Ausgewogen'. Erstelle sinnvolle Arbeitspakete (z.B. 4-6h), die logisch zusammenhängen.";
            break;
    }

    const prompt = `
      Projekt: "${projectTitle}"
      Gesamtstunden: ${totalHours}
      Startdatum: ${startDate} (Keine Aufgaben VOR diesem Datum!)
      Deadline: ${deadline}
      
      Verfügbarkeit (Lücken im Kalender ab Startdatum - Wochenenden sind bereits gefiltert):
      ${availabilityContext}

      Aufgabe:
      Das Projekt ist zu groß für einen einzelnen Tag oder Block (Liquid Task Flow).
      Zerlege es in logische, aufeinanderfolgende Phasen (z.B. "Teil 1: Setup", "Teil 2: Entwurf").
      Verteile diese Phasen intelligent auf die verfügbaren Tage.
      
      ${grainPrompt}
      
      Regeln:
      1. Nutze NUR die gelisteten Tage mit freier Kapazität.
      2. Überschreite NIEMALS die freien Stunden eines Tages.
      3. Die Summe der Stunden aller Phasen muss ca. ${totalHours} ergeben.
      4. Versuche, zusammenhängende Blöcke zu bilden, aber respektiere die Lücken.
      5. Antworte als JSON Array.
    `;

    try {
        const response = await ai.models.generateContent({
             model,
             contents: prompt,
             config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            hours: { type: Type.NUMBER },
                            date: { type: Type.STRING, description: "YYYY-MM-DD" },
                            rationale: { type: Type.STRING, description: "Warum dieser Tag?" }
                        },
                        required: ["name", "hours", "date", "rationale"]
                    }
                }
             }
        });

        if (response.text) {
             return JSON.parse(response.text);
        }
        return [];
    } catch (e) {
        console.error("Liquid Schedule Error", e);
        return [];
    }
};

// --- INTENT DETECTION ---
export const detectUserIntent = async (prompt: string): Promise<'PROJECT' | 'TIMEOFF' | 'MANAGEMENT'> => {
  const model = "gemini-3-flash-preview";
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: `
          Klassifiziere den User-Input in eine von drei Kategorien:
          1. "PROJECT": Der User will ein neues Projekt planen oder Aufgaben erstellen (z.B. "Erstelle Plan für...", "Neues Projekt X", "SoMe Dreh in Hannover", "Jeden Tag 1h Kommunikation").
          2. "TIMEOFF": Der User will Abwesenheiten, Urlaub, Krankheit oder freie Tage eintragen (z.B. "Ich bin nächste Woche im Urlaub", "Montag frei", "Zeitausgleich").
          3. "MANAGEMENT": Der User will bestehende Einträge verwalten, löschen oder absagen (z.B. "Lösche alle Meetings", "Sage den Termin am Freitag ab", "Entferne Projekt X").
          
          Antworte NUR mit dem String "PROJECT", "TIMEOFF" oder "MANAGEMENT".
        `,
      }
    });
    const text = response.text?.trim().toUpperCase();
    if (text === 'TIMEOFF') return 'TIMEOFF';
    if (text === 'MANAGEMENT') return 'MANAGEMENT';
    return 'PROJECT';
  } catch (e) {
    console.error("Intent detection failed", e);
    return 'PROJECT'; // Fallback
  }
};

// --- MANAGEMENT COMMAND PARSING ---
export interface ManagementCommand {
  action: 'DELETE';
  targetLevel: 'PROJECT' | 'PHASE'; // PROJECT deletes the whole wrapper, PHASE deletes specific dates/phases
  keywords: string[]; // Search terms for title
  dateFilter?: {
    operator: 'BEFORE' | 'AFTER' | 'ON' | 'BETWEEN';
    date: string; // ISO YYYY-MM-DD
    endDate?: string; // Optional for BETWEEN
  };
  confirmationMessage: string;
}

export const parseManagementRequest = async (prompt: string, currentDate: string): Promise<ManagementCommand> => {
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: `Heute ist der ${currentDate}.
        Du bist ein Admin-Assistent für einen Kalender. Extrahiere den Befehl zum Löschen/Verwalten.
        
        Regeln:
        1. targetLevel: 
           - 'PHASE': Wenn es um "Termine", "Meetings" (Mehrzahl), "Einträge" geht.
           - 'PROJECT': Wenn explizit das "Projekt" oder "Ganze Vorhaben" gelöscht werden soll.
        2. dateFilter:
           - "ab dem 29.3." -> operator: 'AFTER', date: '2024-03-29' (Nutze aktuelles Jahr wenn nicht genannt).
           - "vor dem..." -> 'BEFORE'
           - "am..." -> 'ON'
        3. keywords: Welche Projekte/Termine sind gemeint? (z.B. "Daily", "Leitungsrunde").
        
        Antworte mit JSON.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ["DELETE"] },
            targetLevel: { type: Type.STRING, enum: ["PROJECT", "PHASE"] },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            dateFilter: {
              type: Type.OBJECT,
              properties: {
                operator: { type: Type.STRING, enum: ["BEFORE", "AFTER", "ON", "BETWEEN"] },
                date: { type: Type.STRING },
                endDate: { type: Type.STRING }
              },
              nullable: true
            },
            confirmationMessage: { type: Type.STRING, description: "Kurze Zusammenfassung was getan wird auf Deutsch (z.B. 'Lösche alle Dailys ab 29.03.')" }
          },
          required: ["action", "targetLevel", "keywords", "confirmationMessage"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ManagementCommand;
    }
    throw new Error("Konnte Management-Befehl nicht parsen");
  } catch (error) {
    console.error("Management parse error", error);
    throw error;
  }
};

// --- TIME OFF EXTRACTION ---
export const extractTimeOffDetails = async (prompt: string, currentDate: string): Promise<TimeOffDetails> => {
  const model = "gemini-3-flash-preview";
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: `Heute ist der ${currentDate}. Extrahiere die Zeitspanne für die Abwesenheit.
        - Wenn nur ein Tag genannt wird (z.B. "Montag"), sind startDate und endDate identisch.
        - "Nächste Woche" bedeutet Montag bis Freitag der kommenden Woche.
        - Gib einen kurzen Titel basierend auf dem Grund (Urlaub, Krank, Zeitausgleich).
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            startDate: { type: Type.STRING, description: "YYYY-MM-DD" },
            endDate: { type: Type.STRING, description: "YYYY-MM-DD" },
            reason: { type: Type.STRING }
          },
          required: ["title", "startDate", "endDate"]
        }
      }
    });
    
    if (response.text) {
      return JSON.parse(response.text) as TimeOffDetails;
    }
    throw new Error("Konnte Zeitraum nicht lesen");
  } catch (error) {
    console.error("TimeOff extraction error", error);
    throw error;
  }
};

// --- RESCHEDULING LOGIC ---
export const rebalanceSchedule = async (
  vacationStart: string,
  vacationEnd: string,
  conflictingPhases: { id: string, name: string, date: string, deadline: string, projectTitle: string, hours: number }[],
  currentDate: string,
  existingLoad: { date: string, hours: number }[] // NEW: Pass capacity context
): Promise<{ phaseId: string, newDate: string }[]> => {
  
  if (conflictingPhases.length === 0) return [];

  const model = "gemini-3-flash-preview";
  
  // Filter relevant loads to reduce token count (only surrounding dates)
  const relevantLoad = existingLoad.filter(l => l.hours > 0).map(l => `${l.date}: ${l.hours}h bereits gebucht`);

  const prompt = `
    Situation: Der Nutzer ist vom ${vacationStart} bis ${vacationEnd} abwesend (Urlaub).
    Problem: Folgende Aufgaben liegen genau in diesem Zeitraum und müssen verschoben werden:
    ${JSON.stringify(conflictingPhases)}
    
    Heute ist: ${currentDate}.
    
    Kontext - Aktuelle Auslastung an anderen Tagen (WICHTIG):
    ${JSON.stringify(relevantLoad)}
    (Tage die hier nicht stehen, haben 0 Stunden und sind frei.)

    Deine Aufgabe: Berechne neue Daten (YYYY-MM-DD) für diese Aufgaben.
    
    Regeln für intelligentes Verschieben (Priorität von oben nach unten):
    1. KAPAZITÄT BEACHTEN (KRITISCH):
       - Ein Arbeitstag hat maximal 8 Stunden Kapazität.
       - Lege KEINE Aufgaben auf Tage, die laut Liste oben schon >= 8h haben (Überlast vermeiden!).
       - Suche Tage mit "Lücken" (z.B. nur 2h oder 4h belegt).
    
    2. DEADLINE RETTUNG: Versuche, die Aufgaben VOR den Urlaub zu ziehen ("Vorarbeiten"), solange Regel 1 (Kapazität) eingehalten wird.
       - Nutze die Tage zwischen "Heute" (${currentDate}) und ${vacationStart}.
    
    3. FALLBACK: Wenn vor dem Urlaub alles voll ist (oder mathematisch unmöglich), schiebe auf die ersten freien Tage NACH dem Urlaub (${vacationEnd}).
    
    4. WOCHENENDEN: Vermeide Samstag/Sonntag strikt.
    
    Antworte als JSON Array mit Objekten { phaseId, newDate }.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              phaseId: { type: Type.STRING },
              newDate: { type: Type.STRING, description: "YYYY-MM-DD" }
            },
            required: ["phaseId", "newDate"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Reschedule error", error);
    return [];
  }
};

// --- EXISTING FUNCTIONS BELOW (Unchanged Logic, mostly) ---

export const parseProjectRequest = async (
  prompt: string, 
  currentDate: string,
  autoSplit: boolean = true
): Promise<AIPlanResponse> => {
  
  const model = "gemini-3-flash-preview";
  
  let splitInstruction = `
    3. Unterteile das Projekt in logische "Phasen".
       - Beispiel: "Videoschnitt" wird zu "Rohschnitt", "Feinschnitt", "Sounddesign", "Export".
       - WICHTIG: Wenn der Input eine E-Mail oder Aufgabenliste ist (z.B. "1. Logo", "2. Video"), nutze diese Punkte direkt als Phasen.
    4. Verteile die Gesamtstunden auf diese Phasen.
  `;

  if (!autoSplit) {
    splitInstruction = `
    3. Erstelle GENAU EINE Phase als Hauptaufgabe.
       - Name: Nutze den Projekttitel.
    4. Weise dieser Phase die vollen Gesamtstunden zu.
    `;
  }
  
  const systemInstruction = `
    Du bist ein erfahrener Projektmanager und Planer namens Smart Planner AI.
    Dein Ziel ist es, Projektanfragen in natürlicher Sprache in strukturierte Projektpläne umzuwandeln.
    
    Aktuelles Datum (heute): ${currentDate}.
    
    Der Input des Users kann aus einem Prompt, Inhalten aus E-Mails oder Texten aus PDFs bestehen.
    
    Regeln zur Analyse:
    1. Extrahiere den Projekttitel. 
       - Bei E-Mails: Nutze den Betreff oder den Kern des Inhalts (z.B. "Spotify Test Assets"). Ignoriere "WG:", "Fwd:" etc.
    
    2. Ermittle STARTDATUM und DEADLINE:
       - STARTDATUM (WICHTIG): Suche nach Phrasen wie "Start ab...", "Beginn am...", "Ab dem...".
         - Wenn explizit genannt: Nutze dieses Datum.
         - Wenn NICHT genannt: Setze 'startDate' auf das heutige Datum (${currentDate}).
       
       - DEADLINE:
         - Explizites Datum: Nutze dieses.
         - Relative Angaben ("in 3 Tagen"): Berechne ab Startdatum (oder Heute).
         - "Laufe der nächsten Woche": Wähle den Freitag der kommenden Woche.
         - Keine Angabe: Setze Deadline auf 14 Tage ab Startdatum.

    3. Ermittle die Gesamtstunden:
       - Schätze basierend auf der Komplexität der Aufgaben, falls nicht angegeben. (z.B. Logo Design ~4h, Video Loop ~4h).
    
    ${splitInstruction}

    5. SERIENTERMINE & WIEDERHOLUNGEN (KRITISCH):
       - Wenn der Nutzer schreibt "jeden Tag", "täglich", "jeden Mo/Di", "werktags", "wöchentlich" oder ähnlich:
       - Setze 'recurrence.isRecurring' auf true.
       - 'weekDays': 
          - "Jeden Tag", "Täglich" -> [1,2,3,4,5] (Mo-Fr), es sei denn User sagt explizit "auch Wochenende".
          - "Jeden Montag" -> [1].
          - "Außer Wochenende" -> [1,2,3,4,5].
       
       - PHASEN-STRUKTUR BEI ROUTINE (ABSOLUT WICHTIG):
         - Wenn es eine Routine-Aufgabe ist (z.B. "Jeden Tag 1h Admin"), erfinde KEINE Phasen wie "Analyse", "Setup" oder "Optimierung".
         - Erstelle GENAU EINE Phase im 'phases' Array.
         - Nenne diese Phase so wie den Titel oder einfach "Routine".
         
       - DAUER & SUMMEN-BERECHNUNG (SEHR WICHTIG):
         Fall A: "Jeden Tag 1 Stunde" (Dauer pro Termin gegeben):
            - 'phases[0].hours': Dauer EINES EINZELNEN Termins (z.B. 1).
            - 'totalHours': Multipliziere: (Anzahl der Termine) * (Dauer pro Termin).
            - BEISPIEL: "Täglich 1h bis Ende Februar" (ca. 20 Tage) -> totalHours = 20.
            - FALSCH: totalHours = 1.
         
         Fall B: "Insgesamt 20 Stunden aufteilen" (Gesamtdauer gegeben):
            - 'totalHours': 20.
            - 'phases[0].hours': 20 / (Anzahl Termine).
    
    6. SPEZIFISCHE PHASEN-TERMINE:
       - Wenn der Nutzer für eine Aufgabe ein KONKRETES Datum nennt (z.B. "Meeting am Mittwoch, 12.05.", "Abgabe Phase 1 am Freitag"), dann setze das Feld 'suggestedDate' für diese Phase.
       - Das 'suggestedDate' muss im Format YYYY-MM-DD sein.
       - Dies ist besonders wichtig für Einzeltermine wie "Besprechung am Mittwoch".

    7. PROJEKT-BESCHREIBUNG (Context Extraction):
       - Scanne den gesamten Text (Prompt, E-Mail-Body, PDF-Inhalt) nach Fakten.
       - Extrahiere: Technische Spezifikationen (Maße, Formate, Auflagen), Ansprechpartner, Orte, Materialien.
       - Fasse dies in 'description' zusammen.
       - Nutze Markdown (Bulletpoints) für technische Daten.
       - Sei präzise. Zitiere Maße exakt.

    8. AUSSENTERMINE (NEU & WICHTIG):
       - Analysiere, ob das Projekt an einem physischen Ort stattfindet (NICHT im Büro/Homeoffice).
       - Keywords: "Dreh", "Shooting", "Streifendienst", "Außendienst", "Vor Ort", "Montage", "Kundenbesuch", "Fahrt nach...", "Baustelle".
       - Wenn ja, setze 'isExternal' auf true.
       - Extrahiere den Ort in 'location' (z.B. "Hannover", "Berlin", "Studio 5").

    9. Berechne einen Confidence Score (0-100).
    10. Gib eine Begründung (rationale) an.
    
    WICHTIG: Antworte immer auf DEUTSCH für alle Textfelder (Titel, Phasen-Namen, Begründungen, Description).
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Name des Projekts" },
            description: { type: Type.STRING, description: "Zusammenfassung aller technischen Details und Anforderungen aus dem Input (Markdown)" },
            totalHours: { type: Type.NUMBER, description: "Geschätzte Gesamtstunden über die gesamte Laufzeit (Summe)" },
            startDate: { type: Type.STRING, description: "ISO Datumsstring (YYYY-MM-DD). Default: Heute." },
            deadline: { type: Type.STRING, description: "ISO Datumsstring (YYYY-MM-DD)" },
            confidenceScore: { type: Type.NUMBER, description: "Vertrauenswert 0-100" },
            rationale: { type: Type.STRING, description: "Begründung für die Planstruktur" },
            isExternal: { type: Type.BOOLEAN, description: "Handelt es sich um einen Außentermin?" },
            location: { type: Type.STRING, description: "Ort des Geschehens, falls extern (z.B. Stadt, Firma)" },
            recurrence: {
              type: Type.OBJECT,
              properties: {
                isRecurring: { type: Type.BOOLEAN },
                weekDays: { 
                  type: Type.ARRAY, 
                  items: { type: Type.INTEGER },
                  description: "Array von Zahlen: 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa" 
                },
                time: { type: Type.STRING, description: "Uhrzeit im HH:MM Format" }
              },
              nullable: true
            },
            phases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  hours: { type: Type.NUMBER, description: "WICHTIG: Bei Serienterminen (Case A) nur die Dauer EINES EINZELNEN Termins." },
                  rationale: { type: Type.STRING, description: "Warum diese Phase notwendig ist" },
                  suggestedDate: { type: Type.STRING, description: "Optional: ISO Date (YYYY-MM-DD) wenn ein explizites Datum für diesen Schritt im Text genannt wurde (z.B. 'Meeting am Mittwoch'). Sonst leer lassen." }
                },
                required: ["name", "hours", "rationale"]
              }
            }
          },
          required: ["title", "totalHours", "deadline", "confidenceScore", "phases", "rationale"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIPlanResponse;
    }
    throw new Error("Leere Antwort von der KI");
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const generatePhases = async (
  title: string,
  totalHours: number,
  deadline: string,
  userPrompt: string
): Promise<{ name: string; hours: number; rationale: string }[]> => {
  
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    Du bist ein Experte für Projektplanung.
    Deine Aufgabe: Unterteile ein Projekt in logische, sequenzielle Arbeitsschritte (Phasen).
    - Die Summe der Stunden der Phasen muss exakt den Gesamtstunden entsprechen.
    - Berücksichtige den ursprünglichen User-Prompt für Kontext (z.B. spezifische Aufgaben aus E-Mails).
    - Wenn keine Details vorhanden sind, erfinde sinnvolle Schritte für ein Projekt dieses Titels.
    - Antworte NUR mit dem JSON Array der Phasen.
    - Sprache: DEUTSCH.
  `;

  const prompt = `
    Projekt: ${title}
    Gesamtstunden: ${totalHours}
    Deadline: ${deadline}
    User Prompt: "${userPrompt}"
    
    Erstelle die Phasenliste.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              hours: { type: Type.NUMBER },
              rationale: { type: Type.STRING }
            },
            required: ["name", "hours", "rationale"]
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Gemini Generate Phases Error:", error);
    return [];
  }
};

export const refineProjectPlan = async (
  currentProject: { title: string, totalHours: number, deadline: string, startDate?: string, description?: string, isExternal?: boolean, location?: string },
  currentPhases: { name: string, hours: number, suggestedDate: string }[],
  userPrompt: string
): Promise<AIPlanResponse> => {
  
  const model = "gemini-3-flash-preview";

  const systemInstruction = `
    Du bist ein KI-Assistent, der hilft, bestehende Projektpläne zu bearbeiten.
    Gib das KOMPLETTE aktualisierte Projekt-Objekt zurück.
    Regeln:
    - Wenn der Nutzer das Datum ändert, passe 'deadline', 'startDate' und die 'suggestedDate' der Phasen an.
    - Wenn der Nutzer Phasen ändert, erstelle die neue Phasen-Liste.
    - Wenn der Nutzer die Beschreibung anpasst oder neue Infos gibt, aktualisiere 'description'.
    - Prüfe bei neuen Informationen (z.B. "ist doch in Hamburg"), ob 'isExternal' und 'location' angepasst werden müssen.
    - Behalte Informationen bei, die nicht geändert werden sollen.
    - Antworte im JSON Format.
  `;

  const prompt = `
    AKTUELLER STAND:
    Projekt: ${JSON.stringify(currentProject)}
    Phasen: ${JSON.stringify(currentPhases)}

    ÄNDERUNGSWUNSCH:
    "${userPrompt}"

    Bitte generiere den neuen Plan.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            totalHours: { type: Type.NUMBER },
            startDate: { type: Type.STRING, description: "ISO Date YYYY-MM-DD" },
            deadline: { type: Type.STRING, description: "ISO Date YYYY-MM-DD" },
            confidenceScore: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
            isExternal: { type: Type.BOOLEAN },
            location: { type: Type.STRING },
            recurrence: {
               type: Type.OBJECT,
               properties: {
                 isRecurring: { type: Type.BOOLEAN },
                 weekDays: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                 time: { type: Type.STRING }
               },
               nullable: true
            },
            phases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  hours: { type: Type.NUMBER },
                  suggestedDate: { type: Type.STRING, description: "ISO Date YYYY-MM-DD" },
                  rationale: { type: Type.STRING }
                },
                required: ["name", "hours", "suggestedDate"]
              }
            }
          },
          required: ["title", "totalHours", "deadline", "phases"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIPlanResponse;
    }
    throw new Error("Leere Antwort von der KI");
  } catch (error) {
    console.error("Gemini Refine Error:", error);
    throw error;
  }
};

export const generateProjectDescription = async (
  currentDescription: string,
  contextText: string,
  imageParts: { inlineData: { mimeType: string; data: string } }[] = []
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    Du bist ein technischer Assistent. Deine Aufgabe ist es, eine präzise Projektbeschreibung ("Briefing") zu erstellen oder zu aktualisieren.
    Nutze den vorhandenen Text und die angehängten Bilder/PDF-Texte.
    
    Ziele:
    1. Extrahiere technische Daten (Maße, Formate, Mengen).
    2. Identifiziere logistische Details (Deadlines, Adressen).
    3. Fasse den Kerninhalt zusammen.
    4. Nutze Markdown (Bulletpoints, Fettung) für Lesbarkeit.
    5. Wenn Bilder da sind, beschreibe kurz, was darauf zu sehen ist, falls relevant für die Aufgabe (z.B. "Skizze zeigt Layout X").
    
    Antworte NUR mit dem Markdown-String.
  `;

  const promptText = `
    Aktuelle Beschreibung: "${currentDescription}"
    Neuer Kontext/Text aus Dateien:
    "${contextText}"
    
    Bitte erstelle die aktualisierte Beschreibung.
  `;

  const contents = {
    parts: [
      { text: promptText },
      ...imageParts
    ]
  };

  try {
     const response = await ai.models.generateContent({
        model,
        contents,
        config: {
           systemInstruction,
           responseMimeType: "text/plain"
        }
     });
     return response.text || "";
  } catch (error) {
     console.error("Description Generation Error:", error);
     return "";
  }
};

export const suggestSchedule = async (
  phases: { name: string; hours: number }[],
  startDate: string,
  deadline: string,
  existingBusyDates: string[] 
): Promise<{ phaseIndex: number; date: string }[]> => {
  
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Ich habe ein Projekt mit folgenden Phasen: ${JSON.stringify(phases)}.
    Startdatum (frühestens): ${startDate}.
    Deadline: ${deadline}.
    
    Die folgenden Daten sind bereits voll ausgebucht und sollten vermieden werden: ${JSON.stringify(existingBusyDates)}.
    
    Bitte weise jeder Phase ein Datum (YYYY-MM-DD) zu.
    Versuche, sequenziell vorzugehen.
    STRIKTE REGEL: Plane KEINE Aufgaben an Wochenenden (Samstag/Sonntag), außer es ist unvermeidbar.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            phaseIndex: { type: Type.INTEGER, description: "Index der Phase im ursprünglichen Array" },
            date: { type: Type.STRING, description: "YYYY-MM-DD" }
          }
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  return [];
};
