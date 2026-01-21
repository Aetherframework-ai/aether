import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorkflowEvent } from './types';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (event: WorkflowEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WorkflowEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WebSocket] Connected to', url);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        onOpen?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WorkflowEvent;
          setLastEvent(data);
          onMessage?.(data);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected from', url);
        setIsConnected(false);
        onClose?.();

        // 尝试重连
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        } else {
          console.error('[WebSocket] Max reconnect attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = maxReconnectAttempts; // 防止重连

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [maxReconnectAttempts]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    send,
    reconnect: () => {
      disconnect();
      reconnectAttemptsRef.current = 0;
      connect();
    },
  };
}

// Hook 用于订阅特定 workflow 的事件
export function useWorkflowEvents(workflowId: string, options?: Partial<UseWebSocketOptions>) {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WorkflowEvent | null>(null);

  const { isConnected: wsConnected, lastEvent: wsLastEvent, send, reconnect } = useWebSocket({
    url: options?.url || `ws://${window.location.host}/ws`,
    onMessage: (event) => {
      setLastEvent(event);
      setEvents((prev) => [...prev, event]);
    },
    onOpen: () => setIsConnected(true),
    onClose: () => setIsConnected(false),
    ...options,
  });

  // 订阅指定 workflow
  useEffect(() => {
    if (isConnected) {
      send({ type: 'subscribe', workflowId });
    }
  }, [isConnected, workflowId, send]);

  return {
    isConnected: wsConnected,
    lastEvent: wsLastEvent,
    events,
    send,
    reconnect,
  };
}
