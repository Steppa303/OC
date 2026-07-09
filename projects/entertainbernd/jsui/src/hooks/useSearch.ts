import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApiHeaders } from './useTelegram';
import type { SearchResponse, QueueResponse, DownloadRequest, DownloadResponse } from '../types';

// ── Search ──
export function useSearch(query: string, cat: string | null, page: number) {
  const headers = useApiHeaders();

  return useQuery<SearchResponse>({
    queryKey: ['search', query, cat, page],
    queryFn: async () => {
      const params = new URLSearchParams({ q: query, page: String(page), limit: '20' });
      if (cat) params.set('cat', cat);
      const res = await fetch(`/api/search?${params}`, { headers });
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: query.length >= 2,
    placeholderData: (prev) => prev,
  });
}

export function useDebouncedSearch() {
  const [rawQuery, setRawQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [cat, setCat] = useState<string | null>('2000,5000');
  const [page, setPage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(rawQuery);
      setPage(0);
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [rawQuery]);

  const search = useSearch(debouncedQuery, cat, page);

  const setQuery = useCallback((q: string) => setRawQuery(q), []);

  return { rawQuery, setQuery, debouncedQuery, cat, setCat, page, search };
}

// ── Download ──
export function useDownload() {
  const headers = useApiHeaders();
  const [loading, setLoading] = useState(false);

  const download = useCallback(async (req: DownloadRequest): Promise<DownloadResponse> => {
    setLoading(true);
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Download failed');
      return data;
    } finally {
      setLoading(false);
    }
  }, [headers]);

  return { download, loading };
}

// ── Config (localStorage) ──
export function useConfig() {
  const [mediaType, setMediaType] = useState(() => {
    return localStorage.getItem('eb_media_type') || 'film';
  });
  const [language, setLanguage] = useState<string | null>(() => {
    return localStorage.getItem('eb_language') || null;
  });
  const [source, setSource] = useState<string | null>(() => {
    return localStorage.getItem('eb_source') || null;
  });

  const updateMediaType = useCallback((val: string) => {
    setMediaType(val);
    localStorage.setItem('eb_media_type', val);
  }, []);

  const updateLanguage = useCallback((val: string | null) => {
    setLanguage(val);
    if (val) localStorage.setItem('eb_language', val);
    else localStorage.removeItem('eb_language');
  }, []);

  const updateSource = useCallback((val: string | null) => {
    setSource(val);
    if (val) localStorage.setItem('eb_source', val);
    else localStorage.removeItem('eb_source');
  }, []);

  return { mediaType, setMediaType: updateMediaType, language, setLanguage: updateLanguage, source, setSource: updateSource };
}