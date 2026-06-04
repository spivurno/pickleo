import { useEffect, useRef, useState } from 'react';

export function useSocket(sessionId, onMessage) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let retryTimer = null;

    function connect() {
      if (cancelled) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws?sessionId=${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => { if (!cancelled) setConnected(true); };
      ws.onmessage = e => { if (!cancelled) onMessageRef.current(JSON.parse(e.data)); };
      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        retryTimer = setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      wsRef.current?.close();
    };
  }, [sessionId]);

  return connected;
}
