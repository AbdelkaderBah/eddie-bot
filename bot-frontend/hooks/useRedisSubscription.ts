// hooks/useRedisSubscription.ts
'use client';

import { useState, useEffect } from 'react';

interface UseRedisSubscriptionOptions {
  channel: string;
  onMessage?: (data: any) => void;
  enabled?: boolean;
}

export function useRedisSubscription({
  channel,
  onMessage,
  enabled = true
}: UseRedisSubscriptionOptions) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const eventSource = new EventSource(`/api/analytics-stream`);
    let mounted = true;

    eventSource.onopen = () => {
      if (mounted) {
        setIsConnected(true);
        setError(null);
      }
    };

    eventSource.onmessage = (event) => {
      if (mounted) {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
          onMessage?.(parsedData);
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      }
    };

    eventSource.onerror = (err) => {
      if (mounted) {
        setIsConnected(false);
        setError(err as unknown as Error);
        eventSource.close();
      }
    };

    return () => {
      mounted = false;
      eventSource.close();
    };
  }, [channel, enabled, onMessage]);

  return { data, error, isConnected };
}
