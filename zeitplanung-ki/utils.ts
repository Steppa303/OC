
import { storage } from './lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const getDaysArray = (start: Date, end: Date): Date[] => {
  const arr = [];
  for(let dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
      arr.push(new Date(dt));
  }
  return arr;
};

export const parseISO = (dateStr: string): Date => {
  return new Date(dateStr);
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const getRandomColor = (): string => {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 
    'bg-indigo-500', 'bg-teal-500', 'bg-orange-500', 
    'bg-cyan-500', 'bg-emerald-500'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const generateRecurringDates = (
  startDateStr: string,
  deadlineStr: string,
  targetWeekDays: number[] // 0=Sun, 1=Mon...
): string[] => {
  const start = new Date(startDateStr);
  const end = new Date(deadlineStr);
  const dates: string[] = [];

  // Safety break to prevent infinite loops if deadline is years away
  const maxIterations = 365; 
  let current = new Date(start);
  let count = 0;

  while (current <= end && count < maxIterations) {
    if (targetWeekDays.includes(current.getDay())) {
      dates.push(formatDate(current));
    }
    current.setDate(current.getDate() + 1);
    count++;
  }

  return dates;
};

export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If strictly not an image, just return empty or original (risky)
    // For this use case, we only really support images for base64 storage
    if (!file.type.startsWith('image/')) {
       console.warn("Non-image file detected. Skipping compression, but this might exceed Firestore limits.");
       const reader = new FileReader();
       reader.readAsDataURL(file);
       reader.onload = () => resolve(reader.result as string);
       reader.onerror = error => reject(error);
       return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Aggressive resizing to fit multiple images in 1MB Firestore limit
        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to JPEG with 0.6 quality
            // This typically results in files < 100KB
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            resolve(dataUrl);
        } else {
            reject(new Error("Could not get canvas context"));
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const dataURLtoFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export const uploadFile = async (file: File): Promise<string> => {
  if (!storage) throw new Error("Storage not initialized");
  
  // Create a unique filename
  const filename = `attachments/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
  const storageRef = ref(storage, filename);
  
  // Upload
  const snapshot = await uploadBytes(storageRef, file);
  
  // Get URL
  return getDownloadURL(snapshot.ref);
};

export const cleanText = (text: string): string => {
  if (!text) return "";
  
  // 1. Replace literal "\n" sequences with real newlines
  let cleaned = text.replace(/\\n/g, '\n');
  
  // 2. Attempt to fix URL encoded characters (e.g. %C3%BC -> ü)
  // Sometimes AI/PDF extraction leaves artifacts like this
  try {
      if (cleaned.includes('%')) {
          // Only attempt decode if it looks like there might be encoded chars
          // decodeURIComponent throws on malformed sequences (like "100%"), so we catch it
          cleaned = decodeURIComponent(cleaned);
      }
  } catch (e) {
      // If standard decoding fails, it might be raw percentages or partial data.
      // We accept the text as is (with fixed newlines).
  }
  
  return cleaned;
};
