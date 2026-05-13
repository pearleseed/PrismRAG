import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useThemeStore } from "@/stores/useThemeStore";
import { AppShell } from "@/components/layout/AppShell";

const KnowledgeBasesPage = lazy(() =>
  import("@/pages/KnowledgeBasesPage").then((m) => ({ default: m.KnowledgeBasesPage })),
);
const WorkspacePage = lazy(() =>
  import("@/pages/WorkspacePage").then((m) => ({ default: m.WorkspacePage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="/"
          element={
            <Suspense fallback={<RouteFallback />}>
              <KnowledgeBasesPage />
            </Suspense>
          }
        />
        <Route
          path="/knowledge-bases/:workspaceId"
          element={
            <Suspense fallback={<RouteFallback />}>
              <WorkspacePage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

function App() {
  const theme = useThemeStore((s) => s.theme);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
      <Toaster
        theme={theme}
        position="bottom-right"
        richColors
        toastOptions={{
          duration: 4000,
          className: "text-sm",
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
