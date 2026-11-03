import { useEffect, useMemo, useState } from "react";
import { Activity, Lock, LogOut, RotateCcw, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserSettings } from "@/hooks/useUserSettings";
import { toast } from "sonner";
import { appEnv } from "@/config/env";
import { getAllDefaultIndicatorConfigs } from "@/types/screener";

type HealthPayload = {
  status?: string;
  environment?: string;
  worker?: {
    running?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type WorkerOpsPayload = {
  worker?: {
    running?: boolean;
    poll_interval?: number;
    batch_size?: number;
    started_at?: number | null;
    last_run_at?: number | null;
    last_success_at?: number | null;
    last_error?: string | null;
  };
  worker_enabled_by_config?: boolean;
};

type RuntimeSettingsPayload = {
  app?: {
    name?: string;
    version?: string;
    env?: string;
    debug?: boolean;
    log_level?: string;
  };
  server?: {
    host?: string;
    port?: number;
    cors_allow_origins?: string[];
    cors_allow_credentials?: boolean;
  };
  screening?: {
    screening_max_symbols?: number;
    gate_session_ttl_seconds?: number;
  };
  worker?: {
    enabled_by_config?: boolean;
    configured_poll_interval?: number;
    configured_batch_size?: number;
    effective?: {
      running?: boolean;
      poll_interval?: number;
      batch_size?: number;
      last_success_at?: number | null;
    };
  };
  integrations?: {
    providers?: Record<string, {
      enabled?: boolean;
      api_key_set?: boolean;
      api_key_masked?: string;
      api_key_required?: boolean;
      call_count?: number;
      call_limit?: number | null;
    }>;
    admin_api_token_required?: boolean;
  };
};

type IntegrationProviderState = {
  enabled: boolean;
  api_key: string;
  api_key_set: boolean;
  api_key_masked: string;
  call_count: number;
  call_limit: number | null;
};

type IntegrationsPayload = {
  providers?: Record<string, {
    enabled?: boolean;
    api_key_set?: boolean;
    api_key_masked?: string;
    call_count?: number;
    call_limit?: number | null;
  }>;
};

type DiagnosePayload = {
  status?: string;
  checks?: Array<{
    name?: string;
    status?: string;
    message?: string;
    call_count?: number;
    call_limit?: number | null;
  }>;
};

function toDisplayIndicatorDefaults(
  value: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const next = { ...value };
  if (next.volume && !next.volume_spike) {
    next.volume_spike = next.volume;
  }
  delete next.volume;
  return next;
}

function toInternalIndicatorDefaults(
  value: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const next = { ...value };
  if (next.volume_spike) {
    next.volume = next.volume_spike;
  }
  delete next.volume_spike;
  return next;
}

const SettingsPage = () => {
  const { user, logout, resetPassword } = useAuth();
  const { settings, loading, saveSettings } = useUserSettings();

  const [apiBaseOverride, setApiBaseOverride] = useState(settings.apiBaseOverride ?? "");
  const [adminApiToken, setAdminApiToken] = useState(settings.adminApiToken ?? "");
  const [apiTimeoutMs, setApiTimeoutMs] = useState(settings.apiTimeoutMs ?? 120000);
  const [apiRetries, setApiRetries] = useState(settings.apiRetries ?? 0);
  const [workerPollInterval, setWorkerPollInterval] = useState(settings.workerPollInterval ?? 15);
  const [workerBatchSize, setWorkerBatchSize] = useState(settings.workerBatchSize ?? 50);
  const mergedIndicatorDefaultsForEditor = useMemo(() => {
    const base = getAllDefaultIndicatorConfigs();
    const overrides = toInternalIndicatorDefaults(settings.indicatorDefaults ?? {});
    const merged = { ...base } as Record<string, Record<string, unknown>>;

    for (const [indicatorName, overrideConfig] of Object.entries(overrides)) {
      if (!overrideConfig || typeof overrideConfig !== "object" || Array.isArray(overrideConfig)) {
        continue;
      }
      merged[indicatorName] = {
        ...(merged[indicatorName] ?? {}),
        ...overrideConfig,
      };
    }

    return toDisplayIndicatorDefaults(merged);
  }, [settings.indicatorDefaults]);

  const [indicatorDefaultsText, setIndicatorDefaultsText] = useState(
    JSON.stringify(mergedIndicatorDefaultsForEditor, null, 2),
  );

  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [ready, setReady] = useState<HealthPayload | null>(null);
  const [workerOps, setWorkerOps] = useState<WorkerOpsPayload | null>(null);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettingsPayload | null>(null);
  const [healthError, setHealthError] = useState("");
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [integrationProviders, setIntegrationProviders] = useState<Record<string, IntegrationProviderState>>({});
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosePayload | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    setApiBaseOverride(settings.apiBaseOverride ?? "");
    setAdminApiToken(settings.adminApiToken ?? "");
    setApiTimeoutMs(settings.apiTimeoutMs ?? 120000);
    setApiRetries(settings.apiRetries ?? 0);
    setWorkerPollInterval(settings.workerPollInterval ?? 15);
    setWorkerBatchSize(settings.workerBatchSize ?? 50);
    setIndicatorDefaultsText(JSON.stringify(mergedIndicatorDefaultsForEditor, null, 2));
  }, [loading, settings, mergedIndicatorDefaultsForEditor]);

  const runtimeApiBase = useMemo(() => {
    const selected = apiBaseOverride.trim() || appEnv.apiBase;
    return selected.replace(/\/+$/, "");
  }, [apiBaseOverride]);

  const apiRoot = useMemo(() => runtimeApiBase.replace(/\/screen$/, ""), [runtimeApiBase]);

  const persistRuntimeControls = (next: {
    adminApiToken: string;
    apiBaseOverride: string;
    apiTimeoutMs: number;
    apiRetries: number;
    workerPollInterval: number;
    workerBatchSize: number;
    indicatorDefaults: Record<string, Record<string, unknown>>;
  }) => {
    localStorage.setItem("screener.adminApiToken", next.adminApiToken.trim());
    localStorage.setItem("screener.apiBaseOverride", next.apiBaseOverride.trim());
    localStorage.setItem("screener.apiTimeoutMs", String(next.apiTimeoutMs));
    localStorage.setItem("screener.apiRetries", String(next.apiRetries));
    localStorage.setItem("screener.workerPollInterval", String(next.workerPollInterval));
    localStorage.setItem("screener.workerBatchSize", String(next.workerBatchSize));
    localStorage.setItem("screener.indicatorDefaults", JSON.stringify(next.indicatorDefaults));
  };

  const adminHeaders = () => ({
    "X-Admin-Token": adminApiToken.trim(),
    "Content-Type": "application/json",
  });

  const syncIntegrationProviders = (payload: IntegrationsPayload | null | undefined) => {
    const next: Record<string, IntegrationProviderState> = {};
    const providers = payload?.providers ?? {};

    for (const [name, provider] of Object.entries(providers)) {
      next[name] = {
        enabled: Boolean(provider?.enabled),
        api_key: "",
        api_key_set: Boolean(provider?.api_key_set),
        api_key_masked: provider?.api_key_masked ?? "",
        call_count: Number(provider?.call_count ?? 0),
        call_limit: provider?.call_limit ?? null,
      };
    }

    setIntegrationProviders(next);
  };

  const callWorkerOps = async (
    path: string,
    options?: RequestInit,
  ): Promise<WorkerOpsPayload> => {
    const res = await fetch(`${runtimeApiBase}/ops/worker${path}`, {
      method: "POST",
      ...options,
      headers: {
        ...adminHeaders(),
        ...(options?.headers ?? {}),
      },
    });

    const payload = (await res.json()) as WorkerOpsPayload & { detail?: string };
    if (!res.ok) {
      throw new Error(payload.detail || "Worker operation failed");
    }
    return payload;
  };

  const refreshHealth = async () => {
    setRefreshingHealth(true);
    setHealthError("");

    try {
      const [healthRes, readyRes] = await Promise.all([
        fetch(`${apiRoot}/healthz`),
        fetch(`${apiRoot}/readyz`),
      ]);

      const healthJson = (await healthRes.json()) as HealthPayload;
      const readyJson = (await readyRes.json()) as HealthPayload;

      setHealth(healthJson);
      setReady(readyJson);
      try {
        const workerRes = await fetch(`${runtimeApiBase}/ops/worker`, {
          method: "GET",
          headers: adminHeaders(),
        });
        if (workerRes.ok) {
          setWorkerOps((await workerRes.json()) as WorkerOpsPayload);
        }
      } catch {
        // worker ops are optional in health refresh
      }
      try {
        const runtimeRes = await fetch(`${runtimeApiBase}/ops/runtime-settings`, {
          method: "GET",
          headers: adminHeaders(),
        });
        if (runtimeRes.ok) {
          const runtimePayload = (await runtimeRes.json()) as RuntimeSettingsPayload;
          setRuntimeSettings(runtimePayload);
          syncIntegrationProviders(runtimePayload.integrations);
        }
      } catch {
        // runtime settings are optional in health refresh
      }
      try {
        const integrationsRes = await fetch(`${runtimeApiBase}/ops/integrations`, {
          method: "GET",
          headers: adminHeaders(),
        });
        if (integrationsRes.ok) {
          syncIntegrationProviders((await integrationsRes.json()) as IntegrationsPayload);
        }
      } catch {
        // integration controls are optional in health refresh
      }

      if (!healthRes.ok || !readyRes.ok) {
        setHealthError("Health endpoint returned a degraded response.");
      }
    } catch (error) {
      setHealth(null);
      setReady(null);
      setHealthError(error instanceof Error ? error.message : "Health check failed");
    } finally {
      setRefreshingHealth(false);
    }
  };

  const handleSaveControls = async () => {
    let parsedDefaults: Record<string, Record<string, unknown>> = {};

    try {
      parsedDefaults = JSON.parse(indicatorDefaultsText || "{}");
      if (parsedDefaults === null || typeof parsedDefaults !== "object" || Array.isArray(parsedDefaults)) {
        throw new Error("Indicator defaults must be a JSON object");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid indicator defaults JSON");
      return;
    }

    const sanitizedTimeout = Math.max(1000, Number(apiTimeoutMs) || 120000);
    const sanitizedRetries = Math.max(0, Number(apiRetries) || 0);
    const sanitizedPoll = Math.max(1, Number(workerPollInterval) || 15);
    const sanitizedBatch = Math.max(1, Number(workerBatchSize) || 50);

    const payload = {
      adminApiToken: adminApiToken.trim(),
      apiBaseOverride: apiBaseOverride.trim(),
      apiTimeoutMs: sanitizedTimeout,
      apiRetries: sanitizedRetries,
      workerPollInterval: sanitizedPoll,
      workerBatchSize: sanitizedBatch,
      indicatorDefaults: toInternalIndicatorDefaults(parsedDefaults),
    };

    await saveSettings(payload);
    persistRuntimeControls(payload);
    toast.success("Control settings applied");
  };

  const applyWorkerConfig = async () => {
    setWorkerBusy(true);
    try {
      const payload = await callWorkerOps("/config", {
        body: JSON.stringify({
          poll_interval: Math.max(1, Number(workerPollInterval) || 15),
          batch_size: Math.max(1, Number(workerBatchSize) || 50),
        }),
      });
      setWorkerOps(payload);
      toast.success("Worker config updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update worker");
    } finally {
      setWorkerBusy(false);
    }
  };

  const startWorker = async () => {
    setWorkerBusy(true);
    try {
      const payload = await callWorkerOps("/start");
      setWorkerOps(payload);
      toast.success("Worker started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start worker");
    } finally {
      setWorkerBusy(false);
    }
  };

  const stopWorker = async () => {
    setWorkerBusy(true);
    try {
      const payload = await callWorkerOps("/stop");
      setWorkerOps(payload);
      toast.success("Worker stopped");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to stop worker");
    } finally {
      setWorkerBusy(false);
    }
  };

  const refreshWorker = async () => {
    setWorkerBusy(true);
    try {
      const payload = await callWorkerOps("/refresh");
      setWorkerOps(payload);
      toast.success("Worker refresh completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh worker");
    } finally {
      setWorkerBusy(false);
    }
  };

  const updateIntegrationProvider = (
    name: string,
    patch: Partial<IntegrationProviderState>,
  ) => {
    setIntegrationProviders((current) => ({
      ...current,
      [name]: {
        ...(current[name] ?? {
          enabled: true,
          api_key: "",
          api_key_set: false,
          api_key_masked: "",
          call_count: 0,
          call_limit: null,
        }),
        ...patch,
      },
    }));
  };

  const applyIntegrationConfig = async () => {
    setIntegrationBusy(true);
    try {
      const providersPayload = Object.fromEntries(
        Object.entries(integrationProviders).map(([name, provider]) => (
          [
            name,
            {
              enabled: provider.enabled,
              api_key: provider.api_key.trim() || undefined,
              call_limit: provider.call_limit && provider.call_limit > 0 ? provider.call_limit : null,
            },
          ]
        )),
      );

      const response = await fetch(`${runtimeApiBase}/ops/integrations/config`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ providers: providersPayload }),
      });
      const payload = (await response.json()) as IntegrationsPayload & { detail?: string };
      if (!response.ok) {
        throw new Error(payload.detail || "Failed to update integration settings");
      }

      syncIntegrationProviders(payload);
      toast.success("Integration settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update integration settings");
    } finally {
      setIntegrationBusy(false);
    }
  };

  const runDiagnostics = async () => {
    setDiagnoseBusy(true);
    try {
      const response = await fetch(`${runtimeApiBase}/ops/diagnose`, {
        method: "POST",
        headers: adminHeaders(),
      });
      const payload = (await response.json()) as DiagnosePayload & { detail?: string };
      if (!response.ok) {
        throw new Error(payload.detail || "Diagnostic request failed");
      }
      setDiagnostics(payload);
      toast.success(payload.status === "ok" ? "Diagnostics passed" : "Diagnostics found warnings");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run diagnostics");
    } finally {
      setDiagnoseBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;

    try {
      await resetPassword(user.email);
      toast.success("Password reset email sent");
    } catch {
      toast.error("Failed to send reset email");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      toast.error("Failed to logout");
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground animate-pulse">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Control Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        Use this page to monitor backend health, tune API behavior, and control market-data worker performance.
        Changes here help balance speed, stability, and resource usage.
      </p>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Site Health</h2>
          </div>
          <button
            onClick={refreshHealth}
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary/60"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${refreshingHealth ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Health source: {apiRoot}</p>
        <p className="text-xs text-muted-foreground">
          Tip: `Health` confirms basic service availability. `Readiness` confirms the app can process screening requests.
        </p>
        {healthError && <p className="text-xs text-destructive">{healthError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="rounded border border-border/70 p-3 text-xs">
            <div className="text-muted-foreground">Health</div>
            <div className="font-mono mt-1">{health?.status ?? "unknown"}</div>
            <div className="mt-1 text-muted-foreground">Env: {health?.environment ?? "n/a"}</div>
          </div>
          <div className="rounded border border-border/70 p-3 text-xs">
            <div className="text-muted-foreground">Readiness</div>
            <div className="font-mono mt-1">{ready?.status ?? "unknown"}</div>
            <div className="mt-1 text-muted-foreground">
              Worker: {ready?.worker?.running ? "running" : "stopped/degraded"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Server Runtime Settings</h2>
        <p className="text-xs text-muted-foreground">
          This is the live server-side effective configuration. Use it to verify what the backend is actually using.
        </p>
        <div className="rounded border border-border/70 p-3 text-xs font-mono whitespace-pre-wrap break-words">
          {runtimeSettings
            ? JSON.stringify(runtimeSettings, null, 2)
            : "No server runtime payload yet. Press Refresh in Site Health."}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">API Control</h2>
        <p className="text-xs text-muted-foreground">
          These values control how the frontend talks to your backend.
        </p>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Admin API Token</label>
          <input
            value={adminApiToken}
            onChange={(e) => setAdminApiToken(e.target.value)}
            placeholder="X-Admin-Token"
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Required only if backend `ADMIN_API_TOKEN` is configured. Sent as `X-Admin-Token` for protected ops.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">API Base Override</label>
          <input
            value={apiBaseOverride}
            onChange={(e) => setApiBaseOverride(e.target.value)}
            placeholder={appEnv.apiBase}
            className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Point the UI to another backend environment without changing `.env`.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Request Timeout (ms)</label>
            <input
              type="number"
              min={1000}
              step={500}
              value={apiTimeoutMs}
              onChange={(e) => setApiTimeoutMs(Number(e.target.value) || 120000)}
              className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Higher timeout helps slow networks; lower timeout fails fast.
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Retries</label>
            <input
              type="number"
              min={0}
              max={5}
              value={apiRetries}
              onChange={(e) => setApiRetries(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Retries transient network failures. Keep low to avoid duplicate load.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Integration Controls</h2>
        <p className="text-xs text-muted-foreground">
          Enable/disable each provider, set runtime API keys, and monitor call usage against limits.
        </p>
        <div className="space-y-3">
          {Object.entries(integrationProviders).length === 0 && (
            <div className="rounded border border-border/70 p-3 text-xs text-muted-foreground">
              No integration payload yet. Refresh Site Health.
            </div>
          )}
          {Object.entries(integrationProviders).map(([name, provider]) => (
            <div key={name} className="rounded border border-border/70 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground">{name}</div>
                <button
                  onClick={() => updateIntegrationProvider(name, { enabled: !provider.enabled })}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    provider.enabled
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {provider.enabled ? "Enabled" : "Disabled"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">API Key</label>
                  <input
                    value={provider.api_key}
                    onChange={(event) => updateIntegrationProvider(name, { api_key: event.target.value })}
                    placeholder={provider.api_key_masked || (provider.api_key_set ? "Configured" : "Not set")}
                    className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Call Limit (optional)</label>
                  <input
                    type="number"
                    min={0}
                    value={provider.call_limit ?? ""}
                    onChange={(event) => updateIntegrationProvider(name, {
                      call_limit: event.target.value ? Math.max(0, Number(event.target.value) || 0) : null,
                    })}
                    className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs"
                    placeholder="No limit"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Calls used: {provider.call_count}
                {provider.call_limit ? ` / ${provider.call_limit}` : ""}
              </p>
            </div>
          ))}
        </div>
        <button
          onClick={applyIntegrationConfig}
          disabled={integrationBusy}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary/60 disabled:opacity-50"
        >
          Apply Integration Settings
        </button>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Diagnostics</h2>
        <p className="text-xs text-muted-foreground">
          Runs backend checks and lists warnings like disabled providers, missing keys, or worker issues.
        </p>
        <button
          onClick={runDiagnostics}
          disabled={diagnoseBusy}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary/60 disabled:opacity-50"
        >
          Run Site Diagnostics
        </button>
        <div className="rounded border border-border/70 p-3 text-xs font-mono whitespace-pre-wrap break-words">
          {diagnostics
            ? JSON.stringify(diagnostics, null, 2)
            : "No diagnostics run yet."}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <button
          onClick={handleSaveControls}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Save className="h-4 w-4" />
          Save Control Settings
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          This saves to your profile and applies runtime controls in the current browser session.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Reset Password</h2>
        </div>
        <p className="text-xs text-muted-foreground">{user?.email}</p>
        <button
          onClick={handleResetPassword}
          className="px-4 py-2 rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          Send Reset Link
        </button>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </section>
    </div>
  );
};

export default SettingsPage;
