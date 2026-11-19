import { AuthProvider, RequireRole } from "@geohive/auth";
import { Cargando, ErrorAutenticacion, SinAcceso } from "@geohive/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "leaflet/dist/leaflet.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { APP_ID, AUTH_CONFIG } from "./config";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider config={AUTH_CONFIG} loading={<Cargando />} error={<ErrorAutenticacion />}>
      <RequireRole role={APP_ID} fallback={<SinAcceso appId={APP_ID} />}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </RequireRole>
    </AuthProvider>
  </StrictMode>,
);
