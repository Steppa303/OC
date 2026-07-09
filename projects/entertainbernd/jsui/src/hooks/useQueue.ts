import { useState, useEffect, useCallback } from 'react';
import type { QueueResponse } from '../types';

export function useQueue() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
        setQueue(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 4000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const control = useCallback(async (nzoId: string, action: 'pause' | 'resume' | 'cancel' | 'delete') => {
    try {
      await fetch(`/api/queue/${nzoId}/${action}`, { method: 'POST' });
      // Refetch after control action
      setTimeout(fetchQueue, 500);
    } catch {}
  }, [fetchQueue]);

  return { queue, loading, control };
}