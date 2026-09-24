import { API_BASE_URL, getStoredTokens } from './api';

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface RealtimeEvent {
  type: string;
  data: any;
}

export interface RealtimeHandlers {
  onEvent?: (event: RealtimeEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
}

const MAX_BACKOFF_MS = 15000;
const BASE_BACKOFF_MS = 1000;

/**
 * Server-Sent Events client for /api/v2/realtime/events.
 *
 * Uses streaming fetch instead of native EventSource so the Bearer access
 * token can be sent in the Authorization header (same pattern as
 * chatQueryStream in api.ts). Includes automatic reconnection with
 * exponential backoff + jitter.
 */
export function connectRealtime(handlers: RealtimeHandlers): () => void {
  const controller = new AbortController();
  let disposed = false;
  let attempt = 0;

  const setStatus = (status: RealtimeStatus) => handlers.onStatus?.(status);

  const scheduleReconnect = () => {
    if (disposed || controller.signal.aborted) return;
    const jitter = Math.random() * 400;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS) + jitter;
    attempt += 1;
    setStatus('connecting');
    window.setTimeout(() => {
      if (!disposed && !controller.signal.aborted) void openStream();
    }, delay);
  };

  const handleSessionExpired = () => {
    if (!disposed) {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
  };

  const openStream = async (): Promise<void> => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setStatus('disconnected');
      return;
    }

    try {
      setStatus('connecting');

      const response = await fetch(`${API_BASE_URL}/realtime/events`, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      if (response.status === 401) {
        // Auth expired is a terminal state for this user, not an idle stream:
        // surface it honestly instead of collapsing into "disconnected".
        setStatus('error');
        handleSessionExpired();
        return;
      }

      if (!response.ok || !response.body) {
        throw new Error(`Realtime stream error ${response.status}`);
      }

      // Connected — reset backoff and start parsing frames.
      attempt = 0;
      setStatus('connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processFrame = (frame: string) => {
        let eventType = 'message';
        const dataLines: string[] = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (dataLines.length === 0) return;
        try {
          handlers.onEvent?.({ type: eventType, data: JSON.parse(dataLines.join('\n')) });
        } catch {
          // Malformed payload — skip frame rather than killing the stream.
        }
      };

      // Read frames until the server closes the stream.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let separatorIndex = buffer.indexOf('\n\n');
        while (separatorIndex !== -1) {
          const frame = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          if (frame.trim() && !frame.startsWith(':')) processFrame(frame);
          separatorIndex = buffer.indexOf('\n\n');
        }
      }

      // Server closed the stream cleanly — reconnect.
      scheduleReconnect();
    } catch (err: any) {
      if (disposed || controller.signal.aborted || err?.name === 'AbortError') return;
      scheduleReconnect();
    }
  };

  setStatus('connecting');
  void openStream();

  return () => {
    disposed = true;
    controller.abort();
    setStatus('disconnected');
  };
}
