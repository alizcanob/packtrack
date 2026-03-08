import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURACIÓN DE SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── ESTILOS SISTEMA PACKTRACK ──────────────────────────────────────────────
const S = {
  input: { background: "#0D1117", border: "1px solid #30363D", borderRadius: 8, padding: "10px", color: "#C9D1D9", width: "100%", marginBottom: "10px", boxSizing: "border-box" },
  btnPrimary: { background: "#238636", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontWeight: "bold" },
  btnSecondary: { background: "#30363D", color: "#C9D1D9", border: "1px solid #8B949E", borderRadius: 8, padding: "10px 20px", cursor: "pointer" },
  card: { background: "#161B22", border: "1px solid #30363D", borderRadius: 12, padding: "20px", marginBottom: "15px" },
  badge: (color) => ({ background: color, color: "#fff", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "bold" })
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
        <h1 style={{ color: "#fff", margin: "0 0 10px 0" }}>⚡ PackTrack</h1>
        <p style={{ color: "#8B949E", fontSize: "14px", marginBottom: "30px" }}>Ingresa a tu panel de control</p>
        {error && <div style={{ color: "#ef4444", marginBottom: "15px", fontSize: "13px" }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <input style={S.input} type="email" placeholder="Email corporativo" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={S.input} type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={{ ...S.btnPrimary, width: "100%", marginTop: "10px" }} disabled={loading}>
            {loading ? "Verificando..." : "Iniciar Sesión"}
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
  const [tabActual, setTabActual] = useState("entregas");

  if (!user) return <Login onLogin={(u, p) => { setUser(u); setPerfil(p); }} />;

  const isAdmin = perfil?.rol === 'admin';

  return (
    <div style={{ background: "#0D1117", minHeight: "100vh", color: "#C9D1D9", fontFamily: "sans-serif" }}>
      {/* NAVBAR */}
      <nav style={{ display: "flex", justifyContent: "space-between", padding: "15px 30px", background: "#161B22", borderBottom: "1px solid #30363D", alignItems: "center" }}>
        <div style={{ fontSize: "20px", fontWeight: "bold", color: "#F3F4F6" }}>⚡ PackTrack</div>
        <div style={{ display: "flex", gap: "20px" }}>
          <span onClick={() => setTabActual("entregas")} style={{ cursor: "pointer", color: tabActual === "entregas" ? "#58A6FF" : "#8B949E" }}>📦 Entregas</span>
          {isAdmin && <span onClick={() => setTabActual("admin")} style={{ cursor: "pointer", color: tabActual === "admin" ? "#58A6FF" : "#8B949E" }}>⚙️ Gestión</span>}
        </div>
        <button onClick={() => setUser(null)} style={{ background: "transparent", border: "1px solid #F85149", color: "#F85149", padding: "5px 15px", borderRadius: "6px", cursor: "pointer" }}>Salir</button>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto" }}>
        <header style={{ marginBottom: "30px" }}>
          <h2 style={{ margin: 0 }}>Panel de {isAdmin ? "Administrador" : "Mensajero"}</h2>
          <p style={{ color: "#8B949E" }}>Conectado como: <b>{perfil?.nombre}</b> ({perfil?.zona || "Sin zona"})</p>
        </header>

        {tabActual === "entregas" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "30px" }}>
            {/* SECCIÓN DE LISTADO DE ENTREGAS */}
            <section>
              <h3 style={{ marginBottom: "20px" }}>Listado de Paquetes</h3>
              {[1, 2, 3].map(id => (
                <div key={id} style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: "17px" }}>Envío #PK-00{id}</div>
                      <div style={{ color: "#8B949E", fontSize: "13px", marginTop: "5px" }}>📍 Calle de Entrega {id}, Ciudad</div>
                    </div>
                    <span style={S.badge(id === 1 ? "#238636" : "#9E6A03")}>{id === 1 ? "ENTREGADO" : "EN RUTA"}</span>
                  </div>
                  <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                    <button style={S.btnSecondary}>Ver Detalle</button>
                    <button style={S.btnPrimary}>Actualizar Estado</button>
                  </div>
                </div>
              ))}
            </section>

            {/* SECCIÓN DE MONITOREO / MAPA */}
            <aside>
              <h3 style={{ marginBottom: "20px" }}>Ruta en Tiempo Real</h3>
              <div style={{ ...S.card, height: "300px", display: "flex", alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderColor: "#8B949E" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "40px" }}>📍</div>
                  <p style={{ color: "#8B949E" }}>Mapa Interactivo<br/><small>(Cargando coordenadas GPS...)</small></p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* SECCIÓN DE ADMINISTRACIÓN (SOLO PARA ADMINS) */
          <section>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
              <div style={S.card}>
                <h3 style={{ color: "#58A6FF" }}>➕ Registrar Mensajero</h3>
                <input style={S.input} placeholder="Nombre completo" />
                <input style={S.input} placeholder="Correo electrónico" />
                <input style={S.input} placeholder="Zona asignada" />
                <button style={{ ...S.btnPrimary, width: "100%" }}>Guardar en Base de Datos</button>
              </div>
              <div style={S.card}>
                <h3 style={{ color: "#58A6FF" }}>📊 Resumen de Operación</h3>
                <div style={{ display: "flex", justifyContent: "space-around", marginTop: "20px" }}>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: "24px", fontWeight: "bold" }}>12</div><small>Entregas</small></div>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: "24px", fontWeight: "bold" }}>4</div><small>Activos</small></div>
                  <div style={{ textAlign: "center" }}><div style={{ fontSize: "24px", fontWeight: "bold" }}>98%</div><small>Éxito</small></div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}