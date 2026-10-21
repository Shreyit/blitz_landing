"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { AuctionState, PREVIEW } from "./event";
import { mergeAuctionState } from './auction-state';
import { subscribeAuction } from './auction-realtime';
export function useAuction() {
  const [state, setRawState] = useState<AuctionState>(PREVIEW);
  const setState=useCallback((incoming:AuctionState)=>setRawState(current=>mergeAuctionState(current,incoming)),[]);
  const mounted=useRef(true);
  const httpFailed=useRef(false);
  const [connected, setConnected] = useState(false);
  const [checked, setChecked] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const data = await api<AuctionState>("/auction");
      if(!mounted.current) return;
      setState(data);
      httpFailed.current=false;
      setConnected(true);
    } catch {
      httpFailed.current=true;
      if(mounted.current) setConnected(false);
    } finally {
      if(mounted.current) setChecked(true);
    }
  }, [setState]);
  useEffect(() => {
    mounted.current=true;
    let cancelled = false,
      socket: WebSocket | null = null,
      retry: ReturnType<typeof setTimeout>;
    refresh();
    let live=false;
    const poll = setInterval(()=>{if(!live || httpFailed.current) refresh();}, 4000);
    // A slow checkpoint repairs a silently missed notification without making
    // interval polling the normal live-update path.
    const checkpoint=setInterval(refresh,30_000);
    let unsubscribe:(()=>void)|undefined;
    if(process.env.NEXT_PUBLIC_BACKEND_PROVIDER==='supabase') {
      const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if(url && key) unsubscribe=subscribeAuction({url,key,onChange:()=>{refresh();},onStatus:status=>{live=status;if(!status) refresh();}});
    }
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
            if(mounted.current) setState(data);
            setConnected(true);
            setChecked(true);
          }
        } catch {
          /* HTTP polling remains available. */
        }
      };
      socket.onclose = () => {
        live=false;
        if (!cancelled) retry = setTimeout(connect, 5000);
      };
      socket.onerror = () => socket?.close();
      socket.onopen=()=>{live=true; refresh();};
    }
    if(process.env.NEXT_PUBLIC_BACKEND_PROVIDER!=='supabase') connect();
    return () => {
      cancelled = true;
      mounted.current=false;
      clearInterval(poll);
      clearInterval(checkpoint);
      clearTimeout(retry);
      socket?.close();
      unsubscribe?.();
    };
  }, [refresh,setState]);
  return { state, setState, connected, checked, refresh };
}
