import { Link, useLocation } from "react-router-dom";
import { Activity, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AppHeader() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <div className="max-w-full px-4">
        <div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Trading Workspace</div>
            <span className="font-semibold tracking-tight text-foreground">Screener</span>
          </div>
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-border/70 bg-card/50 p-1">
          <Link
            to="/"
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/settings"
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/settings" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          {user && (
            <button
              onClick={logout}
              className="ml-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </nav>
      </div>
      </div>
    </header>
  );
}
