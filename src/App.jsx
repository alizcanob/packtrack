import { useState, useEffect, useRef } from "react";

// ─── CONFIGURACIÓN SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL = "https://ntognnxsstmbyfptwhsb.supabase.co";       // ← cambia esto
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50b2dubnhzc3RtYnlmcHR3aHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg3OTUsImV4cCI6MjA4ODQ5NDc5NX0.2MYhpK-MQTTwlpWWYkV0nTTbU-SVUeqCnjXXOU8GMHs";                            // ← cambia esto

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation",
};

// ─── API ─────────────────────────────────────────────────────────────────────
const api = {
  async getPaquetes() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paquetes?select=*,mensajeros(nombre,id)&order=created_at.desc`, { headers });
    const data = await res.json();
    return data.map(p => ({ ...p, mensajero: p.mensajeros?.nombre || "Sin asignar", mensajero_id: p.mensajeros?.id }));
  },
  async getMensajeros() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/mensajeros?select=*&activo=eq.true&order=nombre.asc`, { headers });
    return res.json();
  },
  async getHistorial(paqueteId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/historial?paquete_id=eq.${paqueteId}&order=created_at.asc`, { headers });
    return res.json();
  },
  async getPaqueteByQR(qr) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/paquetes?qr=eq.${qr}&select=*,mensajeros(nombre)`, { headers });
    const data = await res.json();
    if (!data.length) return null;
    const p = data[0];
    p.mensajero = p.mensajeros?.nombre || "Sin asignar";
    p.historial = await api.getHistorial(p.id);
    return p;
  },
  async crearPaquete(pkg) {
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/paquetes?select=id`, { headers });
    const all = await countRes.json();
    const id = `PKG-${String(all.length + 1).padStart(3, "0")}`;
    const { hora, fecha } = nowStr();
    await fetch(`${SUPABASE_URL}/rest/v1/paquetes`, {
      method: "POST", headers,
      body: JSON.stringify({ id, qr: id, ...pkg }),
    });
    await api.agregarHistorial(id, "recibido", hora, fecha, null, null);
    return id;
  },
  async avanzarEstado(paqueteId, nuevoEstado, lat, lng) {
    const { hora, fecha } = nowStr();
    await fetch(`${SUPABASE_URL}/rest/v1/paquetes?id=eq.${paqueteId}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    await api.agregarHistorial(paqueteId, nuevoEstado, hora, fecha, lat, lng);
  },
  async agregarHistorial(paqueteId, estado, hora, fecha, lat, lng) {
    await fetch(`${SUPABASE_URL}/rest/v1/historial`, {
      method: "POST", headers,
      body: JSON.stringify({ paquete_id: paqueteId, estado, hora, fecha, lat, lng }),
    });
  },
  async crearMensajero(nombre, telefono) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/mensajeros`, {
      method: "POST", headers,
      body: JSON.stringify({ nombre, telefono, activo: true }),
    });
    return (await res.json())[0];
  },
  async desactivarMensajero(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/mensajeros?id=eq.${id}`, {
      method: "PATCH", headers,
      body: JSON.stringify({ activo: false }),
    });
  },
  async actualizarUbicacion(mensajeroId, lat, lng) {
    await fetch(`${SUPABASE_URL}/rest/v1/ubicaciones`, {
      method: "POST",
      headers: { ...headers, "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ mensajero_id: mensajeroId, lat, lng, activo: true }),
    });
  },
  async getUbicaciones() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ubicaciones?select=*,mensajeros(nombre)&activo=eq.true`, { headers });
    return res.json();
  },
};

function nowStr() {
  const d = new Date();
  return {
    hora: d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
    fecha: d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" }),
  };
}

const ESTADOS = {
  recibido:  { label: "Recibido",  color: "#F59E0B", bg: "rgba(245,158,11,0.15)",  next: "en_ruta",   icon: "📦" },
  en_ruta:   { label: "En ruta",   color: "#3B82F6", bg: "rgba(59,130,246,0.15)",  next: "entregado", icon: "🚴" },
  entregado: { label: "Entregado", color: "#10B981", bg: "rgba(16,185,129,0.15)",  next: null,        icon: "✅" },
};

// ─── MAPA CON LEAFLET ────────────────────────────────────────────────────────
function MapaTracking({ ubicaciones, paquetes }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (mapInstanceRef.current) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current).setView([4.711, -74.0721], 11);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap"
      }).addTo(map);
      mapInstanceRef.current = map;
      renderMarkers(ubicaciones, paquetes);
    };
    document.head.appendChild(script);
  }, []);

  function renderMarkers(ubs, pkgs) {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    ubs.forEach(u => {
      const icon = L.divIcon({
        html: `<div style="background:#A78BFA;color:#fff;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)">🚴</div>`,
        className: "", iconSize: [38, 38], iconAnchor: [19, 19],
      });
      const m = L.marker([u.lat, u.lng], { icon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>🚴 ${u.mensajeros?.nombre || "Mensajero"}</b><br><small>Ubicación en tiempo real</small>`);
      markersRef.current.push(m);
    });
    pkgs.forEach(p => {
      (p.historial || []).forEach(h => {
        if (!h.lat || !h.lng) return;
        const est = ESTADOS[h.estado];
        const icon = L.divIcon({
          html: `<div style="background:${est.color};color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-weight:700">${est.icon} ${p.id}</div>`,
          className: "", iconAnchor: [20, 10],
        });
        const m = L.marker([h.lat, h.lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<b>${p.id}</b> — ${p.cliente}<br>${est.icon} ${est.label}<br>${h.fecha} ${h.hora}`);
        markersRef.current.push(m);
      });
    });
  }

  useEffect(() => { renderMarkers(ubicaciones, paquetes); }, [ubicaciones, paquetes]);

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #21262D", marginBottom: 16 }}>
      <div style={{ background: "#161B22", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>🗺️ Mapa en tiempo real</span>
        <span style={{ color: "#6B7280", fontSize: 12 }}>{ubicaciones.length} mensajero(s) activo(s) · actualiza cada 10s</span>
      </div>
      <div ref={mapRef} style={{ height: 400, background: "#0D1117" }} />
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [packages, setPackages]               = useState([]);
  const [mensajeros, setMensajeros]           = useState([]);
  const [ubicaciones, setUbicaciones]         = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [view, setView]                       = useState("dashboard");
  const [selectedPkg, setSelectedPkg]         = useState(null);
  const [scanInput, setScanInput]             = useState("");
  const [scanResult, setScanResult]           = useState(null);
  const [filterEstado, setFilterEstado]       = useState("todos");
  const [filterMensajero, setFilterMensajero] = useState("todos");
  const [toast, setToast]                     = useState(null);
  const [showNewPkg, setShowNewPkg]           = useState(false);
  const [showNewMsg, setShowNewMsg]           = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [gps, setGps]                         = useState(null);
  const [mensajeroActivo, setMensajeroActivo] = useState("");
  const [newPkgForm, setNewPkgForm] = useState({ cliente: "", direccion: "", mensajero_id: "", peso: "", prioridad: "normal" });
  const [newMsgForm, setNewMsgForm] = useState({ nombre: "", telefono: "" });
  const scanRef = useRef(null);
  const gpsIntervalRef = useRef(null);

  const isConfigured = SUPABASE_URL !== "https://TU_PROYECTO.supabase.co";

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (view === "scanner" && scanRef.current) scanRef.current.focus(); }, [view]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (view === "mapa") loadUbicaciones();
    }, 10000);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    if (!mensajeroActivo || view !== "scanner") return;
    function enviar() {
      navigator.geolocation?.getCurrentPosition(pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGps({ lat, lng });
        api.actualizarUbicacion(mensajeroActivo, lat, lng);
      }, null, { enableHighAccuracy: true, timeout: 8000 });
    }
    enviar();
    gpsIntervalRef.current = setInterval(enviar, 15000);
    return () => clearInterval(gpsIntervalRef.current);
  }, [mensajeroActivo, view]);

  async function loadAll() {
    setLoading(true);
    try {
      const [pkgs, msgs, ubs] = await Promise.all([api.getPaquetes(), api.getMensajeros(), api.getUbicaciones()]);
      const pkgsConHistorial = await Promise.all(pkgs.map(async p => ({ ...p, historial: await api.getHistorial(p.id) })));
      setPackages(pkgsConHistorial);
      setMensajeros(msgs);
      setUbicaciones(ubs);
      if (msgs.length && !newPkgForm.mensajero_id) setNewPkgForm(f => ({ ...f, mensajero_id: msgs[0].id }));
    } catch { showToast("Error conectando a Supabase", "err"); }
    setLoading(false);
  }

  async function loadUbicaciones() {
    try { setUbicaciones(await api.getUbicaciones()); } catch {}
  }

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function getGPS() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null), { timeout: 6000, enableHighAccuracy: true }
      );
    });
  }

  async function advanceState(pkg) {
    const nextEstado = ESTADOS[pkg.estado]?.next;
    if (!nextEstado) return;
    setSaving(true);
    const coords = await getGPS();
    try {
      await api.avanzarEstado(pkg.id, nextEstado, coords?.lat, coords?.lng);
      await loadAll();
      showToast(`→ ${ESTADOS[nextEstado].label} ${coords ? "📍" : ""}`);
    } catch { showToast("Error al actualizar", "err"); }
    setSaving(false);
  }

  async function handleScan(e) {
    if (e.key !== "Enter") return;
    const code = scanInput.trim().toUpperCase();
    if (!code) return;
    setSaving(true);
    try {
      const pkg = await api.getPaqueteByQR(code);
      setScanResult(pkg ? { pkg } : { notFound: true, code });
    } catch { showToast("Error al buscar", "err"); }
    setScanInput("");
    setSaving(false);
  }

  async function createPackage() {
    if (!newPkgForm.cliente || !newPkgForm.direccion) return;
    setSaving(true);
    try {
      await api.crearPaquete(newPkgForm);
      await loadAll();
      setShowNewPkg(false);
      setNewPkgForm({ cliente: "", direccion: "", mensajero_id: mensajeros[0]?.id || "", peso: "", prioridad: "normal" });
      showToast("Paquete creado ✓");
    } catch { showToast("Error al crear paquete", "err"); }
    setSaving(false);
  }

  async function createMensajero() {
    if (!newMsgForm.nombre) return;
    setSaving(true);
    try {
      await api.crearMensajero(newMsgForm.nombre, newMsgForm.telefono);
      await loadAll();
      setShowNewMsg(false);
      setNewMsgForm({ nombre: "", telefono: "" });
      showToast("Mensajero creado ✓");
    } catch { showToast("Error al crear mensajero", "err"); }
    setSaving(false);
  }

  async function openDetail(pkg) {
    const historial = await api.getHistorial(pkg.id);
    setSelectedPkg({ ...pkg, historial });
    setView("detail");
  }

  const filtered = packages.filter(p =>
    (filterEstado === "todos" || p.estado === filterEstado) &&
    (filterMensajero === "todos" || p.mensajero === filterMensajero)
  );

  const stats = {
    total: packages.length,
    recibido:  packages.filter(p => p.estado === "recibido").length,
    en_ruta:   packages.filter(p => p.estado === "en_ruta").length,
    entregado: packages.filter(p => p.estado === "entregado").length,
  };

  const mensajeroNames = [...new Set(packages.map(p => p.mensajero))];

  return (
    <div style={S.root}>
      {toast && <div style={{ ...S.toast, background: toast.type === "ok" ? "#10B981" : "#EF4444" }}>{toast.msg}</div>}
      {!isConfigured && (
        <div style={S.banner}>⚠️ <b>Configura Supabase:</b> edita <code>SUPABASE_URL</code> y <code>SUPABASE_KEY</code> al inicio del archivo con los datos de tu proyecto.</div>
      )}

      <nav style={S.nav}>
        <div style={S.navBrand}><span>⚡</span><span style={S.navTitle}>PackTrack</span></div>
        <div style={S.navTabs}>
          {[["dashboard","📊 Dashboard"],["mapa","🗺️ Mapa"],["scanner","📷 Escáner"],["mensajeros","👤 Mensajeros"]].map(([v,label]) => (
            <button key={v} onClick={() => { setView(v); setScanResult(null); }}
              style={{ ...S.navTab, ...(view === v ? S.navTabActive : {}) }}>{label}</button>
          ))}
        </div>
        <button style={S.refreshBtn} onClick={loadAll} disabled={loading}>{loading ? "⏳" : "🔄"}</button>
      </nav>

      {loading && <div style={S.loadingBar} />}

      {/* ── DASHBOARD ── */}
      {view === "dashboard" && (
        <div style={S.page}>
          <div style={S.statsRow}>
            {[["Total",stats.total,"#A78BFA"],["Recibidos",stats.recibido,"#F59E0B"],["En ruta",stats.en_ruta,"#3B82F6"],["Entregados",stats.entregado,"#10B981"]].map(([label,val,color]) => (
              <div key={label} style={{ ...S.statCard, borderTop: `3px solid ${color}` }}>
                <div style={{ ...S.statNum, color }}>{val}</div>
                <div style={S.statLabel}>{label}</div>
              </div>
            ))}
          </div>
          <div style={S.toolbar}>
            <div style={S.filters}>
              <select style={S.select} value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                <option value="todos">Todos los estados</option>
                <option value="recibido">Recibido</option>
                <option value="en_ruta">En ruta</option>
                <option value="entregado">Entregado</option>
              </select>
              <select style={S.select} value={filterMensajero} onChange={e => setFilterMensajero(e.target.value)}>
                <option value="todos">Todos los mensajeros</option>
                {mensajeroNames.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <button style={S.btnPrimary} onClick={() => setShowNewPkg(true)}>+ Nuevo paquete</button>
          </div>
          {showNewPkg && (
            <div style={S.formCard}>
              <div style={S.formTitle}>Registrar nuevo paquete</div>
              <div style={S.formGrid}>
                {[["cliente","Cliente"],["direccion","Dirección"],["peso","Peso (ej: 1.5kg)"]].map(([k,label]) => (
                  <label key={k} style={S.formLabel}>{label}
                    <input style={S.input} value={newPkgForm[k]} onChange={e => setNewPkgForm(p => ({ ...p, [k]: e.target.value }))} />
                  </label>
                ))}
                <label style={S.formLabel}>Mensajero
                  <select style={S.input} value={newPkgForm.mensajero_id} onChange={e => setNewPkgForm(p => ({ ...p, mensajero_id: e.target.value }))}>
                    {mensajeros.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </label>
                <label style={S.formLabel}>Prioridad
                  <select style={S.input} value={newPkgForm.prioridad} onChange={e => setNewPkgForm(p => ({ ...p, prioridad: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </label>
              </div>
              <div style={S.formActions}>
                <button style={S.btnSecondary} onClick={() => setShowNewPkg(false)}>Cancelar</button>
                <button style={S.btnPrimary} onClick={createPackage} disabled={saving || !newPkgForm.cliente}>
                  {saving ? "Guardando..." : "Crear paquete"}
                </button>
              </div>
            </div>
          )}
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr>{["ID","Cliente","Dirección","Mensajero","Prioridad","Estado","Acción"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(pkg => {
                  const est = ESTADOS[pkg.estado];
                  return (
                    <tr key={pkg.id} style={S.tr} onClick={() => openDetail(pkg)}>
                      <td style={S.td}><span style={S.pkgId}>{pkg.id}</span></td>
                      <td style={S.td}>{pkg.cliente}</td>
                      <td style={{ ...S.td, color: "#9CA3AF", fontSize: 12 }}>{pkg.direccion}</td>
                      <td style={S.td}>{pkg.mensajero}</td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: pkg.prioridad === "urgente" ? "rgba(239,68,68,0.15)" : "rgba(156,163,175,0.15)", color: pkg.prioridad === "urgente" ? "#EF4444" : "#9CA3AF" }}>
                          {pkg.prioridad === "urgente" ? "🔴 Urgente" : "Normal"}
                        </span>
                      </td>
                      <td style={S.td}><span style={{ ...S.badge, background: est.bg, color: est.color }}>{est.icon} {est.label}</span></td>
                      <td style={S.td} onClick={e => e.stopPropagation()}>
                        {est.next
                          ? <button style={S.btnAdvance} onClick={() => advanceState(pkg)} disabled={saving}>→ {ESTADOS[est.next].label}</button>
                          : <span style={{ color: "#4B5563", fontSize: 12 }}>Completo</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && <div style={S.empty}>No hay paquetes</div>}
          </div>
        </div>
      )}

      {/* ── MAPA ── */}
      {view === "mapa" && (
        <div style={S.page}>
          <MapaTracking ubicaciones={ubicaciones} paquetes={packages} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 12 }}>
            {mensajeros.map(m => {
              const ub = ubicaciones.find(u => u.mensajero_id === m.id);
              const pendientes = packages.filter(p => p.mensajero === m.nombre && p.estado !== "entregado").length;
              return (
                <div key={m.id} style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700 }}>🚴 {m.nombre}</span>
                    <span style={{ ...S.badge, background: ub ? "rgba(16,185,129,0.15)" : "rgba(107,114,128,0.15)", color: ub ? "#10B981" : "#6B7280", fontSize: 11 }}>
                      {ub ? "● En línea" : "○ Sin GPS"}
                    </span>
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: 12 }}>{pendientes} paquete(s) pendiente(s)</div>
                  {ub && <div style={{ color: "#6B7280", fontSize: 11, marginTop: 4 }}>📍 {ub.lat?.toFixed(4)}, {ub.lng?.toFixed(4)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SCANNER ── */}
      {view === "scanner" && (
        <div style={S.page}>
          <div style={S.scannerContainer}>
            <div style={S.scannerCard}>
              <div style={{ fontSize: 40 }}>📷</div>
              <div style={S.scannerTitle}>Escáner de mensajero</div>
              <div style={{ width: "100%", background: "#0D1117", borderRadius: 8, padding: 12, border: "1px solid #21262D" }}>
                <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>¿Quién eres?</div>
                <select style={{ ...S.input, width: "100%" }} value={mensajeroActivo} onChange={e => setMensajeroActivo(e.target.value)}>
                  <option value="">-- Selecciona tu nombre --</option>
                  {mensajeros.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                {mensajeroActivo && gps && <div style={{ color: "#10B981", fontSize: 12, marginTop: 6 }}>📍 GPS activo — ubicación enviada al mapa</div>}
                {mensajeroActivo && !gps && <div style={{ color: "#F59E0B", fontSize: 12, marginTop: 6 }}>⏳ Obteniendo GPS... acepta el permiso de ubicación</div>}
              </div>
              <div style={S.scanBox}>
                <div style={S.sc1}/><div style={S.sc2}/><div style={S.sc3}/><div style={S.sc4}/>
                <div style={{ color: "#4B5563", fontSize: 13 }}>Apunta la cámara al QR</div>
              </div>
              <div style={S.manualRow}>
                <input ref={scanRef} style={S.scanInput} placeholder="Ej: PKG-002"
                  value={scanInput} onChange={e => setScanInput(e.target.value.toUpperCase())}
                  onKeyDown={handleScan} />
                <button style={S.btnPrimary} onClick={() => handleScan({ key: "Enter" })} disabled={saving}>
                  {saving ? "..." : "Buscar"}
                </button>
              </div>
              <div style={{ color: "#6B7280", fontSize: 12 }}>Presiona Enter o el botón para buscar</div>
              {scanResult && !scanResult.notFound && (() => {
                const pkg = scanResult.pkg;
                const est = ESTADOS[pkg.estado];
                return (
                  <div style={S.scanResult}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={S.pkgId}>{pkg.id}</span>
                      <span style={{ ...S.badge, background: est.bg, color: est.color }}>{est.icon} {est.label}</span>
                    </div>
                    <div style={S.scanRow}><b>Cliente:</b> {pkg.cliente}</div>
                    <div style={S.scanRow}><b>Dirección:</b> {pkg.direccion}</div>
                    <div style={S.scanRow}><b>Mensajero:</b> {pkg.mensajero}</div>
                    {pkg.historial?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>Historial</div>
                        {pkg.historial.map((h, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #21262D", fontSize: 13 }}>
                            <span style={{ color: ESTADOS[h.estado].color }}>{ESTADOS[h.estado].icon} {ESTADOS[h.estado].label} {h.lat ? "📍" : ""}</span>
                            <span style={{ color: "#6B7280", fontSize: 12 }}>{h.fecha} {h.hora}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {est.next && (
                      <button style={{ ...S.btnPrimary, width: "100%", marginTop: 14, justifyContent: "center" }}
                        onClick={async () => { await advanceState(pkg); const updated = await api.getPaqueteByQR(pkg.qr); setScanResult({ pkg: updated }); }}
                        disabled={saving}>
                        Marcar como {ESTADOS[est.next].label} {ESTADOS[est.next].icon}
                      </button>
                    )}
                    {!est.next && <div style={{ textAlign: "center", color: "#10B981", marginTop: 12, fontWeight: 600 }}>✅ Entregado</div>}
                  </div>
                );
              })()}
              {scanResult?.notFound && (
                <div style={{ ...S.scanResult, borderColor: "#EF4444" }}>
                  <div style={{ color: "#EF4444", fontWeight: 600 }}>❌ Paquete no encontrado</div>
                  <div style={{ color: "#9CA3AF", fontSize: 13 }}>Código: {scanResult.code}</div>
                </div>
              )}
            </div>
            <div style={S.messengerList}>
              <div style={S.messengerTitle}>PENDIENTES HOY</div>
              {packages.filter(p => p.estado !== "entregado").map(pkg => {
                const est = ESTADOS[pkg.estado];
                return (
                  <div key={pkg.id} style={S.messengerCard} onClick={() => setScanResult({ pkg })}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={S.pkgId}>{pkg.id}</span>
                      <span style={{ ...S.badge, background: est.bg, color: est.color, fontSize: 11 }}>{est.icon} {est.label}</span>
                    </div>
                    <div style={{ color: "#D1D5DB", fontSize: 13, marginTop: 4 }}>{pkg.cliente}</div>
                    <div style={{ color: "#6B7280", fontSize: 12 }}>{pkg.direccion}</div>
                  </div>
                );
              })}
              {packages.filter(p => p.estado !== "entregado").length === 0 && (
                <div style={{ color: "#4B5563", textAlign: "center", marginTop: 20 }}>Todo entregado 🎉</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MENSAJEROS ── */}
      {view === "mensajeros" && (
        <div style={S.page}>
          <div style={S.toolbar}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>👤 Gestión de mensajeros</div>
            <button style={S.btnPrimary} onClick={() => setShowNewMsg(true)}>+ Nuevo mensajero</button>
          </div>
          {showNewMsg && (
            <div style={S.formCard}>
              <div style={S.formTitle}>Agregar mensajero</div>
              <div style={S.formGrid}>
                <label style={S.formLabel}>Nombre completo
                  <input style={S.input} value={newMsgForm.nombre} placeholder="Ej: Carlos Pérez"
                    onChange={e => setNewMsgForm(p => ({ ...p, nombre: e.target.value }))} />
                </label>
                <label style={S.formLabel}>Teléfono
                  <input style={S.input} value={newMsgForm.telefono} placeholder="Ej: 3001234567"
                    onChange={e => setNewMsgForm(p => ({ ...p, telefono: e.target.value }))} />
                </label>
              </div>
              <div style={S.formActions}>
                <button style={S.btnSecondary} onClick={() => setShowNewMsg(false)}>Cancelar</button>
                <button style={S.btnPrimary} onClick={createMensajero} disabled={saving || !newMsgForm.nombre}>
                  {saving ? "Guardando..." : "Crear mensajero"}
                </button>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 16 }}>
            {mensajeros.map(m => {
              const ub = ubicaciones.find(u => u.mensajero_id === m.id);
              const total      = packages.filter(p => p.mensajero === m.nombre).length;
              const entregados = packages.filter(p => p.mensajero === m.nombre && p.estado === "entregado").length;
              const pendientes = packages.filter(p => p.mensajero === m.nombre && p.estado !== "entregado").length;
              return (
                <div key={m.id} style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>🚴 {m.nombre}</div>
                      {m.telefono && <div style={{ color: "#6B7280", fontSize: 13 }}>📱 {m.telefono}</div>}
                    </div>
                    <span style={{ ...S.badge, background: ub ? "rgba(16,185,129,0.15)" : "rgba(107,114,128,0.15)", color: ub ? "#10B981" : "#6B7280", fontSize: 11 }}>
                      {ub ? "● En línea" : "○ Offline"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[["Total",total,"#A78BFA"],["Entregados",entregados,"#10B981"],["Pendientes",pendientes,"#F59E0B"]].map(([l,v,c]) => (
                      <div key={l} style={{ background: "#0D1117", borderRadius: 6, padding: "8px 4px", textAlign: "center" }}>
                        <div style={{ color: c, fontWeight: 700, fontSize: 20 }}>{v}</div>
                        <div style={{ color: "#6B7280", fontSize: 11 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <button style={{ ...S.btnSecondary, width: "100%", fontSize: 12 }}
                    onClick={() => { if (window.confirm(`¿Desactivar a ${m.nombre}?`)) api.desactivarMensajero(m.id).then(loadAll); }}>
                    Desactivar mensajero
                  </button>
                </div>
              );
            })}
            {mensajeros.length === 0 && <div style={S.empty}>No hay mensajeros. Crea el primero.</div>}
          </div>
        </div>
      )}

      {/* ── DETAIL ── */}
      {view === "detail" && selectedPkg && (() => {
        const pkg = selectedPkg;
        const est = ESTADOS[pkg.estado];
        return (
          <div style={S.page}>
            <button style={S.backBtn} onClick={() => setView("dashboard")}>← Volver</button>
            <div style={S.detailCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>{pkg.id}</div>
                  <div style={{ color: "#9CA3AF", fontSize: 14 }}>{pkg.cliente}</div>
                </div>
                <span style={{ ...S.badge, background: est.bg, color: est.color, fontSize: 14, padding: "6px 14px" }}>{est.icon} {est.label}</span>
              </div>
              <div style={S.detailGrid}>
                {[["📍 Dirección",pkg.direccion],["🚴 Mensajero",pkg.mensajero],["⚖️ Peso",pkg.peso||"—"],["🔖 Prioridad",pkg.prioridad]].map(([k,v]) => (
                  <div key={k} style={{ background: "#0D1117", borderRadius: 8, padding: 12 }}>
                    <div style={{ color: "#6B7280", fontSize: 12 }}>{k}</div>
                    <div style={{ color: "#F3F4F6", fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <div style={{ color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 12 }}>HISTORIAL</div>
                {(pkg.historial || []).map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 14 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: ESTADOS[h.estado].color, flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <span style={{ color: ESTADOS[h.estado].color, fontWeight: 600 }}>{ESTADOS[h.estado].icon} {ESTADOS[h.estado].label}</span>
                      <span style={{ color: "#6B7280", fontSize: 12, marginLeft: 8 }}>{h.fecha} {h.hora}</span>
                      {h.lat && <div style={{ color: "#4B5563", fontSize: 11, marginTop: 2 }}>📍 {h.lat?.toFixed(5)}, {h.lng?.toFixed(5)}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {est.next && (
                <button style={{ ...S.btnPrimary, marginTop: 20, width: "100%", justifyContent: "center", padding: "12px" }}
                  onClick={async () => { await advanceState(pkg); const h = await api.getHistorial(pkg.id); setSelectedPkg(p => ({ ...p, estado: ESTADOS[p.estado].next, historial: h })); }}
                  disabled={saving}>
                  Avanzar a → {ESTADOS[est.next].icon} {ESTADOS[est.next].label}
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const S = {
  root: { minHeight: "100vh", background: "#0D1117", color: "#F3F4F6", fontFamily: "'Courier New', monospace" },
  toast: { position: "fixed", top: 16, right: 16, zIndex: 999, padding: "10px 20px", borderRadius: 8, color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" },
  banner: { background: "#1C1917", borderBottom: "1px solid #F59E0B", color: "#F59E0B", padding: "10px 24px", fontSize: 13 },
  loadingBar: { height: 3, background: "linear-gradient(90deg, #A78BFA, #3B82F6)" },
  nav: { background: "#161B22", borderBottom: "1px solid #21262D", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56, gap: 8 },
  navBrand: { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 18, letterSpacing: 2 },
  navTitle: { color: "#F3F4F6" },
  navTabs: { display: "flex", gap: 4, flexWrap: "wrap" },
  navTab: { background: "none", border: "none", color: "#6B7280", cursor: "pointer", padding: "8px 12px", borderRadius: 6, fontSize: 13, fontFamily: "inherit" },
  navTabActive: { background: "#21262D", color: "#F3F4F6" },
  refreshBtn: { background: "#21262D", border: "none", color: "#9CA3AF", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "inherit" },
  page: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 },
  statCard: { background: "#161B22", borderRadius: 10, padding: "16px 20px" },
  statNum: { fontSize: 32, fontWeight: 700, lineHeight: 1 },
  statLabel: { color: "#6B7280", fontSize: 13, marginTop: 4 },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" },
  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  select: { background: "#161B22", border: "1px solid #21262D", color: "#F3F4F6", padding: "8px 12px", borderRadius: 6, fontSize: 13, fontFamily: "inherit", cursor: "pointer" },
  formCard: { background: "#161B22", border: "1px solid #21262D", borderRadius: 12, padding: 20, marginBottom: 20 },
  formTitle: { fontWeight: 700, fontSize: 15, marginBottom: 16 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 12 },
  formLabel: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#9CA3AF" },
  input: { background: "#0D1117", border: "1px solid #30363D", borderRadius: 6, color: "#F3F4F6", padding: "8px 10px", fontSize: 14, fontFamily: "inherit" },
  formActions: { display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" },
  tableWrap: { background: "#161B22", borderRadius: 12, overflow: "auto", border: "1px solid #21262D" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "12px 16px", textAlign: "left", color: "#6B7280", fontSize: 12, borderBottom: "1px solid #21262D", whiteSpace: "nowrap" },
  tr: { cursor: "pointer" },
  td: { padding: "12px 16px", fontSize: 14, borderBottom: "1px solid #0D1117" },
  empty: { textAlign: "center", padding: 32, color: "#4B5563" },
  pkgId: { background: "#21262D", color: "#A78BFA", padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 1 },
  badge: { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  btnPrimary: { background: "#A78BFA", color: "#0D1117", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 },
  btnSecondary: { background: "#21262D", color: "#F3F4F6", border: "1px solid #30363D", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  btnAdvance: { background: "rgba(59,130,246,0.15)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.3)", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 },
  scannerContainer: { display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 },
  scannerCard: { background: "#161B22", border: "1px solid #21262D", borderRadius: 14, padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  scannerTitle: { fontWeight: 700, fontSize: 20 },
  scanBox: { width: 200, height: 140, border: "1px solid #21262D", borderRadius: 8, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D1117" },
  sc1: { position: "absolute", top: 8, left: 8, width: 20, height: 20, borderTop: "3px solid #A78BFA", borderLeft: "3px solid #A78BFA" },
  sc2: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderTop: "3px solid #A78BFA", borderRight: "3px solid #A78BFA" },
  sc3: { position: "absolute", bottom: 8, left: 8, width: 20, height: 20, borderBottom: "3px solid #A78BFA", borderLeft: "3px solid #A78BFA" },
  sc4: { position: "absolute", bottom: 8, right: 8, width: 20, height: 20, borderBottom: "3px solid #A78BFA", borderRight: "3px solid #A78BFA" },
  manualRow: { display: "flex", gap: 8, width: "100%" },
  scanInput: { flex: 1, background: "#0D1117", border: "1px solid #30363D", borderRadius: 6, color: "#F3F4F6", padding: "10px 12px", fontSize: 15, fontFamily: "inherit", letterSpacing: 2 },
  scanResult: { width: "100%", background: "#0D1117", border: "1px solid #30363D", borderRadius: 10, padding: 16, marginTop: 4 },
  scanRow: { color: "#D1D5DB", fontSize: 13, marginBottom: 4 },
  messengerList: { background: "#161B22", border: "1px solid #21262D", borderRadius: 14, padding: 16, overflow: "auto", maxHeight: "calc(100vh - 140px)" },
  messengerTitle: { fontWeight: 700, marginBottom: 12, color: "#6B7280", fontSize: 11, letterSpacing: 2 },
  messengerCard: { background: "#0D1117", borderRadius: 8, padding: 12, marginBottom: 8, cursor: "pointer", border: "1px solid #21262D" },
  backBtn: { background: "none", border: "none", color: "#A78BFA", cursor: "pointer", fontSize: 14, fontFamily: "inherit", marginBottom: 16, padding: 0 },
  detailCard: { background: "#161B22", border: "1px solid #21262D", borderRadius: 14, padding: 28, maxWidth: 640 },
  detailGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
};
