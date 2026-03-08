import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURACIÓN DE SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const S = {
  input: { background: "#0D1117", border: "1px solid #30363D", borderRadius: 8, padding: "10px", color: "#C9D1D9", width: "100%", marginBottom: "10px", boxSizing: "border-box" },
  btnPrimary: { background: "#238636", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: "bold" },
  card: { background: "#161B22", border: "1px solid #30363D", borderRadius: 12, padding: "20px", marginBottom: "15px" },
  table: { width: "100%", borderCollapse: "collapse", marginTop: "10px", color: "#C9D1D9" }
};

// ─── COMPONENTE LOGIN ───────────────────────────────────────────────────────
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
    } catch (err) { setError("Error: " + err.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "#161B22", padding: "40px", borderRadius: "16px", width: "100%", maxWidth: "350px", border: "1px solid #21262D", textAlign: "center" }}>
        <h1 style={{ color: "#fff", margin: "0 0 30px 0" }}>⚡ PackTrack</h1>
        {error && <div style={{ color: "#ef4444", marginBottom: "15px", fontSize: "13px" }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <input style={S.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={S.input} type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={{ ...S.btnPrimary, width: "100%" }} disabled={loading}>{loading ? "Verificando..." : "Entrar"}</button>
        </form>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [tabActual, setTabActual] = useState("entregas");
  const [mensajeros, setMensajeros] = useState([]);
  
  // Estados para nuevo mensajero
  const [mNombre, setMNombre] = useState("");
  const [mCelular, setMCelular] = useState("");
  const [mEmail, setMEmail] = useState("");

  // Cargar mensajeros cuando se entra a la pestaña de gestión
  useEffect(() => {
    if (user && tabActual === "admin") {
      obtenerMensajeros();
    }
  }, [user, tabActual]);

  async function obtenerMensajeros() {
    const { data, error } = await supabase.from("perfiles").select("*").eq("rol", "mensajero");
    if (!error) setMensajeros(data);
  }

  async function registrarMensajero(e) {
    e.preventDefault();
    // Nota: Aquí registramos en la tabla perfiles. 
    // Para que el mensajero pueda entrar, primero debes crearlo en Authentication de Supabase.
    alert("Para que el mensajero pueda iniciar sesión, primero créalo en el panel 'Authentication' de Supabase con este mismo email.");
    
    const { error } = await supabase.from("perfiles").insert([
      { nombre: mNombre, email: mEmail, celular: mCelular, rol: "mensajero" }
    ]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Mensajero guardado en la lista.");
      setMNombre(""); setMCelular(""); setMEmail("");
      obtenerMensajeros();
    }
  }

  if (!user) return <Login onLogin={(u, p) => { setUser(u); setPerfil(p); }} />;

  const isAdmin = perfil?.rol === 'admin';

  return (
    <div style={{ background: "#0D1117", minHeight: "100vh", color: "#C9D1D9", fontFamily: "sans-serif" }}>
      <nav style={{ display: "flex", justifyContent: "space-between", padding: "15px 30px", background: "#161B22", borderBottom: "1px solid #30363D", alignItems: "center" }}>
        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#F3F4F6" }}>⚡ PackTrack</div>
        <div style={{ display: "flex", gap: "20px" }}>
          <span onClick={() => setTabActual("entregas")} style={{ cursor: "pointer", color: tabActual === "entregas" ? "#58A6FF" : "#8B949E" }}>📦 Entregas</span>
          {isAdmin && <span onClick={() => setTabActual("admin")} style={{ cursor: "pointer", color: tabActual === "admin" ? "#58A6FF" : "#8B949E" }}>👥 Gestión</span>}
        </div>
        <button onClick={() => setUser(null)} style={{ background: "transparent", border: "1px solid #F85149", color: "#F85149", padding: "5px 15px", borderRadius: "6px", cursor: "pointer" }}>Salir</button>
      </nav>

      <main style={{ padding: "30px", maxWidth: "1000px", margin: "0 auto" }}>
        {tabActual === "entregas" ? (
          <section>
            <h2>Mis Entregas</h2>
            <div style={S.card}>Aquí aparecerán tus paquetes asignados...</div>
          </section>
        ) : (
          <section>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "25px" }}>
              {/* FORMULARIO */}
              <div style={S.card}>
                <h3 style={{ marginTop: 0, color: "#58A6FF" }}>Nuevo Mensajero</h3>
                <form onSubmit={registrarMensajero}>
                  <input style={S.input} placeholder="Nombre completo" value={mNombre} onChange={e => setMNombre(e.target.value)} required />
                  <input style={S.input} placeholder="Celular" value={mCelular} onChange={e => setMCelular(e.target.value)} required />
                  <input style={S.input} placeholder="Email" type="email" value={mEmail} onChange={e => setMEmail(e.target.value)} required />
                  <button type="submit" style={{ ...S.btnPrimary, width: "100%", marginTop: "10px" }}>Guardar Mensajero</button>
                </form>
              </div>

              {/* LISTA */}
              <div style={S.card}>
                <h3 style={{ marginTop: 0 }}>Lista de Mensajeros</h3>
                <table style={S.table}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #30363D" }}>
                      <th style={{ padding: "10px" }}>Nombre</th>
                      <th style={{ padding: "10px" }}>Celular</th>
                      <th style={{ padding: "10px" }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mensajeros.map((m, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #21262D" }}>
                        <td style={{ padding: "10px" }}>{m.nombre}</td>
                        <td style={{ padding: "10px" }}>{m.celular || "N/A"}</td>
                        <td style={{ padding: "10px" }}>{m.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mensajeros.length === 0 && <p style={{ textAlign: "center", color: "#8B949E" }}>No hay mensajeros registrados.</p>}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}