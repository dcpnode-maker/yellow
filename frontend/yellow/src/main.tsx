import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthenticationGate } from "./AuthenticationGate";
import "./styles.css";
import "./ui/reference-theme.css";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false } } });
const AuthenticatedApp = lazy(() => import("./App").then(module => ({ default: module.App })));
createRoot(document.getElementById("root")!).render(<StrictMode><QueryClientProvider client={client}><AuthenticationGate><Suspense fallback={<p role="status">Opening Yellow…</p>}><AuthenticatedApp /></Suspense></AuthenticationGate></QueryClientProvider></StrictMode>);
