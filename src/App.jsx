import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURACIÓN DE SUPABASE ──────────────────────────────────────────────
// Usamos import.meta.env para seguridad en Vite y Vercel
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── ESTILOS REUTILIZABLES ──────────────────────────────────────────────────
const S = {
  input: {
    background: "#0D1117",
    border: "1px solid #30363D",
    borderRadius: 8,
    padding: "10px 12px",
    color: "#C9D1D9",
    fontSize: 14,
    outline: "none",
  },
  btnPrimary: {
    background: "#238636",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "background 0.2s",
  }
};

// ─── COMPONENTE DE LOGIN ─────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    if (e) e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // 1. Autenticación
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (authError) {
        setError("Email o contraseña incorrectos");
        setLoading(false);
        return;
      }

      // 2. Obtener Perfil (Usamos una consulta que no se bloquee)
      const { data: perfil, error: dbError } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (dbError) {
        console.error("Error DB:", dbError);
        setError("Error al conectar con la base de datos");
        setLoading(false);
        return;
      }

      if (!perfil) {
        setError("Usuario sin perfil en la tabla 'perfiles'");
        setLoading(false);
        return;
      }

      // 3. Éxito
      onLogin(authData.user, perfil);

    } catch (err) {
      console.error("Error crítico:", err);
      setError("Fallo de conexión");
    } finally {
      // ESTO ASEGURA QUE EL BOTÓN SE DESBLOQUEE SIEMPRE
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 16 }}>
      <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 16, padding: 40, width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: 24, color: "#F3F4F6", letterSpacing: 2 }}>PackTrack</div>
          <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Sistema de monitoreo</div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #EF4444", borderRadius: 8, padding: "10px 14px", color: "#EF4444", fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#9CA3AF" }}>
            Email
            <input 
              style={S.input} 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="usuario@empresa.com" 
              required
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#9CA3AF" }}>
            Contraseña
            <input 
              style={S.input} 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required
            />
          </label>

          <button 
            type="submit"
            style={{ ...S.btnPrimary, width: "100%", justifyContent: "center", padding: "12px", fontSize: 15, marginTop: 10 }} 
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL (APP) ──────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);

  const handleLoginSuccess = (userData, perfilData) => {
    setUser(userData);
    setPerfil(perfilData);
  };

  if (!user) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  return (
    <div style={{ padding: 20, color: "white", background: "#0D1117", minHeight: "100vh" }}>
      <h1>Bienvenido, {perfil?.nombre || "Usuario"}</h1>
      <p>Has ingresado correctamente a PackTrack.</p>
      <button onClick={() => setUser(null)} style={{ padding: "10px 20px", cursor: "pointer" }}>
        Cerrar Sesión
      </button>
    </div>
  );
}