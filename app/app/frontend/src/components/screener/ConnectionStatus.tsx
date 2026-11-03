import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff } from "lucide-react";

interface Props {
  apiBase: string;
}

export function ConnectionStatus({ apiBase }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    try {
      const base = apiBase.replace(/\/screen$/, "");
      const res = await fetch(base, { method: "GET", signal: AbortSignal.timeout(5000) });
      setConnected(res.ok);
    } catch {
      setConnected(false);
    }
  }, [apiBase]);

  useEffect(() => {
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [check]);

  if (connected === null) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
        <span className="text-xs font-mono">Checking...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
      connected
        ? "border-primary/20 bg-primary/10 text-primary"
        : "border-destructive/20 bg-destructive/10 text-destructive"
    }`}>
      {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span className="text-xs font-mono">{connected ? "Connected" : "Disconnected"}</span>
    </div>
  );
}
