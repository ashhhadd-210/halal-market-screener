import { ResultsTable } from "@/components/screener/ResultsTable";
import { PresetBar } from "@/components/screener/PresetBar";
import { RunControls } from "@/components/screener/RunControls";
import { ConnectionStatus } from "@/components/screener/ConnectionStatus";
import { FilterSidebar } from "@/components/screener/FilterSidebar";
import { useScreener } from "@/hooks/useScreener";
import { useUserSettings } from "@/hooks/useUserSettings";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { appEnv } from "@/config/env";

const API_BASE = appEnv.apiBase.replace(/\/screen$/, "");

const Index = () => {
  const state = useScreener();
  const { settings, loading: settingsLoading, savePreset, deletePreset } = useUserSettings();

  const handleSavePreset = async () => {
    const name = prompt("Preset name:");
    if (!name?.trim()) return;
    await savePreset(name.trim(), state.getSnapshot());
  };

  const handleLoadPreset = (id: string) => {
    const preset = settings.presets.find((p) => p.id === id);
    if (preset) {
      state.loadSnapshot(preset.filters);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-4rem)] w-full">
        <FilterSidebar state={state} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border/70 bg-card/25 px-4 py-3 backdrop-blur-xl md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="h-10 w-10 rounded-2xl border border-border/70 bg-card/55" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted-foreground">
                    Market Screener
                  </p>
                  <h1 className="text-xl font-semibold text-foreground">Results workspace</h1>
                </div>
                <ConnectionStatus apiBase={API_BASE} />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <PresetBar
                  presets={settings.presets}
                  loading={settingsLoading}
                  onSave={handleSavePreset}
                  onLoad={handleLoadPreset}
                  onDelete={deletePreset}
                />
                <RunControls state={state} />
              </div>
            </div>
          </div>

          <main className="flex-1 p-4 md:p-5">
            <div className="glass-panel flex h-full w-full flex-col gap-4 rounded-[32px] border border-border/70 p-4 md:p-5">
              {(state.statusMessage || state.errorMessage) && (
                <div className="flex flex-wrap gap-3">
                  {state.statusMessage && (
                    <p className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-mono text-primary">
                      {state.statusMessage}
                    </p>
                  )}
                  {state.errorMessage && (
                    <p className="rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-mono text-destructive">
                      {state.errorMessage}
                    </p>
                  )}
                </div>
              )}

              <ResultsTable
                results={state.results}
                loading={state.loading}
                onRequestDetail={state.fetchResultDetail}
                activeSignalNames={[
                  ...state.indicators.map((indicator) => indicator.name),
                  ...(state.channelRespect ? ["channel_respect"] : []),
                  ...(state.confluence ? ["confluence"] : []),
                ]}
              />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
