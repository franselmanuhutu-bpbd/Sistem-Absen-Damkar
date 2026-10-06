import axios from "axios";

export const API_BASE = "/api";
export const TOKEN_KEY = "damkar_token";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (token) {
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

export async function downloadFile(url, params, filename) {
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

export function apiError(error) {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || JSON.stringify(item))
      .join(" ");
  }

  if (error.response?.status === 405) {
    return "Method API tidak diizinkan. Periksa konfigurasi server.";
  }

  if (error.response?.status === 404) {
    return "Endpoint API tidak ditemukan.";
  }

  if (error.response?.status >= 500) {
    return "Server sedang mengalami masalah.";
  }

  return error.message || "Terjadi kesalahan";
}

export default api;
