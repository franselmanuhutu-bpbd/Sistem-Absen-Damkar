import { createContext, useContext, useEffect, useState } from "react";
import api, { TOKEN_KEY, apiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=checking, false=anon, obj=auth
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiError(e) };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
