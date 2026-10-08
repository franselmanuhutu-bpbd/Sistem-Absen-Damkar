import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// Polyfill process in browser environment to prevent ReferenceError: process is not defined
if (typeof window !== "undefined") {
  (window as any).process = (window as any).process || { env: {} };
}

// Tangani unhandled rejection jaringan secara global agar dev popup Bun tidak memblokir layar pengguna
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const isNetwork =
      reason?.isAxiosError ||
      reason?.name === "AxiosError" ||
      reason?.code === "ERR_NETWORK" ||
      reason?.message?.includes("Network Error") ||
      reason?.message?.includes("Failed to fetch");

    if (isNetwork) {
      // Mencegah overlay modal pengembang Bun muncul di layar browser
      event.preventDefault();
      console.warn("[Jaringan Lambat / Terputus]:", reason?.message || "Network Error");
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element '#root' not found");
}

const root = import.meta.hot
  ? (import.meta.hot.data.root ??= createRoot(container))
  : createRoot(container);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
