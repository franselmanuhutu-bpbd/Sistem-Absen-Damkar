import axios from "axios";

export const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const TOKEN_KEY = "damkar_token";

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes("/login")) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export async function downloadFile(url, params, filename) {
  const res = await api.get(url, { params, responseType: "blob" });
  const blob = new Blob([res.data]);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export function apiError(e) {
  const d = e.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join(" ");
  return e.message || "Terjadi kesalahan";
}

export default api;
