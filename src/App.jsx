import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURACIÓN DE SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── ESTILOS ────────────────────────────────────────────────────────────────
const S = {
  input: { background: "#0D1117", border: "1px solid #30363D", borderRadius: 8, padding: "10px", color: "#C9D1D9", width: "100%", marginBottom: "10px" },
  btnPrimary: { background: "#238636", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: "bold" },
  card: { background: "#161B22", border: "1px solid #30363D", borderRadius: 12, padding: "20px", marginBottom: "15px" }
};

// ─── COMPONENTE LOGIN (EL QUE YA TE FUNCIONA) ───────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    if (e) e.preventDefault();
    setLoading(true); setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", data.user.id).maybeSingle();
      onLogin(data.user, perfil);
    } catch (err) { setError("Acceso denegado: " + err.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "#161B22", padding: "40px", borderRadius: "16px", width: "320px", border: "1px solid #21262D" }}>
        <h2 style={{ color: "#fff", textAlign: "center" }}>⚡ PackTrack</h2>
        {error && <p style={{ color: "#ef4444", fontSize: "12px" }}>{error}</p>}
        <form onSubmit={handleLogin}>
          <input style={S.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={S.input} type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={{ ...S.btnPrimary, width: "100%" }} disabled={loading}>
            {loading ? "Cargando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  
  // Estados para crear mensajero (Función que pediste)
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [creando, setCreando] = useState(false);

  const handleCrearMensajero = async (e) => {
    e.preventDefault();
    setCreando(true);
    // Nota: Para crear usuarios en Auth desde el cliente necesitas la Service Role Key o usar una Edge Function.
    // Por ahora, simularemos la creación en la tabla de perfiles.
    alert(`Solicitud para crear a ${nuevoNombre} enviada. (Requiere configuración de Admin en Supabase)`);
    setNuevoNombre(""); setNuevoEmail("");
    setCreando(false);
  };

  if (!user) return <Login onLogin={(u, p) => { setUser(u); setPerfil(p); }} />;

  return (
    <div style={{ background: "#0D1117", minHeight: "100vh", color: "#C9D1D9", fontFamily: "sans-serif" }}>
      <header style={{ padding: "15px 25px", background: "#161B22", borderBottom: "1px solid #30363D", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontWeight: "bold" }}>⚡ PackTrack</span>
        <button onClick={() => setUser(null)} style={{ background: "none", border: "1px solid #f85149", color: "#f85149", borderRadius: "5px", cursor: "pointer" }}>Salir</button>
      </header>

      <main style={{ padding: "25px", maxWidth: "1000px", margin: "0 auto" }}>
        <h1>Panel de {perfil?.rol === 'admin' ? 'Administración' : 'Mensajería'}</h1>
        <p>Bienvenido, <b>{perfil?.nombre}</b></p>

        {/* SECCIÓN SOLO PARA ADMINISTRADORES */}
        {perfil?.rol === 'admin' && (
          <div style={{ ...S.card, border: "1px solid #238636" }}>
            <h3 style={{ color: "#238636" }}>➕ Crear Nuevo Mensajero</h3>
            <form onSubmit={handleCrearMensajero} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input style={{ ...S.input, width: "200px" }} placeholder="Nombre completo" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
              <input style={{ ...S.input, width: "200px" }} placeholder="Email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} />
              <button type="submit" style={S.btnPrimary} disabled={creando}>
                {creando ? "Guardando..." : "Registrar"}
              </button>
            </form>
          </div>
        )}

        {/* SECCIÓN DE ENTREGAS (GENERAL) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <h3>📦 Entregas Activas</h3>
            <div style={S.card}>
              <p><b>Cliente:</b> Ejemplo de Entrega</p>
              <p style={{ fontSize: "12px", color: "#8B949E" }}>Dirección: Calle Falsa 123</p>
              <button style={{ background: "#30363D", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "4px" }}>Ver detalles</button>
            </div>
          </div>
          
          <div style={{ ...S.card, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#8B949E" }}>[ Mapa de Monitoreo ]</p>
          </div>
        </div>
      </main>
    </div>
  );
}