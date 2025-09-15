import { useState, useEffect, useCallback } from 'react';
import {
  startTypesenseServer,
  stopTypesenseServer,
  isTypesenseServerRunning,
  onTypesenseStatusUpdate,
  ServerStatus,
} from './typesense';

interface UseTypesenseReturn {
  isRunning: boolean;
  isLoading: boolean;
  error: string | null;
  serverStatus: ServerStatus | null;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useTypesense(): UseTypesenseReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  // Check initial server status
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const running = await isTypesenseServerRunning();
        setIsRunning(running);
      } catch (err) {
        setError(`Failed to check initial server status: ${err}`);
      }
    };

    checkInitialStatus();
  }, []);

  // Listen for server status updates
  useEffect(() => {
    const unsubscribe = onTypesenseStatusUpdate((status: ServerStatus) => {
      setServerStatus(status);
      setIsRunning(status.is_healthy);
      if (!status.is_healthy) {
        setError(status.message);
      } else {
        setError(null);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const startServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await startTypesenseServer();
      setIsRunning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopServer = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await stopTypesenseServer();
      setIsRunning(false);
      setServerStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const running = await isTypesenseServerRunning();
      setIsRunning(running);
    } catch (err) {
      setError(`Failed to refresh server status: ${err}`);
    }
  }, []);

  return {
    isRunning,
    isLoading,
    error,
    serverStatus,
    startServer,
    stopServer,
    refreshStatus,
  };
}
