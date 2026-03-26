import { useCallback, useEffect, useState } from 'react';
import { fetchQuotesForLead, fetchQuote } from '@/lib/queries/quotes';
import type { Quote } from '@/lib/types';

export function useQuotesForLead(leadId: string) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchQuotesForLead(leadId);
      setQuotes(data);
    } catch {
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  return { quotes, loading, refetch: load };
}

export function useQuote(quoteId: string) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchQuote(quoteId);
      setQuote(data);
    } catch {
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  return { quote, loading, refetch: load };
}
