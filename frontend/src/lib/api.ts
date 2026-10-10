import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from "axios";
import { saveFileForRuntime } from "./file-save";

export const DEFAULT_DEV_API_URL = "http://localhost:8000/api";
export const DEFAULT_VERCEL_API_URL = "https://sistem-absen-damkar.vercel.app/api";

export function isTauriEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === "tauri:" ||
    window.location.protocol === "asset:" ||
    window.location.hostname === "tauri.localhost"
  );
}

export function isDevEnvironment(): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const protocol = window.location.protocol;

    // Production Tauri app uses custom protocol or tauri.localhost without dev port
    if (host === "tauri.localhost" || protocol === "tauri:" || protocol === "asset:") {
      return false;
    }

    // Production Vercel web deployment
    if (host.includes("vercel.app") || host === "sistem-absen-damkar.vercel.app") {
      return false;
    }

    // Local development (browser or Tauri devUrl http://localhost:3000)
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return true;
    }
  }

  // Fallback to process.env.NODE_ENV
  try {
    if (typeof process !== "undefined" && process?.env?.NODE_ENV) {
      return process.env.NODE_ENV !== "production";
    }
  } catch {
    // Process is not defined in standard browser context
  }

  return false;
}

export function getApiBase(): string {
  // 1. Explicit override saved in localStorage (useful for manual testing / toggle in console)
  if (typeof window !== "undefined") {
    const override = localStorage.getItem("damkar_api_url");
    if (override && override.trim()) {
      return override.trim();
    }
  }

  // 2. Build-time or runtime environment variable (browser-safe check)
  let envUrl: string | undefined;
  try {
    if (typeof process !== "undefined" && process?.env?.API_BASE_URL) {
      envUrl = process.env.API_BASE_URL;
    }
  } catch {
    // Process is not defined in standard browser context
  }
  if (envUrl && envUrl.trim()) {
    // Guard: ignore localhost env variable in production builds
    if (!isDevEnvironment() && (envUrl.includes("localhost") || envUrl.includes("127.0.0.1"))) {
      // fallback to production Vercel
    } else {
      return envUrl.trim();
    }
  }

  // 3. Development environment (both "bun run dev" in browser and "tauri dev" in desktop)
  // Connects to local FastAPI backend on port 8000
  if (isDevEnvironment()) {
    return DEFAULT_DEV_API_URL;
  }

  // 4. Production Tauri desktop app (built / signed installer)
  // Inside packaged desktop app, relative "/api" fails, so use production Vercel API
  if (isTauriEnvironment()) {
    return DEFAULT_VERCEL_API_URL;
  }

  // 5. Standard Web Browser (Vercel web deployment)
  return "/api";
}

export const API_BASE = getApiBase();
export const TOKEN_KEY = "damkar_token";

// Log active API target in dev mode for easy developer verification
if (typeof window !== "undefined" && isDevEnvironment()) {
  console.info(
    `%c[Damkar API]%c Dev Mode -> Terhubung ke: ${API_BASE} (${isTauriEnvironment() ? "Tauri Desktop Dev" : "Web Dev"})`,
    "color: #ef4444; font-weight: bold;",
    "color: #0284c7;"
  );
}

async function tauriAxiosAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");

  let fullUrl: string;
  try {
    fullUrl = axios.getUri(config);
  } catch {
    const base = config.baseURL || getApiBase();
    const path = config.url || "";
    fullUrl = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  }

  // Format headers
  const headers: Record<string, string> = {};
  if (config.headers) {
    for (const [key, val] of Object.entries(config.headers)) {
      if (val !== undefined && val !== null && typeof val !== "function") {
        headers[key] = String(val);
      }
    }
  }

  // Format body
  let body: any = undefined;
  if (config.data !== undefined && config.data !== null) {
    if (typeof config.data === "string" || config.data instanceof FormData || config.data instanceof Blob) {
      body = config.data;
    } else {
      body = JSON.stringify(config.data);
      if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
      }
    }
  }

  const response = await tauriFetch(fullUrl, {
    method: (config.method || "GET").toUpperCase(),
    headers,
    body,
  });

  const responseType = config.responseType || "json";
  let data: any;
  if (responseType === "blob") {
    data = await response.blob();
  } else if (responseType === "arraybuffer") {
    data = await response.arrayBuffer();
  } else if (responseType === "text") {
    data = await response.text();
  } else {
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  const resHeaders: Record<string, string> = {};
  response.headers.forEach((val, key) => {
    resHeaders[key] = val;
  });

  const axiosResponse: AxiosResponse = {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders as any,
    config,
    request: {},
  };

  if (response.status >= 200 && response.status < 300) {
    return axiosResponse;
  }

  const error: any = new Error(`Request failed with status code ${response.status}`);
  error.response = axiosResponse;
  error.config = config;
  error.isAxiosError = true;
  throw error;
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // Batas waktu 30 detik untuk jaringan lambat
  headers: {
    "Content-Type": "application/json",
  },
  adapter: isTauriEnvironment() ? tauriAxiosAdapter : undefined,
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamically ensure the correct baseURL is applied (supports dev mode and localStorage overrides)
    const activeBase = getApiBase();
    if (!config.baseURL || config.baseURL === "/api" || isTauriEnvironment() || isDevEnvironment()) {
      config.baseURL = activeBase;
    }

    // Force native Tauri adapter inside desktop app to bypass any CORS restrictions
    if (isTauriEnvironment()) {
      config.adapter = tauriAxiosAdapter;
    }

    const token = localStorage.getItem(TOKEN_KEY);

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes("/login")
    ) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export async function downloadFile(
  url: string,
  params: Record<string, any> | undefined,
  filename: string
): Promise<boolean> {
  const response = await api.get(url, {
    params,
    responseType: "blob",
  });

  return saveFileForRuntime(new Blob([response.data]), filename);
}

export function apiError(error: any): string {
  // Tangani kegagalan jaringan atau timeout
  if (error?.message === "Network Error" || error?.code === "ERR_NETWORK") {
    return "Koneksi jaringan terputus atau lambat. Silakan periksa koneksi internet Anda.";
  }
  if (error?.code === "ECONNABORTED" || error?.message?.includes("timeout")) {
    return "Permintaan melebihi batas waktu (timeout). Silakan coba beberapa saat lagi.";
  }

  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => item.msg || JSON.stringify(item))
      .join(" ");
  }

  if (error?.response?.status === 405) {
    return "Method API tidak diizinkan. Periksa konfigurasi server.";
  }

  if (error?.response?.status === 404) {
    return "Endpoint API tidak ditemukan.";
  }

  if (error?.response?.status >= 500) {
    return "Server sedang mengalami masalah.";
  }

  return error?.message || "Terjadi kesalahan";
}

export default api;
