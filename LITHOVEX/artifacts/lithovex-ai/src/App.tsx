// ─────────────────────────────────────────────────────────────────────────────
// LITHOVEX AI — App Root
// Phase 2: Updated to include mode-aware PlaygroundLayout wrapper.
// All existing providers and routes are preserved — nothing removed.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlaygroundProvider } from "@/context/PlaygroundContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PlaygroundLayout } from "@/components/PlaygroundLayout";
import LandingPage from "@/pages/LandingPage";
import AdminDashboard from "@/pages/AdminDashboard";
import Home from "@/pages/Home";
import PlaygroundPage from "@/pages/PlaygroundPage";
import AgentCoWork from "@/pages/AgentCoWork";
import GitHubCoderPage from "@/pages/GitHubCoderPage";
import LinuxSystemPage from "@/pages/LinuxSystemPage";
import NotFound from "@/pages/not-found";
import { useGlobalClickSound } from "@/lib/clickSound";

const queryClient = new QueryClient();

// ─── Route definitions ────────────────────────────────────────────────────────

function Router() {
  return (
    <Switch>
      {/* Landing page — full cinematic homepage */}
      <Route path="/" component={LandingPage} />
      {/* Chat — the main AI workspace (previously at "/") */}
      <Route path="/chat" component={Home} />
      {/* Admin Dashboard */}
      <Route path="/profile" component={AdminDashboard} />
      {/*
       * Playground route — renders inside the PlaygroundLayout grid shell.
       * PlaygroundPage is the Phase 3 placeholder until the full UI is built.
       */}
      <Route path="/playground" component={PlaygroundPage} />
      <Route path="/agent-cowork">{() => <AgentCoWork />}</Route>
      {/* Legacy alias — keep old /battle URL working */}
      <Route path="/battle">{() => <AgentCoWork />}</Route>
      <Route path="/lithovex-coder">{() => <GitHubCoderPage />}</Route>
      <Route path="/linux-system">{() => <LinuxSystemPage />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// ─── Mode-aware layout shell ──────────────────────────────────────────────────

/**
 * LayoutShell wraps all routes with the PlaygroundLayout.
 * In legacy mode (path "/"), PlaygroundLayout acts as a transparent pass-through.
 * In playground mode (path "/playground" and beyond), it renders the full
 * grid shell: TopNav + collapsible sidebar + main content area.
 *
 * Settings panel open state is lifted here so TopNav's settings button
 * can also open the legacy SettingsPanel when in legacy mode (Home.tsx
 * manages its own settings state). For playground mode, onOpenSettings
 * is wired to a local state that will drive the future PlaygroundSettings panel.
 */
function LayoutShell() {
  const [pgSettingsOpen, setPgSettingsOpen] = useState(false);

  return (
    <PlaygroundLayout onOpenSettings={() => setPgSettingsOpen((o) => !o)}>
      {/* pgSettingsOpen available here for the future PlaygroundSettings panel */}
      <Router />
    </PlaygroundLayout>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useGlobalClickSound();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PlaygroundProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <LayoutShell />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </PlaygroundProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
