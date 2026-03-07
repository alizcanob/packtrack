import { useState, useEffect, useRef } from "react";

// ─── CONFIGURACIÓN SUPABASE ──────────────────────────────────────────────────
// 1. Ve a supabase.com > tu proyecto > Settings > API
// 2. Copia "Project URL" y "anon public key"
const SUPABASE_URL = "https://ntognnxsstmbyfptwhsb.supabase.co";       // ← cambia esto
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50b2dubnhzc3RtYnlmcHR3aHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg3OTUsImV4cCI6MjA4ODQ5NDc5NX0.2MYhpK-MQTTwlpWWYkV0nTTbU-SVUeqCnjXXOU8GMHs";                            // ← cambia esto

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation",
};

// ─── API HELPERS ─────────────────────────────────────────────────────────────
const api = {
  async getPaquetes() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/paquetes?select=*,mensajeros(nombre)&order=created_at.desc`,
      { headers }
    );
    const data = await res.json();
    return data.map(p => ({ ...p, mensajero: p.mensajeros?.nombre || "Sin asignar" }));
  },

  async getMensajeros() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/mensajeros?select=*&activo=eq.true`,
      { headers }
    );
    return res.json();
  },

  async getHistorial(paqueteId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/historial?paquete_id=eq.${paqueteId}&order=created_at.asc`,
      { headers }
    );
    return res.json();
  },

  async getPaqueteByQR(qr) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/paquetes?qr=eq.${qr}&select=*,mensajeros(nombre)`,
      { headers }
    );
    const data = await res.json();
    if (!data.length) return null;
    const p = data[0];
    p.mensajero = p.mensajeros?.nombre || "Sin asignar";
    p.historial = await api.getHistorial(p.id);
    return p;
  },

  async crearPaquete(pkg) {
    // Generar ID correlativo
    const countRes = await fetch(`${SUPABASE_URL}/rest/v1/paquetes?select=id`, { headers });
    const all = await countRes.json();
    const id = `PKG-${String(all.length + 1).padStart(3, "0")}`;
    const { hora, fecha } = nowStr();

    const res = await fetch(`${SUPABASE_URL}/rest/v1/paquetes`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id, qr: id, ...pkg }),
    });
    const created = await res.json();

    // Insertar primer historial
    await api.agregarHistorial(id, "recibido", hora, fecha);
    return created[0];
  },

  async avanzarEstado(paqueteId, nuevoEstado) {
    const { hora, fecha } = nowStr();

    await fetch(`${SUPABASE_URL}/rest/v1/paquetes?id=eq.${paqueteId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ estado: nuevoEstado }),
    });

    await api.agregarHistorial(paqueteId, nuevoEstado, hora, fecha);
  },

  async agregarHistorial(paqueteId, estado, hora, fecha) {
    await fetch(`${SUPABASE_URL}/rest/v1/historial`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paquete_id: paqueteId, estado, hora, fecha }),
    });
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [packages, setPackages]       = useState([]);
  const [mensajeros, setMensajeros]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [view, setView]               = useState("dashboard");
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [scanInput, setScanInput]     = useState("");
  const [scanResult, setScanResult]   = useState(null);
  const [filterEstado, setFilterEstado]       = useState("todos");
  const [filterMensajero, setFilterMensajero] = useState("todos");
  const [toast, setToast]             = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [newPkgForm, setNewPkgForm]   = useState({ cliente: "", direccion: "", mensajero_id: "", peso: "", prioridad: "normal" });
  const scanRef = useRef(null);

  // ── Carga inicial ──
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (view === "scanner" && scanRef.current) scanRef.current.focus(); }, [view]);

  async function loadAll() {
    setLoading(true);
    try {
      const [pkgs, msgs] = await Promise.all([api.getPaquetes(), api.getMensajeros()]);
      setPackages(pkgs);
      setMensajeros(msgs);
      if (msgs.length) setNewPkgForm(f => ({ ...f, mensajero_id: msgs[0].id }));
    } catch (e) {
      showToast("Error conectando a Supabase. Verifica las credenciales.", "err");
    }
    setLoading(false);
  }

  function showToast(msg, type = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function advanceState(pkg) {
    const nextEstado = ESTADOS[pkg.estado]?.next;
    if (!nextEstado) return;
    setSaving(true);
    try {
      await api.avanzarEstado(pkg.id, nextEstado);
      await loadAll();
      showToast(`Estado actualizado → ${ESTADOS[nextEstado].label} ✓`);
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
    } catch { showToast("Error al buscar paquete", "err"); }
    setScanInput("");
    setSaving(false);
  }

  async function createPackage() {
    if (!newPkgForm.cliente || !newPkgForm.direccion) return;
    setSaving(true);
    try {
      await api.crearPaquete(newPkgForm);
      await loadAll();
      setShowNewForm(false);
      setNewPkgForm({ cliente: "", direccion: "", mensajero_id: mensajeros[0]?.id || "", peso: "", prioridad: "normal" });
      showToast("Paquete creado ✓");
    } catch { showToast("Error al crear paquete", "err"); }
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

  // ── CONFIGURED? ──
  const isConfigured = SUPABASE_URL !== "https://TU_PROYECTO.supabase.co";

  return (
    <div style={S.root}>
      {toast && <div style={{ ...S.toast, background: toast.type === "ok" ? "#10B981" : "#EF4444" }}>{toast.msg}</div>}

      {/* BANNER de configuración */}
      {!isConfigured && (
        <div style={S.banner}>
          ⚠️ <strong>Configura Supabase:</strong> edita <code>SUPABASE_URL</code> y <code>SUPABASE_KEY</code> al inicio del archivo con los datos de tu proyecto.
        </div>
      )}

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.navBrand}><span>⚡</span><span style={S.navTitle}>PackTrack</span></div>
        <div style={S.navTabs}>
          {[["dashboard","📊 Dashboard"],["scanner","📷 Escáner"]].map(([v,label]) => (
            <button key={v} onClick={() => { setView(v); setScanResult(null); }}
              style={{ ...S.navTab, ...(view === v ? S.navTabActive : {}) }}>{label}</button>
          ))}
        </div>
        <button style={S.refreshBtn} onClick={loadAll} disabled={loading}>
          {loading ? "⏳" : "🔄"} Actualizar
        </button>
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
            <button style={S.btnPrimary} onClick={() => setShowNewForm(true)}>+ Nuevo paquete</button>
          </div>

          {showNewForm && (
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
                <button style={S.btnSecondary} onClick={() => setShowNewForm(false)}>Cancelar</button>
                <button style={S.btnPrimary} onClick={createPackage} disabled={saving || !newPkgForm.cliente || !newPkgForm.direccion}>
                  {saving ? "Guardando..." : "Crear paquete"}
                </button>
              </div>
            </div>
          )}

          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>{["ID","Cliente","Dirección","Mensajero","Prioridad","Estado","Acción"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
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
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: est.bg, color: est.color }}>{est.icon} {est.label}</span>
                      </td>
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

      {/* ── SCANNER ── */}
      {view === "scanner" && (
        <div style={S.page}>
          <div style={S.scannerContainer}>
            <div style={S.scannerCard}>
              <div style={{ fontSize: 40 }}>📷</div>
              <div style={S.scannerTitle}>Escáner de mensajero</div>
              <div style={S.scannerSub}>Escanea el QR o escribe el ID del paquete</div>
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

              {/* Resultado del scan */}
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
                    {pkg.peso && <div style={S.scanRow}><b>Peso:</b> {pkg.peso}</div>}
                    {pkg.historial?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 6 }}>Historial</div>
                        {pkg.historial.map((h, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #21262D", fontSize: 13 }}>
                            <span style={{ color: ESTADOS[h.estado].color }}>{ESTADOS[h.estado].icon} {ESTADOS[h.estado].label}</span>
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
                    {!est.next && <div style={{ textAlign: "center", color: "#10B981", marginTop: 12, fontWeight: 600 }}>✅ Paquete entregado</div>}
                  </div>
                );
              })()}
              {scanResult?.notFound && (
                <div style={{ ...S.scanResult, borderColor: "#EF4444" }}>
                  <div style={{ color: "#EF4444", fontWeight: 600 }}>❌ Paquete no encontrado</div>
                  <div style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>Código: {scanResult.code}</div>
                </div>
              )}
            </div>

            <div style={S.messengerList}>
              <div style={S.messengerTitle}>PENDIENTES HOY</div>
              {packages.filter(p => p.estado !== "entregado").map(pkg => {
                const est = ESTADOS[pkg.estado];
                return (
                  <div key={pkg.id} style={S.messengerCard} onClick={() => setScanResult({ pkg: { ...pkg, historial: [] } })}>
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
                <div style={{ color: "#6B7280", fontSize: 12, letterSpacing: 1, marginBottom: 12 }}>HISTORIAL DE ESTADOS</div>
                {(pkg.historial || []).map((h, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, position: "relative" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: ESTADOS[h.estado].color, flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <span style={{ color: ESTADOS[h.estado].color, fontWeight: 600 }}>{ESTADOS[h.estado].icon} {ESTADOS[h.estado].label}</span>
                      <span style={{ color: "#6B7280", fontSize: 12, marginLeft: 8 }}>{h.fecha} a las {h.hora}</span>
                    </div>
                  </div>
                ))}
              </div>
              {est.next && (
                <button style={{ ...S.btnPrimary, marginTop: 20, width: "100%", justifyContent: "center", padding: "12px" }}
                  onClick={async () => { await advanceState(pkg); const updated = await api.getHistorial(pkg.id); setSelectedPkg(p => ({ ...p, estado: ESTADOS[p.estado].next, historial: updated })); }}
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

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  root: { minHeight: "100vh", background: "#0D1117", color: "#F3F4F6", fontFamily: "'Courier New', monospace" },
  toast: { position: "fixed", top: 16, right: 16, zIndex: 999, padding: "10px 20px", borderRadius: 8, color: "#fff", fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" },
  banner: { background: "#1C1917", borderBottom: "1px solid #F59E0B", color: "#F59E0B", padding: "10px 24px", fontSize: 13 },
  loadingBar: { height: 3, background: "linear-gradient(90deg, #A78BFA, #3B82F6)", animation: "none" },
  nav: { background: "#161B22", borderBottom: "1px solid #21262D", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 56 },
  navBrand: { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 18, letterSpacing: 2 },
  navTitle: { color: "#F3F4F6" },
  navTabs: { display: "flex", gap: 4 },
  navTab: { background: "none", border: "none", color: "#6B7280", cursor: "pointer", padding: "8px 16px", borderRadius: 6, fontSize: 14, fontFamily: "inherit" },
  navTabActive: { background: "#21262D", color: "#F3F4F6" },
  refreshBtn: { background: "#21262D", border: "none", color: "#9CA3AF", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" },
  page: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 },
  statCard: { background: "#161B22", borderRadius: 10, padding: "16px 20px" },
  statNum: { fontSize: 32, fontWeight: 700, lineHeight: 1 },
  statLabel: { color: "#6B7280", fontSize: 13, marginTop: 4 },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" },
  filters: { display: "flex", gap: 8 },
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
  scannerSub: { color: "#6B7280", fontSize: 13, textAlign: "center" },
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
