import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURACIÓN SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL = "https://ntognnxsstmbyfptwhsb.supabase.co";       // ← cambia esto
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50b2dubnhzc3RtYnlmcHR3aHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg3OTUsImV4cCI6MjA4ODQ5NDc5NX0.2MYhpK-MQTTwlpWWYkV0nTTbU-SVUeqCnjXXOU8GMHs";                            // ← cambia esto

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ESTADOS = {
  recibido:  { label: "Recibido",  color: "#F59E0B", bg: "rgba(245,158,11,0.15)",  next: "en_ruta",   icon: "📦" },
  en_ruta:   { label: "En ruta",   color: "#3B82F6", bg: "rgba(59,130,246,0.15)",  next: "entregado", icon: "🚴" },
  entregado: { label: "Entregado", color: "#10B981", bg: "rgba(16,185,129,0.15)",  next: null,        icon: "✅" },
};

function nowStr() {
  const d = new Date();
  return {
    hora: d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
    fecha: d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }),
  };
}

async function getGPS() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null), { timeout: 6000, enableHighAccuracy: true }
    );
  });
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError("Email o contraseña incorrectos"); setLoading(false); return; }
    const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", data.user.id).single();
    onLogin(data.user, perfil);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", padding: 16 }}>
      <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 16, padding: 40, width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: 24, color: "#F3F4F6", letterSpacing: 2 }}>PackTrack</div>
          <div style={{ color: "#6B7280", fontSize: 13, marginTop: 4 }}>Sistema de monitoreo de entregas</div>
        </div>
        {error && <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #EF4444", borderRadius: 8, padding: "10px 14px", color: "#EF4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#9CA3AF", marginBottom: 14 }}>
          Email
          <input style={S.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@empresa.com" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#9CA3AF", marginBottom: 24 }}>
          Contraseña
          <input style={S.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </label>
        <button style={{ ...S.btnPrimary, width: "100%", justifyContent: "center", padding: "12px", fontSize: 15 }} onClick={handleLogin} disabled={loading || !email || !password}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

// ─── ESCÁNER QR ──────────────────────────────────────────────────────────────
function QRScanner({ onScan }) {
  const instanceRef = useRef(null);
  const [camActive, setCamActive] = useState(false);
  const [error, setError]         = useState("");

  function startScanner() {
    if (!window.Html5Qrcode) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
      script.onload = initScanner;
      document.head.appendChild(script);
    } else initScanner();
  }

  function initScanner() {
    if (instanceRef.current) return;
    const scanner = new window.Html5Qrcode("qr-reader");
    instanceRef.current = scanner;
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      text => { onScan(text.trim().toUpperCase()); stopScanner(); },
      () => {}
    ).then(() => setCamActive(true))
     .catch(() => { setError("No se pudo acceder a la cámara. Acepta el permiso."); instanceRef.current = null; });
  }

  function stopScanner() {
    instanceRef.current?.stop().catch(() => {});
    instanceRef.current = null;
    setCamActive(false);
  }

  useEffect(() => () => stopScanner(), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div id="qr-reader" style={{ width: "100%", maxWidth: 300, borderRadius: 10, overflow: "hidden", background: "#0D1117", border: "1px solid #21262D" }} />
      {error && <div style={{ color: "#EF4444", fontSize: 13, textAlign: "center" }}>{error}</div>}
      {!camActive
        ? <button style={S.btnPrimary} onClick={startScanner}>📷 Activar cámara para escanear</button>
        : <button style={S.btnSecondary} onClick={stopScanner}>⏹ Detener cámara</button>}
    </div>
  );
}

