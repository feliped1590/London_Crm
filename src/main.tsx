import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { bootstrapAuth } from "./lib/auth/bootstrap";
import App from "./App.tsx";
import "./index.css";

// CRITICAL: must run BEFORE supabase client is imported anywhere else,
// so we can purge stale tokens from a previous browser session before
// the SDK reads them on initialization.
bootstrapAuth();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
