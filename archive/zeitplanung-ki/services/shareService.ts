
import { db } from '../lib/firebase';
import { SharedView, InboundRequest } from '../types';
import { generateId } from '../utils';

// Helper: Remove keys with undefined values because Firestore rejects them
const sanitizeConfig = (config: any) => {
  const clean = { ...config };
  Object.keys(clean).forEach(key => {
    if (clean[key] === undefined) {
      delete clean[key];
    }
  });
  return clean;
};

/**
 * Creates a new shared view configuration in Firestore.
 */
export const createSharedView = async (
  creatorId: string,
  config: SharedView['config']
): Promise<SharedView> => {
  const shareId = generateId(); // Use the util's simple ID generator or a UUID library
  
  // SANITIZE CONFIG: Remove undefined projectId if present
  const cleanConfig = sanitizeConfig(config);

  const newView: SharedView = {
    id: shareId,
    creatorId,
    config: cleanConfig,
    createdAt: new Date().toISOString()
  };

  try {
    // We use .set with the custom ID so the URL looks cleaner (just the ID)
    await db.collection('shared_views').doc(shareId).set(newView);
    return newView;
  } catch (error) {
    console.error("Error creating shared view:", error);
    throw new Error("Konnte Share-Link nicht erstellen.");
  }
};

/**
 * Retrieves a shared view by ID (for Phase 2: Viewer)
 */
export const getSharedView = async (shareId: string): Promise<SharedView | null> => {
    try {
        const doc = await db.collection('shared_views').doc(shareId).get();
        if (doc.exists) {
            return doc.data() as SharedView;
        }
        return null;
    } catch (error) {
        console.error("Error fetching shared view:", error);
        return null;
    }
};

/**
 * Submits a new task request from a guest viewer (Phase 3).
 */
export const submitInboundRequest = async (
  shareViewId: string,
  creatorId: string,
  data: { guestName: string; requestText: string; priority: 'normal' | 'high' }
): Promise<void> => {
  const id = generateId();
  const request: InboundRequest = {
    id,
    shareViewId,
    creatorId, // Crucial: This links the request to the Admin's inbox
    guestName: data.guestName,
    requestText: data.requestText,
    priority: data.priority,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  try {
    await db.collection('inbound_requests').doc(id).set(request);
  } catch (error) {
    console.error("Error submitting request:", error);
    throw new Error("Anfrage konnte nicht gesendet werden.");
  }
};

/**
 * Phase 4: Admin Side Functions
 */

export const subscribeToRequests = (
    creatorId: string,
    callback: (requests: InboundRequest[]) => void
) => {
    // FIX: Removed .orderBy('createdAt', 'desc') to avoid requiring a composite index in Firestore.
    // Sorting is now done client-side.
    return db.collection('inbound_requests')
        .where('creatorId', '==', creatorId)
        .where('status', '==', 'pending') // Only fetch pending items for the badge/active list
        .onSnapshot((snapshot) => {
            const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InboundRequest));
            // Client-side sort (Newest first)
            requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            callback(requests);
        });
};

export const updateRequestStatus = async (
    requestId: string,
    status: 'processed' | 'dismissed'
) => {
    try {
        await db.collection('inbound_requests').doc(requestId).update({ status });
    } catch (error) {
        console.error("Error updating request status:", error);
    }
};