// ─── SUBIR FOTO EVIDENCIA ────────────────────────────────────────────────────
function FotoEvidencia({ paqueteId, onFotoSubida }) {
  const [preview, setPreview]   = useState(null);
  const [file, setFile]         = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError]       = useState("");
  const inputRef                = useRef(null);

  function seleccionarFoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("La foto no puede superar 5MB"); return; }
    setFile(f);
    setError("");
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  async function subirFoto() {
    if (!file) return;
    setSubiendo(true); setError("");
    try {
      const ext = file.name.split(".").pop();
      const path = `${paqueteId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("evidencias")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("evidencias").getPublicUrl(path);
      onFotoSubida(publicUrl);
    } catch (e) {
      setError("Error subiendo foto: " + e.message);
    }
    setSubiendo(false);
  }

  function limpiar() { setPreview(null); setFile(null); setError(""); }

  return (
    <div style={{ background: "#0D1117", border: "1px solid #30363D", borderRadius: 10, padding: 16, marginTop: 12 }}>
      <div style={{ color: "#F59E0B", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📸 Foto de evidencia de entrega</div>
      {!preview ? (
        <div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment"
            onChange={seleccionarFoto} style={{ display: "none" }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={S.btnPrimary} onClick={() => { inputRef.current.removeAttribute("capture"); inputRef.current.click(); }}>
              🖼️ Galería
            </button>
            <button style={{ ...S.btnPrimary, background: "#3B82F6" }} onClick={() => { inputRef.current.setAttribute("capture", "environment"); inputRef.current.click(); }}>
              📷 Cámara
            </button>
          </div>
          <div style={{ color: "#6B7280", fontSize: 11, marginTop: 8 }}>Opcional — puedes entregar sin foto</div>
        </div>
      ) : (
        <div>
          <img src={preview} alt="evidencia" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />
          {error && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btnSecondary} onClick={limpiar}>✕ Cambiar</button>
            <button style={{ ...S.btnPrimary, flex: 1, justifyContent: "center" }} onClick={subirFoto} disabled={subiendo}>
              {subiendo ? "Subiendo..." : "✅ Usar esta foto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAPA ────────────────────────────────────────────────────────────────────
function MapaTracking({ ubicaciones, paquetes }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const map = window.L.map(mapRef.current).setView([4.711, -74.0721], 11);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
      mapInstanceRef.current = map;
      renderMarkers(ubicaciones, paquetes);
    };
    document.head.appendChild(script);
  }, []);

  function renderMarkers(ubs, pkgs) {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove()); markersRef.current = [];
    ubs.forEach(u => {
      const icon = L.divIcon({ html: `<div style="background:#A78BFA;color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)">🚴</div>`, className: "", iconSize: [38,38], iconAnchor: [19,19] });
      markersRef.current.push(L.marker([u.lat, u.lng], { icon }).addTo(mapInstanceRef.current).bindPopup(`<b>🚴 ${u.mensajeros?.nombre || "Mensajero"}</b><br><small>En línea</small>`));
    });
    pkgs.forEach(p => (p.historial||[]).forEach(h => {
      if (!h.lat || !h.lng) return;
      const est = ESTADOS[h.estado];
      const icon = L.divIcon({ html: `<div style="background:${est.color};color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-weight:700">${est.icon} ${p.id}</div>`, className: "", iconAnchor: [20,10] });
      markersRef.current.push(L.marker([h.lat, h.lng], { icon }).addTo(mapInstanceRef.current).bindPopup(`<b>${p.id}</b> — ${p.cliente}<br>${est.icon} ${est.label}<br>${h.fecha} ${h.hora}`));
    }));
  }

  useEffect(() => { renderMarkers(ubicaciones, paquetes); }, [ubicaciones, paquetes]);

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #21262D", marginBottom: 16 }}>
      <div style={{ background: "#161B22", padding: "10px 16px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🗺️ Mapa en tiempo real</span>
        <span style={{ color: "#6B7280", fontSize: 12 }}>{ubicaciones.length} mensajero(s) activo(s)</span>
      </div>
      <div ref={mapRef} style={{ height: 400, background: "#0D1117" }} />
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]       = useState(null);
  const [perfil, setPerfil]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);
      if (session) {
        const { data: p } = await supabase.from("perfiles").select("*").eq("id", session.user.id).single();
        setUser(session.user); setPerfil(p);
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session) {
        const { data: p } = await supabase.from("perfiles").select("*").eq("id", session.user.id).single();
        setUser(session.user); setPerfil(p);
      } else { setUser(null); setPerfil(null); }
    });
    return () => subscription.unsubscribe();
  }, []);




  function handleLogout() { supabase.auth.signOut(); setUser(null); setPerfil(null); }

  if (loading) return <div style={{ minHeight: "100vh", background: "#0D1117", display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA", fontSize: 20, fontFamily: "monospace" }}>⚡ Cargando...</div>;
  if (!user || !perfil) return <Login onLogin={(u, p) => { setUser(u); setPerfil(p); }} />;
  if (perfil.rol === "admin") return <AdminApp user={user} perfil={perfil} onLogout={handleLogout} />;
  return <MensajeroApp user={user} perfil={perfil} onLogout={handleLogout} />;
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminApp({ user, perfil, onLogout }) {
  const [packages, setPackages]               = useState([]);
  const [mensajeros, setMensajeros]           = useState([]);
  const [ubicaciones, setUbicaciones]         = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [view, setView]                       = useState("dashboard");
  const [selectedPkg, setSelectedPkg]         = useState(null);
  const [filterEstado, setFilterEstado]       = useState("todos");
  const [filterMensajero, setFilterMensajero] = useState("todos");
  const [toast, setToast]                     = useState(null);
  const [showNewPkg, setShowNewPkg]           = useState(false);
  const [showNewMsg, setShowNewMsg]           = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [newPkgForm, setNewPkgForm] = useState({ cliente: "", direccion: "", mensajero_id: "", peso: "", prioridad: "normal" });
  const [newMsgForm, setNewMsgForm] = useState({ nombre: "", telefono: "", email: "", password: "" });

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const iv = setInterval(() => { if (view === "mapa") loadUbicaciones(); }, 10000);
    return () => clearInterval(iv);
  }, [view]);

  async function loadAll() {
    setLoading(true);
    const [{ data: pkgs }, { data: msgs }, { data: ubs }] = await Promise.all([
      supabase.from("paquetes").select("*,mensajeros(nombre,id)").order("created_at", { ascending: false }),
      supabase.from("mensajeros").select("*").eq("activo", true).order("nombre"),
      supabase.from("ubicaciones").select("*,mensajeros(nombre)").eq("activo", true),
    ]);
    const pkgsH = await Promise.all((pkgs||[]).map(async p => {
      const { data: h } = await supabase.from("historial").select("*").eq("paquete_id", p.id).order("created_at");
      return { ...p, mensajero: p.mensajeros?.nombre || "Sin asignar", historial: h||[] };
    }));
    setPackages(pkgsH); setMensajeros(msgs||[]); setUbicaciones(ubs||[]);
    if ((msgs||[]).length && !newPkgForm.mensajero_id) setNewPkgForm(f => ({ ...f, mensajero_id: msgs[0].id }));
    setLoading(false);
  }

  async function loadUbicaciones() {
    const { data } = await supabase.from("ubicaciones").select("*,mensajeros(nombre)").eq("activo", true);
    setUbicaciones(data||[]);
  }

  function showToast(msg, type = "ok") { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }

  async function advanceState(pkg) {
    const next = ESTADOS[pkg.estado]?.next; if (!next) return;
    setSaving(true);
    const coords = await getGPS(); const { hora, fecha } = nowStr();
    await supabase.from("paquetes").update({ estado: next }).eq("id", pkg.id);
    await supabase.from("historial").insert({ paquete_id: pkg.id, estado: next, hora, fecha, lat: coords?.lat, lng: coords?.lng });
    await loadAll(); showToast(`→ ${ESTADOS[next].label} ✓`); setSaving(false);
  }

  async function createPackage() {
    if (!newPkgForm.cliente || !newPkgForm.direccion) return;
    setSaving(true);
    const { data: all } = await supabase.from("paquetes").select("id");
    const id = `PKG-${String((all||[]).length + 1).padStart(3, "0")}`;
    const { hora, fecha } = nowStr();
    await supabase.from("paquetes").insert({ id, qr: id, ...newPkgForm });
    await supabase.from("historial").insert({ paquete_id: id, estado: "recibido", hora, fecha });
    await loadAll(); setShowNewPkg(false);
    setNewPkgForm({ cliente: "", direccion: "", mensajero_id: mensajeros[0]?.id||"", peso: "", prioridad: "normal" });
    showToast("Paquete creado ✓"); setSaving(false);
  }

  async function createMensajero() {
    if (!newMsgForm.nombre || !newMsgForm.email || !newMsgForm.password) return;
    setSaving(true);
    try {
      const { data: msg } = await supabase.from("mensajeros").insert({ nombre: newMsgForm.nombre, telefono: newMsgForm.telefono, activo: true }).select().single();
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: newMsgForm.email, password: newMsgForm.password,
        options: { data: { rol: "mensajero", nombre: newMsgForm.nombre } }
      });
      if (authErr) throw authErr;
      if (authData.user) {
        await supabase.from("perfiles").upsert({ id: authData.user.id, rol: "mensajero", mensajero_id: msg.id, nombre: newMsgForm.nombre });
      }
      await loadAll(); setShowNewMsg(false);
      setNewMsgForm({ nombre: "", telefono: "", email: "", password: "" });
      showToast(`Mensajero ${newMsgForm.nombre} creado ✓`);
    } catch (e) { showToast("Error: " + e.message, "err"); }
    setSaving(false);
  }

  const filtered = packages.filter(p =>
    (filterEstado === "todos" || p.estado === filterEstado) &&
    (filterMensajero === "todos" || p.mensajero === filterMensajero)
  );
  const stats = { total: packages.length, recibido: packages.filter(p=>p.estado==="recibido").length, en_ruta: packages.filter(p=>p.estado==="en_ruta").length, entregado: packages.filter(p=>p.estado==="entregado").length };

  return (
    <div style={S.root}>
      {toast && <div style={{ ...S.toast, background: toast.type==="ok"?"#10B981":"#EF4444" }}>{toast.msg}</div>}
      <nav style={S.nav}>
        <div style={S.navBrand}><span>⚡</span><span style={S.navTitle}>PackTrack</span><span style={{ ...S.badge, background:"rgba(167,139,250,0.15)", color:"#A78BFA", fontSize:11 }}>Admin</span></div>
        <div style={S.navTabs}>
          {[["dashboard","📊 Dashboard"],["mapa","🗺️ Mapa"],["mensajeros","👤 Mensajeros"]].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)} style={{...S.navTab,...(view===v?S.navTabActive:{})}}>{l}</button>
          ))}
        </div>
        <button style={S.btnSecondary} onClick={onLogout}>Salir</button>
      </nav>
      {loading && <div style={S.loadingBar}/>}

      {view==="dashboard" && (
        <div style={S.page}>
          <div style={S.statsRow}>
            {[["Total",stats.total,"#A78BFA"],["Recibidos",stats.recibido,"#F59E0B"],["En ruta",stats.en_ruta,"#3B82F6"],["Entregados",stats.entregado,"#10B981"]].map(([label,val,color])=>(
              <div key={label} style={{...S.statCard, borderTop:`3px solid ${color}`}}>
                <div style={{...S.statNum,color}}>{val}</div><div style={S.statLabel}>{label}</div>
              </div>
            ))}
          </div>
          <div style={S.toolbar}>
            <div style={S.filters}>
              <select style={S.select} value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}>
                <option value="todos">Todos los estados</option>
                <option value="recibido">Recibido</option><option value="en_ruta">En ruta</option><option value="entregado">Entregado</option>
              </select>
              <select style={S.select} value={filterMensajero} onChange={e=>setFilterMensajero(e.target.value)}>
                <option value="todos">Todos los mensajeros</option>
                {[...new Set(packages.map(p=>p.mensajero))].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <button style={S.btnPrimary} onClick={()=>setShowNewPkg(true)}>+ Nuevo paquete</button>
          </div>
          {showNewPkg && (
            <div style={S.formCard}>
              <div style={S.formTitle}>Registrar nuevo paquete</div>
              <div style={S.formGrid}>
                {[["cliente","Cliente"],["direccion","Dirección"],["peso","Peso"]].map(([k,l])=>(
                  <label key={k} style={S.formLabel}>{l}<input style={S.input} value={newPkgForm[k]} onChange={e=>setNewPkgForm(p=>({...p,[k]:e.target.value}))}/></label>
                ))}
                <label style={S.formLabel}>Mensajero
                  <select style={S.input} value={newPkgForm.mensajero_id} onChange={e=>setNewPkgForm(p=>({...p,mensajero_id:e.target.value}))}>
                    {mensajeros.map(m=><option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </label>
                <label style={S.formLabel}>Prioridad
                  <select style={S.input} value={newPkgForm.prioridad} onChange={e=>setNewPkgForm(p=>({...p,prioridad:e.target.value}))}>
                    <option value="normal">Normal</option><option value="urgente">Urgente</option>
                  </select>
                </label>
              </div>
              <div style={S.formActions}>
                <button style={S.btnSecondary} onClick={()=>setShowNewPkg(false)}>Cancelar</button>
                <button style={S.btnPrimary} onClick={createPackage} disabled={saving||!newPkgForm.cliente}>{saving?"Guardando...":"Crear"}</button>
              </div>
            </div>
          )}
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr>{["ID","Cliente","Dirección","Mensajero","Prioridad","Estado","Evidencia","Acción"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(pkg=>{
                  const est=ESTADOS[pkg.estado];
                  return (
                    <tr key={pkg.id} style={S.tr} onClick={async()=>{const{data:h}=await supabase.from("historial").select("*").eq("paquete_id",pkg.id).order("created_at");setSelectedPkg({...pkg,historial:h});setView("detail");}}>
                      <td style={S.td}><span style={S.pkgId}>{pkg.id}</span></td>
                      <td style={S.td}>{pkg.cliente}</td>
                      <td style={{...S.td,color:"#9CA3AF",fontSize:12}}>{pkg.direccion}</td>
                      <td style={S.td}>{pkg.mensajero}</td>
                      <td style={S.td}><span style={{...S.badge,background:pkg.prioridad==="urgente"?"rgba(239,68,68,0.15)":"rgba(156,163,175,0.15)",color:pkg.prioridad==="urgente"?"#EF4444":"#9CA3AF"}}>{pkg.prioridad==="urgente"?"🔴 Urgente":"Normal"}</span></td>
                      <td style={S.td}><span style={{...S.badge,background:est.bg,color:est.color}}>{est.icon} {est.label}</span></td>
                      <td style={S.td}>
                        {pkg.foto_entrega
                          ? <a href={pkg.foto_entrega} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}><img src={pkg.foto_entrega} alt="evidencia" style={{width:40,height:40,objectFit:"cover",borderRadius:6,border:"1px solid #30363D"}}/></a>
                          : <span style={{color:"#4B5563",fontSize:12}}>—</span>}
                      </td>
                      <td style={S.td} onClick={e=>e.stopPropagation()}>
                        {est.next?<button style={S.btnAdvance} onClick={()=>advanceState(pkg)} disabled={saving}>→ {ESTADOS[est.next].label}</button>:<span style={{color:"#4B5563",fontSize:12}}>Completo</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length===0&&!loading&&<div style={S.empty}>No hay paquetes</div>}
          </div>
        </div>
      )}

      {view==="mapa" && (
        <div style={S.page}>
          <MapaTracking ubicaciones={ubicaciones} paquetes={packages}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
            {mensajeros.map(m=>{
              const ub=ubicaciones.find(u=>u.mensajero_id===m.id);
              const pendientes=packages.filter(p=>p.mensajero===m.nombre&&p.estado!=="entregado").length;
              return (
                <div key={m.id} style={{background:"#161B22",border:"1px solid #21262D",borderRadius:10,padding:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontWeight:700}}>🚴 {m.nombre}</span>
                    <span style={{...S.badge,background:ub?"rgba(16,185,129,0.15)":"rgba(107,114,128,0.15)",color:ub?"#10B981":"#6B7280",fontSize:11}}>{ub?"● En línea":"○ Offline"}</span>
                  </div>
                  <div style={{color:"#9CA3AF",fontSize:12}}>{pendientes} pendiente(s)</div>
                  {ub&&<div style={{color:"#6B7280",fontSize:11,marginTop:4}}>📍 {ub.lat?.toFixed(4)}, {ub.lng?.toFixed(4)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view==="mensajeros" && (
        <div style={S.page}>
          <div style={S.toolbar}>
            <div style={{fontWeight:700,fontSize:18}}>👤 Gestión de mensajeros</div>
            <button style={S.btnPrimary} onClick={()=>setShowNewMsg(true)}>+ Nuevo mensajero</button>
          </div>
          {showNewMsg && (
            <div style={S.formCard}>
              <div style={S.formTitle}>Crear mensajero + acceso a la app</div>
              <div style={S.formGrid}>
                <label style={S.formLabel}>Nombre completo<input style={S.input} value={newMsgForm.nombre} placeholder="Carlos Pérez" onChange={e=>setNewMsgForm(p=>({...p,nombre:e.target.value}))}/></label>
                <label style={S.formLabel}>Teléfono<input style={S.input} value={newMsgForm.telefono} placeholder="3001234567" onChange={e=>setNewMsgForm(p=>({...p,telefono:e.target.value}))}/></label>
                <label style={S.formLabel}>Email (para login)<input style={S.input} type="email" value={newMsgForm.email} placeholder="carlos@empresa.com" onChange={e=>setNewMsgForm(p=>({...p,email:e.target.value}))}/></label>
                <label style={S.formLabel}>Contraseña<input style={S.input} type="password" value={newMsgForm.password} placeholder="Mínimo 6 caracteres" onChange={e=>setNewMsgForm(p=>({...p,password:e.target.value}))}/></label>
              </div>
              <div style={S.formActions}>
                <button style={S.btnSecondary} onClick={()=>setShowNewMsg(false)}>Cancelar</button>
                <button style={S.btnPrimary} onClick={createMensajero} disabled={saving||!newMsgForm.nombre||!newMsgForm.email||!newMsgForm.password}>{saving?"Creando...":"Crear mensajero"}</button>
              </div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
            {mensajeros.map(m=>{
              const ub=ubicaciones.find(u=>u.mensajero_id===m.id);
              const total=packages.filter(p=>p.mensajero===m.nombre).length;
              const entregados=packages.filter(p=>p.mensajero===m.nombre&&p.estado==="entregado").length;
              const pendientes=packages.filter(p=>p.mensajero===m.nombre&&p.estado!=="entregado").length;
              return (
                <div key={m.id} style={{background:"#161B22",border:"1px solid #21262D",borderRadius:12,padding:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                    <div><div style={{fontWeight:700,fontSize:16}}>🚴 {m.nombre}</div>{m.telefono&&<div style={{color:"#6B7280",fontSize:13}}>📱 {m.telefono}</div>}</div>
                    <span style={{...S.badge,background:ub?"rgba(16,185,129,0.15)":"rgba(107,114,128,0.15)",color:ub?"#10B981":"#6B7280",fontSize:11}}>{ub?"● En línea":"○ Offline"}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                    {[["Total",total,"#A78BFA"],["Entregados",entregados,"#10B981"],["Pendientes",pendientes,"#F59E0B"]].map(([l,v,c])=>(
                      <div key={l} style={{background:"#0D1117",borderRadius:6,padding:"8px 4px",textAlign:"center"}}>
                        <div style={{color:c,fontWeight:700,fontSize:20}}>{v}</div><div style={{color:"#6B7280",fontSize:11}}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <button style={{...S.btnSecondary,width:"100%",fontSize:12}} onClick={()=>{if(window.confirm(`¿Desactivar a ${m.nombre}?`))supabase.from("mensajeros").update({activo:false}).eq("id",m.id).then(loadAll);}}>Desactivar</button>
                </div>
              );
            })}
            {mensajeros.length===0&&<div style={S.empty}>No hay mensajeros. Crea el primero.</div>}
          </div>
        </div>
      )}

      {view==="detail" && selectedPkg && (()=>{
        const pkg=selectedPkg; const est=ESTADOS[pkg.estado];
        return (
          <div style={S.page}>
            <button style={S.backBtn} onClick={()=>setView("dashboard")}>← Volver</button>
            <div style={S.detailCard}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                <div><div style={{fontSize:22,fontWeight:700,letterSpacing:2}}>{pkg.id}</div><div style={{color:"#9CA3AF",fontSize:14}}>{pkg.cliente}</div></div>
                <span style={{...S.badge,background:est.bg,color:est.color,fontSize:14,padding:"6px 14px"}}>{est.icon} {est.label}</span>
              </div>
              <div style={S.detailGrid}>
                {[["📍 Dirección",pkg.direccion],["🚴 Mensajero",pkg.mensajero],["⚖️ Peso",pkg.peso||"—"],["🔖 Prioridad",pkg.prioridad]].map(([k,v])=>(
                  <div key={k} style={{background:"#0D1117",borderRadius:8,padding:12}}><div style={{color:"#6B7280",fontSize:12}}>{k}</div><div style={{color:"#F3F4F6",fontWeight:500}}>{v}</div></div>
                ))}
              </div>
              {pkg.foto_entrega && (
                <div style={{marginTop:20}}>
                  <div style={{color:"#6B7280",fontSize:12,marginBottom:8}}>📸 EVIDENCIA DE ENTREGA</div>
                  <a href={pkg.foto_entrega} target="_blank" rel="noreferrer">
                    <img src={pkg.foto_entrega} alt="evidencia" style={{width:"100%",maxHeight:300,objectFit:"cover",borderRadius:10,border:"1px solid #30363D"}}/>
                  </a>
                </div>
              )}
              <div style={{marginTop:24}}>
                <div style={{color:"#6B7280",fontSize:12,letterSpacing:1,marginBottom:12}}>HISTORIAL</div>
                {(pkg.historial||[]).map((h,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,paddingBottom:14}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:ESTADOS[h.estado].color,flexShrink:0,marginTop:4}}/>
                    <div style={{flex:1}}>
                      <span style={{color:ESTADOS[h.estado].color,fontWeight:600}}>{ESTADOS[h.estado].icon} {ESTADOS[h.estado].label}</span>
                      <span style={{color:"#6B7280",fontSize:12,marginLeft:8}}>{h.fecha} {h.hora}</span>
                      {h.lat&&<div style={{color:"#4B5563",fontSize:11,marginTop:2}}>📍 {h.lat?.toFixed(5)}, {h.lng?.toFixed(5)}</div>}
                      {h.foto_url&&<a href={h.foto_url} target="_blank" rel="noreferrer"><img src={h.foto_url} alt="foto" style={{width:80,height:60,objectFit:"cover",borderRadius:6,marginTop:6,border:"1px solid #30363D"}}/></a>}
                    </div>
                  </div>
                ))}
              </div>
              {est.next&&<button style={{...S.btnPrimary,marginTop:20,width:"100%",justifyContent:"center",padding:"12px"}} onClick={()=>advanceState(pkg)} disabled={saving}>Avanzar a → {ESTADOS[est.next].icon} {ESTADOS[est.next].label}</button>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── MENSAJERO ────────────────────────────────────────────────────────────────
function MensajeroApp({ user, perfil, onLogout }) {
  const [packages, setPackages]           = useState([]);
  const [mensajeroInfo, setMensajeroInfo] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [scanResult, setScanResult]       = useState(null);
  const [manualCode, setManualCode]       = useState("");
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState(null);
  const [gps, setGps]                     = useState(null);
  const [fotoUrl, setFotoUrl]             = useState(null);
  const [fotoLista, setFotoLista]         = useState(false);
  const gpsRef                            = useRef(null);

  useEffect(() => { loadData(); startGPS(); return () => clearInterval(gpsRef.current); }, []);

  async function loadData() {
    setLoading(true);
    const { data: p } = await supabase.from("perfiles").select("*,mensajeros(*)").eq("id", user.id).single();
    setMensajeroInfo(p?.mensajeros);
    const { data: pkgs } = await supabase.from("paquetes").select("*,mensajeros(nombre)").order("created_at", { ascending: false });
    const pkgsH = await Promise.all((pkgs||[]).map(async pkg => {
      const { data: h } = await supabase.from("historial").select("*").eq("paquete_id", pkg.id).order("created_at");
      return { ...pkg, mensajero: pkg.mensajeros?.nombre||"Sin asignar", historial: h||[] };
    }));
    setPackages(pkgsH); setLoading(false);
  }

  function startGPS() {
    async function enviar() {
      navigator.geolocation?.getCurrentPosition(async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGps({ lat, lng });
        if (perfil?.mensajero_id) await supabase.from("ubicaciones").upsert({ mensajero_id: perfil.mensajero_id, lat, lng, activo: true }, { onConflict: "mensajero_id" });
      }, null, { enableHighAccuracy: true, timeout: 8000 });
    }
    enviar(); gpsRef.current = setInterval(enviar, 15000);
  }

  function showToast(msg, type="ok") { setToast({msg,type}); setTimeout(()=>setToast(null),3500); }

  async function buscarPaquete(code) {
    if (!code) return;
    setFotoUrl(null); setFotoLista(false);
    const { data } = await supabase.from("paquetes").select("*,mensajeros(nombre)").eq("qr", code);
    if (!data?.length) { setScanResult({ notFound: true, code }); return; }
    const pkg = data[0];
    const { data: h } = await supabase.from("historial").select("*").eq("paquete_id", pkg.id).order("created_at");
    setScanResult({ pkg: { ...pkg, mensajero: pkg.mensajeros?.nombre||"Sin asignar", historial: h||[] } });
  }

  async function advanceState(pkg, fotoUrlParam) {
    const next = ESTADOS[pkg.estado]?.next; if (!next) return;
    setSaving(true);
    const coords = await getGPS(); const { hora, fecha } = nowStr();
    const fotoFinal = fotoUrlParam || fotoUrl || null;

    await supabase.from("paquetes").update({
      estado: next,
      ...(next === "entregado" && fotoFinal ? { foto_entrega: fotoFinal } : {})
    }).eq("id", pkg.id);

    await supabase.from("historial").insert({
      paquete_id: pkg.id, estado: next, hora, fecha,
      lat: coords?.lat, lng: coords?.lng,
      foto_url: fotoFinal
    });

    showToast(`→ ${ESTADOS[next].label} ${coords?"📍":""} ${fotoFinal?"📸":""}`);
    setFotoUrl(null); setFotoLista(false);
    await buscarPaquete(pkg.qr); await loadData(); setSaving(false);
  }

  const pendientes = packages.filter(p => p.estado !== "entregado");

  return (
    <div style={S.root}>
      {toast && <div style={{...S.toast,background:toast.type==="ok"?"#10B981":"#EF4444"}}>{toast.msg}</div>}
      <nav style={S.nav}>
        <div style={S.navBrand}><span>⚡</span><span style={S.navTitle}>PackTrack</span><span style={{...S.badge,background:"rgba(59,130,246,0.15)",color:"#3B82F6",fontSize:11}}>Mensajero</span></div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          {gps && <span style={{color:"#10B981",fontSize:12}}>📍 GPS activo</span>}
          <span style={{color:"#9CA3AF",fontSize:13}}>👤 {mensajeroInfo?.nombre||user.email}</span>
          <button style={S.btnSecondary} onClick={onLogout}>Salir</button>
        </div>
      </nav>
      {loading && <div style={S.loadingBar}/>}

      <div style={{maxWidth:600,margin:"0 auto",padding:"24px 16px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:24}}>
          {[["Pendientes",pendientes.length,"#F59E0B"],["En ruta",packages.filter(p=>p.estado==="en_ruta").length,"#3B82F6"],["Entregados",packages.filter(p=>p.estado==="entregado").length,"#10B981"]].map(([l,v,c])=>(
            <div key={l} style={{...S.statCard,borderTop:`3px solid ${c}`}}>
              <div style={{...S.statNum,color:c,fontSize:24}}>{v}</div><div style={S.statLabel}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:14,padding:24,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:18,marginBottom:16,textAlign:"center"}}>📷 Escanear paquete</div>
          <QRScanner onScan={code=>buscarPaquete(code)}/>
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <input style={{...S.scanInput,flex:1}} placeholder="O escribe el código: PKG-001"
              value={manualCode} onChange={e=>setManualCode(e.target.value.toUpperCase())}
              onKeyDown={e=>{if(e.key==="Enter"){buscarPaquete(manualCode);setManualCode("");}}}/>
            <button style={S.btnPrimary} onClick={()=>{buscarPaquete(manualCode);setManualCode("");}}>Buscar</button>
          </div>
        </div>

        {scanResult&&!scanResult.notFound&&(()=>{
          const pkg=scanResult.pkg; const est=ESTADOS[pkg.estado];
          const esEntrega = est.next === "entregado";
          return (
            <div style={{background:"#161B22",border:"1px solid #30363D",borderRadius:12,padding:20,marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={S.pkgId}>{pkg.id}</span>
                <span style={{...S.badge,background:est.bg,color:est.color}}>{est.icon} {est.label}</span>
              </div>
              <div style={{color:"#D1D5DB",fontSize:14,marginBottom:4}}><b>Cliente:</b> {pkg.cliente}</div>
              <div style={{color:"#D1D5DB",fontSize:14,marginBottom:4}}><b>Dirección:</b> {pkg.direccion}</div>
              <div style={{color:"#9CA3AF",fontSize:13,marginBottom:12}}><b>Asignado a:</b> {pkg.mensajero}</div>
              {pkg.historial?.length>0&&(
                <div style={{marginBottom:12}}>
                  <div style={{color:"#6B7280",fontSize:12,marginBottom:6}}>Historial</div>
                  {pkg.historial.map((h,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #21262D",fontSize:13}}>
                      <span style={{color:ESTADOS[h.estado].color}}>{ESTADOS[h.estado].icon} {ESTADOS[h.estado].label} {h.lat?"📍":""} {h.foto_url?"📸":""}</span>
                      <span style={{color:"#6B7280"}}>{h.fecha} {h.hora}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Foto de evidencia — solo aparece cuando va a marcar como entregado */}
              {est.next && (
                <div>
                  {esEntrega && (
                    <FotoEvidencia
                      paqueteId={pkg.id}
                      onFotoSubida={url => { setFotoUrl(url); setFotoLista(true); showToast("Foto lista 📸"); }}
                    />
                  )}
                  {fotoLista && fotoUrl && (
                    <div style={{color:"#10B981",fontSize:13,marginTop:8,marginBottom:4}}>✅ Foto adjunta y lista</div>
                  )}
                  <button style={{...S.btnPrimary,width:"100%",justifyContent:"center",padding:"12px",fontSize:15,marginTop:12}} onClick={()=>advanceState(pkg)} disabled={saving}>
                    {saving?"Guardando...":`Marcar como ${ESTADOS[est.next].label} ${ESTADOS[est.next].icon}`}
                  </button>
                </div>
              )}
              {!est.next&&(
                <div>
                  <div style={{textAlign:"center",color:"#10B981",fontWeight:700,fontSize:16,marginBottom:8}}>✅ Paquete entregado</div>
                  {pkg.foto_entrega&&<a href={pkg.foto_entrega} target="_blank" rel="noreferrer"><img src={pkg.foto_entrega} alt="evidencia" style={{width:"100%",maxHeight:200,objectFit:"cover",borderRadius:8,border:"1px solid #30363D"}}/></a>}
                </div>
              )}
            </div>
          );
        })()}
        {scanResult?.notFound&&(
          <div style={{background:"#161B22",border:"1px solid #EF4444",borderRadius:12,padding:20,marginBottom:16}}>
            <div style={{color:"#EF4444",fontWeight:700}}>❌ Paquete no encontrado</div>
            <div style={{color:"#9CA3AF",fontSize:13}}>Código: {scanResult.code}</div>
          </div>
        )}

        <div style={{background:"#161B22",border:"1px solid #21262D",borderRadius:12,padding:16}}>
          <div style={{color:"#6B7280",fontSize:11,letterSpacing:2,fontWeight:700,marginBottom:12}}>PENDIENTES HOY ({pendientes.length})</div>
          {pendientes.map(pkg=>{
            const est=ESTADOS[pkg.estado];
            return (
              <div key={pkg.id} style={{background:"#0D1117",borderRadius:8,padding:12,marginBottom:8,cursor:"pointer",border:"1px solid #21262D"}} onClick={()=>{setScanResult({pkg});setFotoUrl(null);setFotoLista(false);}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={S.pkgId}>{pkg.id}</span>
                  <span style={{...S.badge,background:est.bg,color:est.color,fontSize:11}}>{est.icon} {est.label}</span>
                </div>
                <div style={{color:"#D1D5DB",fontSize:13}}>{pkg.cliente}</div>
                <div style={{color:"#6B7280",fontSize:12}}>{pkg.direccion}</div>
              </div>
            );
          })}
          {pendientes.length===0&&<div style={{textAlign:"center",color:"#4B5563",padding:20}}>Todo entregado 🎉</div>}
        </div>
      </div>
    </div>
  );
}

const S = {
  root: { minHeight:"100vh", background:"#0D1117", color:"#F3F4F6", fontFamily:"'Courier New', monospace" },
  toast: { position:"fixed", top:16, right:16, zIndex:999, padding:"10px 20px", borderRadius:8, color:"#fff", fontWeight:600, fontSize:14, boxShadow:"0 4px 20px rgba(0,0,0,0.4)" },
  loadingBar: { height:3, background:"linear-gradient(90deg, #A78BFA, #3B82F6)" },
  nav: { background:"#161B22", borderBottom:"1px solid #21262D", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", height:56, gap:8, flexWrap:"wrap" },
  navBrand: { display:"flex", alignItems:"center", gap:8, fontWeight:700, fontSize:18, letterSpacing:2 },
  navTitle: { color:"#F3F4F6" },
  navTabs: { display:"flex", gap:4 },
  navTab: { background:"none", border:"none", color:"#6B7280", cursor:"pointer", padding:"8px 12px", borderRadius:6, fontSize:13, fontFamily:"inherit" },
  navTabActive: { background:"#21262D", color:"#F3F4F6" },
  page: { maxWidth:1100, margin:"0 auto", padding:"24px 16px" },
  statsRow: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 },
  statCard: { background:"#161B22", borderRadius:10, padding:"16px 20px" },
  statNum: { fontSize:32, fontWeight:700, lineHeight:1 },
  statLabel: { color:"#6B7280", fontSize:13, marginTop:4 },
  toolbar: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, gap:12, flexWrap:"wrap" },
  filters: { display:"flex", gap:8, flexWrap:"wrap" },
  select: { background:"#161B22", border:"1px solid #21262D", color:"#F3F4F6", padding:"8px 12px", borderRadius:6, fontSize:13, fontFamily:"inherit", cursor:"pointer" },
  formCard: { background:"#161B22", border:"1px solid #21262D", borderRadius:12, padding:20, marginBottom:20 },
  formTitle: { fontWeight:700, fontSize:15, marginBottom:16 },
  formGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 },
  formLabel: { display:"flex", flexDirection:"column", gap:6, fontSize:13, color:"#9CA3AF" },
  input: { background:"#0D1117", border:"1px solid #30363D", borderRadius:6, color:"#F3F4F6", padding:"8px 10px", fontSize:14, fontFamily:"inherit" },
  formActions: { display:"flex", gap:8, marginTop:16, justifyContent:"flex-end" },
  tableWrap: { background:"#161B22", borderRadius:12, overflow:"auto", border:"1px solid #21262D" },
  table: { width:"100%", borderCollapse:"collapse" },
  th: { padding:"12px 16px", textAlign:"left", color:"#6B7280", fontSize:12, borderBottom:"1px solid #21262D", whiteSpace:"nowrap" },
  tr: { cursor:"pointer" },
  td: { padding:"12px 16px", fontSize:14, borderBottom:"1px solid #0D1117" },
  empty: { textAlign:"center", padding:32, color:"#4B5563" },
  pkgId: { background:"#21262D", color:"#A78BFA", padding:"3px 8px", borderRadius:4, fontSize:12, fontWeight:700, letterSpacing:1 },
  badge: { display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, fontSize:12, fontWeight:600 },
  btnPrimary: { background:"#A78BFA", color:"#0D1117", border:"none", padding:"8px 16px", borderRadius:6, fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:6 },
  btnSecondary: { background:"#21262D", color:"#F3F4F6", border:"1px solid #30363D", padding:"8px 16px", borderRadius:6, fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"inherit" },
  btnAdvance: { background:"rgba(59,130,246,0.15)", color:"#3B82F6", border:"1px solid rgba(59,130,246,0.3)", padding:"5px 10px", borderRadius:6, cursor:"pointer", fontSize:12, fontFamily:"inherit", fontWeight:600 },
  scanInput: { background:"#0D1117", border:"1px solid #30363D", borderRadius:6, color:"#F3F4F6", padding:"10px 12px", fontSize:15, fontFamily:"inherit", letterSpacing:1 },
  backBtn: { background:"none", border:"none", color:"#A78BFA", cursor:"pointer", fontSize:14, fontFamily:"inherit", marginBottom:16, padding:0 },
  detailCard: { background:"#161B22", border:"1px solid #21262D", borderRadius:14, padding:28, maxWidth:640 },
  detailGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
};
