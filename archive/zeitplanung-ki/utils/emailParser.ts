import PostalMime from 'postal-mime';

export interface ParsedEmail {
  subject: string;
  body: string;
  date: string | null; // ISO String
  attachments: File[];
}

/**
 * Parses a raw .eml file into structured data.
 * Extracts text content, date, and image attachments.
 */
export const parseEmail = async (file: File): Promise<ParsedEmail> => {
  try {
    const parser = new PostalMime();
    const buffer = await file.arrayBuffer();
    const email = await parser.parse(buffer);

    // 1. Extract Body Text
    // Prefer plain text, fallback to extracting text from HTML
    let body = email.text || "";
    if (!body && email.html) {
       const tempDiv = document.createElement("div");
       tempDiv.innerHTML = email.html;
       body = tempDiv.textContent || tempDiv.innerText || "";
    }

    // 2. Extract Attachments (Images AND PDFs)
    const attachments: File[] = [];
    if (email.attachments) {
      for (const att of email.attachments) {
        // Support Images AND PDFs
        if (att.mimeType.startsWith("image/") || att.mimeType === "application/pdf") {
           // postal-mime provides content as ArrayBuffer/Uint8Array in `content`
           // We convert it back to a browser File object
           
           const fallbackExt = att.mimeType === "application/pdf" ? ".pdf" : ".png";
           const fallbackName = `email_attachment_${Date.now()}${fallbackExt}`;

           const newFile = new File([att.content], att.filename || fallbackName, { type: att.mimeType });
           attachments.push(newFile);
        }
      }
    }
    
    // Also check for inline images that might be relevant (e.g. screenshots pasted in body)
    // postal-mime often lumps them in attachments or strictly as inline. 
    // We can include them as attachments for the AI to see.
    // Note: Inline images usually have a contentId.
    
    // 3. Extract Date
    let dateStr: string | null = null;
    if (email.date) {
        // email.date is usually a JS Date object in postal-mime, or string.
        // The type definition says string | Date usually.
        // Let's force check.
        try {
            const dateObj = new Date(email.date);
            if (!isNaN(dateObj.getTime())) {
                dateStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            }
        } catch (e) {
            console.warn("Could not parse email date", email.date);
        }
    }

    return {
      subject: email.subject || "(Kein Betreff)",
      body: body.trim(),
      date: dateStr,
      attachments
    };
  } catch (error) {
      console.error("Email Parsing Failed:", error);
      throw new Error("Konnte E-Mail nicht lesen. Format eventuell beschädigt.");
  }
};