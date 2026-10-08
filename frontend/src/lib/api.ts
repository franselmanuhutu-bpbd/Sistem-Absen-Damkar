import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

export const API_BASE = "/api";
export const TOKEN_KEY = "damkar_token";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 30000, // Batas waktu 30 detik untuk jaringan lambat
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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
): Promise<void> {
  const response = await api.get(url, {
    params,
    responseType: "blob",
  });

  const blob = new Blob([response.data]);
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(link.href);
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
