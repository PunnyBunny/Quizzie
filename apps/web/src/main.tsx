import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { LanguageProvider } from "./i18n/LanguageProvider.tsx";
import { DebugProvider } from "./providers/DebugProvider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LanguageProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <DebugProvider>
            <App />
          </DebugProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </LanguageProvider>
  </StrictMode>,
);
