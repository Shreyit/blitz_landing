type SubscriptionOptions = {
  url: string; key: string;
  onChange: (version?: number) => void;
  onStatus: (connected: boolean) => void;
  socketFactory?: (url: string) => WebSocket;
};

// Supabase Realtime's documented Phoenix JSON protocol. The channel sends only
// invalidations: public-channel publishers cannot supply trusted purse/roster data.
// https://supabase.com/docs/guides/realtime/protocol
export function subscribeAuction({url,key,onChange,onStatus,socketFactory = u => new WebSocket(u)}:SubscriptionOptions) {
  let stopped=false, socket:WebSocket|null=null, attempt=0, ref=0;
  let reconnect:ReturnType<typeof setTimeout>|undefined, joinTimeout:ReturnType<typeof setTimeout>|undefined;
  let heartbeat:ReturnType<typeof setInterval>|undefined, notification:ReturnType<typeof setTimeout>|undefined;
  let pendingHeartbeat:string|null=null;
  const topic='realtime:blitz:auction';
  function clearConnectionTimers() { clearTimeout(joinTimeout); clearInterval(heartbeat); pendingHeartbeat=null; }
  function connect() {
    if(stopped) return;
    let endpoint:URL;
    try {
      endpoint=new URL('/realtime/v1/websocket',url);
      if(!['http:','https:'].includes(endpoint.protocol)) throw new Error('Invalid project URL.');
    } catch { onStatus(false); scheduleReconnect(); return; }
    endpoint.protocol=endpoint.protocol==='https:' ? 'wss:' : 'ws:';
    endpoint.searchParams.set('apikey',key); endpoint.searchParams.set('vsn','1.0.0');
    let ws:WebSocket;
    try { ws=socketFactory(endpoint.toString()); }
    catch { scheduleReconnect(); return; }
    socket=ws;
    const send=(event:string,payload:object,channel=topic) => {
      const id=String(++ref); ws.send(JSON.stringify({topic:channel,event,payload,ref:id})); return id;
    };
    let joinRef='';
    ws.onopen=()=>{
      if(stopped || socket!==ws) return;
      joinRef=send('phx_join',{config:{broadcast:{ack:false,self:false},presence:{key:''},postgres_changes:[],private:false}});
      joinTimeout=setTimeout(()=>ws.close(),10_000);
      heartbeat=setInterval(()=>{
        if(pendingHeartbeat) { ws.close(); return; }
        if(ws.readyState===1) pendingHeartbeat=send('heartbeat',{},'phoenix');
      },25_000);
    };
    ws.onmessage=event=>{
      if(stopped || socket!==ws) return;
      try {
        const message=JSON.parse(String(event.data));
        if(message.topic==='phoenix' && message.ref===pendingHeartbeat) { pendingHeartbeat=null; return; }
        if(message.topic!==topic) return;
        if(message.event==='phx_reply' && message.ref===joinRef) {
          if(message.payload?.status!=='ok') { ws.close(); return; }
          clearTimeout(joinTimeout); attempt=0; onStatus(true);
          onChange(); // Subscribe first, then snapshot: close the initial-load race.
        } else if(message.event==='broadcast' && message.payload?.event==='auction_changed') {
          const version=message.payload.payload?.version;
          if(!Number.isInteger(version) || version<0 || notification) return;
          // Bound fetch storms. Never apply the untrusted broadcast as state.
          notification=setTimeout(()=>{ notification=undefined; if(!stopped) onChange(version); },50);
        } else if(['phx_error','phx_close','system'].includes(message.event) && message.payload?.status!=='ok') ws.close();
      } catch { /* Ignore malformed notifications; HTTP recovery remains active. */ }
    };
    ws.onerror=()=>ws.close();
    ws.onclose=()=>{
      if(socket!==ws) return;
      clearConnectionTimers(); socket=null; onStatus(false); scheduleReconnect();
    };
  }
  function scheduleReconnect() {
    if(stopped) return;
    clearTimeout(reconnect);
    reconnect=setTimeout(connect,Math.min(10_000,500*2**Math.min(attempt++,5))+Math.random()*250);
  }
  connect();
  return ()=>{
    stopped=true; clearTimeout(reconnect); clearTimeout(notification); clearConnectionTimers();
    const previous=socket; socket=null; previous?.close();
  };
}
