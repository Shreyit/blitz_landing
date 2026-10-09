"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { AuctionState, PREVIEW } from "./event";
export function useAuction() {
  const [state, setState] = useState<AuctionState>(PREVIEW);
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await api<AuctionState>("/auction");
      setState(data);
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setChecked(true);
    }
  }, []);
  useEffect(() => {
    let cancelled = false,
      socket: WebSocket | null = null,
      retry: ReturnType<typeof setTimeout>;
    refresh();
    const poll = setInterval(refresh, 4000);
    function connect() {
      if (cancelled) return;
      // Use an explicit public socket URL in deployments; localhost is a development fallback.
      const url =
        process.env.NEXT_PUBLIC_WS_URL ||
        (location.hostname === "localhost" || location.hostname === "127.0.0.1"
          ? `ws://${location.hostname}:8000/api/auction/live`
          : "");
      if (!url) return;
      socket = new WebSocket(url);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AuctionState;
          if (!cancelled) {
            setState(data);
            setConnected(true);
            setChecked(true);
          }
        } catch {
          /* HTTP polling remains available. */
        }
      };
      socket.onclose = () => {
        if (!cancelled) retry = setTimeout(connect, 5000);
      };
      socket.onerror = () => socket?.close();
    }
    connect();
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearTimeout(retry);
      socket?.close();
    };
  }, [refresh]);
  return { state, setState, connected, checked, refresh };
}
