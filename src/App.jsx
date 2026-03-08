import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURACIÓN DE SUPABASE ──────────────────────────────────────────────
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
    width: "100%",
    boxSizing: "border-box"
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
  },
  card: {
    background: "#161B22",
    border: "1px solid #30363D",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16
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
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError("Email o contraseña incorrectos");
        return;
      }

      const { data: perfil, error: dbError } = await supabase
        .from("perfiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (dbError || !perfil) {
        setError("Usuario sin perfil en la tabla 'perfiles'");
        return;
      }

      onLogin(authData.user, perfil);
    } catch (err) {
      setError("Fallo de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", padding: 16 }}>
      <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 16, padding: 40, width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: 24, color: "#F3F4F6", letterSpacing: 2 }}>PackTrack</div>
          <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Monitoreo de Entregas</div>
        </div>
        {error && <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #EF4444", borderRadius: 8, padding: "10px 14px", color: "#EF4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required />
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required />
          <button type="submit" style={{ ...S.btnPrimary, padding: "12px", justifyContent: "center" }} disabled={loading}>
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
  const [entregas, setEntregas] = useState([
    { id: 1, cliente: "Juan Pérez", direccion: "Calle 10 #45-20", estado: "En ruta" },
    { id: 2, cliente: "María López", direccion: "Av. Principal 123", estado: "Pendiente" }
  ]);

  const handleLoginSuccess = (userData, perfilData) => {
    setUser(userData);
    setPerfil(perfilData);
  };

  if (!user) return <Login onLogin={handleLoginSuccess} />;

  return (
    <div style={{ background: "#0D1117", minHeight: "100vh", color: "#C9D1D9", fontFamily: "sans-serif" }}>
      {/* HEADER */}
      <header style={{ padding: "16px 24px", background: "#161B22", borderBottom: "1px solid #30363D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, color: "#F3F4F6", display: "flex", alignItems: "center", gap: 8 }}>
          <span>⚡ PackTrack</span>
          <span style={{ fontSize: 12, background: "#238636", padding: "2px 8px", borderRadius: 10 }}>{perfil?.rol}</span>
        </div>
        <button onClick={() => setUser(null)} style={{ background: "transparent", color: "#F85149", border: "1px solid #F85149", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>
          Salir
        </button>
      </header>

      {/* DASHBOARD */}
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: "#F3F4F6", margin: 0 }}>Hola, {perfil?.nombre} 👋</h1>
          <p style={{ color: "#8B949E" }}>Gestiona tus entregas para la zona: <b>{perfil?.zona || "General"}</b></p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {/* COLUMNA IZQUIERDA: LISTA */}
          <div>
            <h3 style={{ marginBottom: 16 }}>📦 Entregas Asignadas</h3>
            {entregas.map(item => (
              <div key={item.id} style={S.card}>
                <div style={{ fontWeight: 600, color: "#58A6FF" }}>{item.cliente}</div>
                <div style={{ fontSize: 13, color: "#8B949E", marginTop: 4 }}>{item.direccion}</div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, background: "#30363D", padding: "3px 8px", borderRadius: 4 }}>{item.estado}</span>
                  <button style={{ background: "#21262D", border: "1px solid #30363D", color: "#C9D1D9", padding: "4px 8px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                    Ver Mapa
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* COLUMNA DERECHA: ESTADÍSTICAS O MAPA SIMULADO */}
          <div style={{ ...S.card, background: "#0d1117", border: "1px dashed #30363D", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
             <div style={{ fontSize: 40, marginBottom: 10 }}>📍</div>
             <div style={{ color: "#8B949E" }}>Selecciona una entrega para ver la ruta optimizada.</div>
             <div style={{ marginTop: 20, width: "100%", height: 150, background: "#161B22", borderRadius: 8, border: "1px solid #30363D" }}>
                {/* Aquí iría el componente de Google Maps o Leaflet */}
                <p style={{ fontSize: 11, marginTop: 60 }}>[ Mapa Simulado ]</p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}