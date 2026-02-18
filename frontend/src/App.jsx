import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

export default function App() {
  const API_BASE = "http://127.0.0.1:8080";

  // Request builder state
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://httpbin.org/get");
  const [selectedEnvId, setSelectedEnvId] = useState("");
  const [activeTab, setActiveTab] = useState("headers"); // headers | params | body

  // KV editors
  const [headerRows, setHeaderRows] = useState([{ key: "Accept", value: "application/json", enabled: true }]);
  const [paramRows, setParamRows] = useState([{ key: "", value: "", enabled: true }]);

  // Body editor
  const [bodyText, setBodyText] = useState("{}");

  // Response
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  // cURL
  const [curlText, setCurlText] = useState("");
  const [copied, setCopied] = useState(false);

  // Saved + history + envs
  const [savedRequests, setSavedRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [envs, setEnvs] = useState([]);
  const [savingName, setSavingName] = useState("");

  // Env modal
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [envName, setEnvName] = useState("");
  const [envVarsText, setEnvVarsText] = useState('{"base_url":"https://httpbin.org","token":"ABC123"}');
  const [creatingEnv, setCreatingEnv] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, text: "", kind: "ok" }); // ok | warn | err
  const toastTimer = useRef(null);

  // Import input
  const importInputRef = useRef(null);

  const isBodyMethod = useMemo(() => ["POST", "PUT", "PATCH"].includes(method), [method]);

  // ---------- helpers ----------
  const showToast = (text, kind = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ show: true, text, kind });
    toastTimer.current = setTimeout(() => setToast({ show: false, text: "", kind: "ok" }), 1800);
  };

  const safeParseJson = (label, text) => {
    const t = (text ?? "").trim();
    if (!t) return { ok: true, value: {} };
    try {
      return { ok: true, value: JSON.parse(t) };
    } catch {
      return { ok: false, value: null, error: `${label} must be valid JSON` };
    }
  };

  const rowsToObject = (rows) => {
    const out = {};
    for (const r of rows || []) {
      if (!r || r.enabled === false) continue;
      const k = (r.key || "").trim();
      if (!k) continue;
      out[k] = String(r.value ?? "");
    }
    return out;
  };

  const objectToRows = (obj) => {
    const o = obj && typeof obj === "object" ? obj : {};
    const rows = Object.entries(o).map(([k, v]) => ({ key: k, value: String(v), enabled: true }));
    return rows.length ? rows : [{ key: "", value: "", enabled: true }];
  };

  const normalizeRows = (rows) => {
    const r = Array.isArray(rows) ? rows : [];
    if (!r.length) return [{ key: "", value: "", enabled: true }];
    return r;
  };

  const statusBadge = (code) => {
    if (!code) return { bg: "#1f2937", fg: "#e5e7eb", text: "—" };
    if (code >= 200 && code < 300) return { bg: "#064e3b", fg: "#d1fae5", text: code };
    if (code >= 300 && code < 400) return { bg: "#1d4ed8", fg: "#dbeafe", text: code };
    if (code >= 400 && code < 500) return { bg: "#9a3412", fg: "#ffedd5", text: code };
    return { bg: "#991b1b", fg: "#fee2e2", text: code };
  };

  // ---------- load data ----------
  const loadSaved = async () => {
    const res = await axios.get(`${API_BASE}/requests`);
    setSavedRequests(res.data || []);
  };

  const loadHistory = async () => {
    const res = await axios.get(`${API_BASE}/history`);
    setHistory(res.data || []);
  };

  const loadEnvs = async () => {
    const res = await axios.get(`${API_BASE}/environments`);
    setEnvs(res.data || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadSaved(), loadHistory(), loadEnvs()]);
      } catch (e) {
        setError(e?.message || "Failed to load data");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- actions ----------
  const send = async () => {
    setError("");
    setResponse(null);
    setCopied(false);

    const headersObj = rowsToObject(headerRows);
    const paramsObj = rowsToObject(paramRows);

    const bodyParsed = safeParseJson("Body", bodyText);
    if (!bodyParsed.ok) return setError(bodyParsed.error);

    setSending(true);
    try {
      const res = await axios.post(`${API_BASE}/send`, {
        method,
        url,
        headers: headersObj,
        params: paramsObj,
        body: isBodyMethod ? bodyParsed.value : null,
        environment_id: selectedEnvId ? Number(selectedEnvId) : null,
      });
      setResponse(res.data);
      await loadHistory();
      showToast("Request sent", "ok");
    } catch (e) {
      setError(e?.message || "Request failed");
      showToast("Request failed", "err");
    } finally {
      setSending(false);
    }
  };

  const buildCurl = async () => {
    setError("");
    setCopied(false);

    const headersObj = rowsToObject(headerRows);
    const paramsObj = rowsToObject(paramRows);

    const bodyParsed = safeParseJson("Body", bodyText);
    if (!bodyParsed.ok) return setError(bodyParsed.error);

    try {
      const res = await axios.post(`${API_BASE}/curl`, {
        method,
        url,
        headers: headersObj,
        params: paramsObj,
        body: isBodyMethod ? bodyParsed.value : null,
        environment_id: selectedEnvId ? Number(selectedEnvId) : null,
      });
      setCurlText(res.data.curl || "");
      showToast("cURL generated", "ok");
    } catch (e) {
      setError(e?.message || "Failed to generate cURL");
      showToast("cURL failed", "err");
    }
  };

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlText);
      setCopied(true);
      showToast("Copied", "ok");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError("Clipboard permission blocked. Copy manually.");
      showToast("Copy blocked", "warn");
    }
  };

  const saveCurrent = async () => {
    setError("");

    const headersObj = rowsToObject(headerRows);
    const bodyParsed = safeParseJson("Body", bodyText);
    if (!bodyParsed.ok) return setError(bodyParsed.error);

    const name = (savingName || "").trim() || url;

    try {
      await axios.post(`${API_BASE}/requests`, {
        name,
        method,
        url,
        headers: headersObj,
        body: bodyParsed.value,
      });
      setSavingName("");
      await loadSaved();
      showToast("Saved request", "ok");
    } catch (e) {
      setError(e?.message || "Failed to save request");
      showToast("Save failed", "err");
    }
  };

  const createEnv = async () => {
    setError("");
    const varsParsed = safeParseJson("Environment variables", envVarsText);
    if (!varsParsed.ok) return setError(varsParsed.error);

    const name = envName.trim();
    if (!name) return setError("Environment name is required");

    setCreatingEnv(true);
    try {
      await axios.post(`${API_BASE}/environments`, {
        name,
        variables: varsParsed.value,
      });
      setShowEnvModal(false);
      setEnvName("");
      await loadEnvs();
      showToast("Environment created", "ok");
    } catch (e) {
      setError(e?.message || "Failed to create environment");
      showToast("Env create failed", "err");
    } finally {
      setCreatingEnv(false);
    }
  };

  const loadIntoBuilder = (r) => {
    setMethod((r.method || "GET").toUpperCase());
    setUrl(r.url || "");
    setHeaderRows(objectToRows(r.headers || {}));
    setBodyText(JSON.stringify(r.body || {}, null, 2));
    setResponse(null);
    setError("");
    showToast("Loaded request", "ok");
  };

  // ---------- export/import ----------
  const exportData = async () => {
    setError("");
    try {
      const [reqRes, envRes] = await Promise.all([
        axios.get(`${API_BASE}/requests`),
        axios.get(`${API_BASE}/environments`),
      ]);

      const payload = {
        exported_at: new Date().toISOString(),
        version: 1,
        environments: envRes.data || [],
        requests: (reqRes.data || []).map((r) => ({
          ...r,
          // include extra fields from UI for portability (not stored in backend)
          _meta: { note: "params are not persisted in backend yet" },
        })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `api-toolbox-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      showToast("Exported JSON", "ok");
    } catch (e) {
      setError(e?.message || "Export failed");
      showToast("Export failed", "err");
    }
  };

  const triggerImport = () => {
    setError("");
    if (importInputRef.current) importInputRef.current.click();
  };

  const importData = async (file) => {
    setError("");
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const envsIn = Array.isArray(parsed.environments) ? parsed.environments : [];
      const reqsIn = Array.isArray(parsed.requests) ? parsed.requests : [];

      // Create envs first
      for (const e of envsIn) {
        const name = (e?.name || "").trim();
        const variables = e?.variables && typeof e.variables === "object" ? e.variables : {};
        if (!name) continue;
        await axios.post(`${API_BASE}/environments`, { name, variables });
      }

      // Create requests
      for (const r of reqsIn) {
        const name = (r?.name || "").trim();
        const methodIn = (r?.method || "GET").toUpperCase();
        const urlIn = r?.url || "";
        const headers = r?.headers && typeof r.headers === "object" ? r.headers : {};
        const body = r?.body && typeof r.body === "object" ? r.body : {};
        if (!name || !urlIn) continue;
        await axios.post(`${API_BASE}/requests`, { name, method: methodIn, url: urlIn, headers, body });
      }

      await Promise.all([loadEnvs(), loadSaved()]);
      showToast("Imported successfully", "ok");
    } catch (e) {
      setError(e?.message || "Import failed (invalid JSON?)");
      showToast("Import failed", "err");
    }
  };

  // ---------- UI components ----------
  const KVTable = ({ rows, setRows, placeholderKey, placeholderValue }) => {
    const addRow = () => setRows(normalizeRows([...rows, { key: "", value: "", enabled: true }]));
    const removeRow = (idx) => setRows(normalizeRows(rows.filter((_, i) => i !== idx)));
    const toggle = (idx) =>
      setRows(
        rows.map((r, i) => (i === idx ? { ...r, enabled: r.enabled === false ? true : false } : r))
      );
    const update = (idx, field, value) =>
      setRows(rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

    return (
      <div style={{ border: "1px solid #243040", borderRadius: 12, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "34px 1fr 1fr 40px",
            background: "#0b1220",
            borderBottom: "1px solid #243040",
            padding: "10px 10px",
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          <div></div>
          <div>Key</div>
          <div>Value</div>
          <div></div>
        </div>

        <div style={{ maxHeight: 260, overflow: "auto", background: "#0f172a" }}>
          {rows.map((r, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "34px 1fr 1fr 40px",
                gap: 8,
                padding: "10px 10px",
                borderBottom: idx === rows.length - 1 ? "none" : "1px solid #1f2a3a",
                alignItems: "center",
                opacity: r.enabled === false ? 0.5 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={r.enabled !== false}
                onChange={() => toggle(idx)}
                style={{ width: 16, height: 16 }}
              />

              <input
                value={r.key}
                onChange={(e) => update(idx, "key", e.target.value)}
                placeholder={placeholderKey}
                style={styles.cellInput}
              />

              <input
                value={r.value}
                onChange={(e) => update(idx, "value", e.target.value)}
                placeholder={placeholderValue}
                style={styles.cellInput}
              />

              <button onClick={() => removeRow(idx)} style={styles.iconBtn} title="Remove">
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: 10, background: "#0b1220", borderTop: "1px solid #243040" }}>
          <button onClick={addRow} style={styles.secondaryBtn}>
            + Add row
          </button>
        </div>
      </div>
    );
  };

  // ---------- styles ----------
  const styles = useMemo(
    () => ({
      app: {
        height: "100vh",
        display: "flex",
        background: "#0b1220",
        color: "#e5e7eb",
        fontFamily: "system-ui",
      },
      sidebar: {
        width: 420,
        background: "#0f172a",
        borderRight: "1px solid #243040",
        padding: 16,
        overflow: "auto",
      },
      main: {
        flex: 1,
        padding: 20,
        overflow: "auto",
      },
      card: {
        background: "#0f172a",
        border: "1px solid #243040",
        borderRadius: 16,
        padding: 14,
      },
      topbar: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 10,
        paddingBottom: 12,
        marginBottom: 12,
        background: "#0b1220",
      },
      select: {
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #243040",
        background: "#0b1220",
        color: "#e5e7eb",
        outline: "none",
      },
      input: {
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #243040",
        background: "#0b1220",
        color: "#e5e7eb",
        outline: "none",
        width: "100%",
      },
      primaryBtn: {
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid #334155",
        background: "#2563eb",
        color: "white",
        cursor: "pointer",
        whiteSpace: "nowrap",
      },
      secondaryBtn: {
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #243040",
        background: "#111827",
        color: "#e5e7eb",
        cursor: "pointer",
        whiteSpace: "nowrap",
      },
      ghostBtn: {
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #243040",
        background: "transparent",
        color: "#e5e7eb",
        cursor: "pointer",
        whiteSpace: "nowrap",
      },
      pill: (active) => ({
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #243040",
        background: active ? "#111827" : "transparent",
        color: "#e5e7eb",
        cursor: "pointer",
        fontSize: 13,
      }),
      mono: {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      textarea: {
        width: "100%",
        padding: 12,
        borderRadius: 12,
        border: "1px solid #243040",
        background: "#0b1220",
        color: "#e5e7eb",
        outline: "none",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      },
      listBtn: {
        width: "100%",
        textAlign: "left",
        padding: 10,
        borderRadius: 14,
        border: "1px solid #243040",
        background: "#0b1220",
        color: "#e5e7eb",
        cursor: "pointer",
      },
      iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        border: "1px solid #243040",
        background: "#0b1220",
        color: "#e5e7eb",
        cursor: "pointer",
      },
      cellInput: {
        width: "100%",
        padding: "9px 10px",
        borderRadius: 10,
        border: "1px solid #243040",
        background: "#0b1220",
        color: "#e5e7eb",
        outline: "none",
      },
      toast: (kind) => ({
        position: "fixed",
        right: 18,
        bottom: 18,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid #243040",
        background:
          kind === "err" ? "#2b0b0b" : kind === "warn" ? "#2b1b0b" : "#0f172a",
        color: "#e5e7eb",
        zIndex: 60,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        maxWidth: 360,
      }),
      modalBackdrop: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 70,
        padding: 16,
      },
      modal: {
        width: "min(760px, 100%)",
        background: "#0f172a",
        border: "1px solid #243040",
        borderRadius: 16,
        padding: 16,
        color: "#e5e7eb",
      },
    }),
    []
  );

  // provide styles to KVTable via closure
  styles.iconBtn = styles.iconBtn;
  styles.secondaryBtn = styles.secondaryBtn;
  styles.cellInput = styles.cellInput;

  return (
    <div style={styles.app}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>API Toolbox</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={exportData} style={styles.ghostBtn}>Export</button>
            <button onClick={triggerImport} style={styles.ghostBtn}>Import</button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                importData(file);
              }}
            />
          </div>
        </div>

        {/* Environment */}
        <div style={{ ...styles.card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Environment</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => setShowEnvModal(true)} style={styles.secondaryBtn}>
                + New
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <select
              value={selectedEnvId}
              onChange={(e) => setSelectedEnvId(e.target.value)}
              style={{ ...styles.select, width: "100%" }}
            >
              <option value="">(None)</option>
              {envs.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Use variables like <span style={styles.mono}>{"{{base_url}}"}</span> in URL/headers/body.
          </div>
        </div>

        {/* Saved */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Saved Requests</div>
          <button
            onClick={async () => {
              try {
                await loadSaved();
                showToast("Refreshed", "ok");
              } catch {
                showToast("Refresh failed", "err");
              }
            }}
            style={styles.iconBtn}
            title="Refresh"
          >
            ↻
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={savingName}
            onChange={(e) => setSavingName(e.target.value)}
            placeholder="Optional name for Save"
            style={styles.input}
          />
          <button onClick={saveCurrent} style={styles.secondaryBtn}>
            Save
          </button>
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {savedRequests.length ? (
            savedRequests.map((r) => (
              <button key={r.id} onClick={() => loadIntoBuilder(r)} style={styles.listBtn} title={r.url}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{(r.method || "").toUpperCase()}</div>
                <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.url}
                </div>
              </button>
            ))
          ) : (
            <div style={{ opacity: 0.8, fontSize: 13 }}>No saved requests yet.</div>
          )}
        </div>

        {/* History */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>History</div>
          <button
            onClick={async () => {
              try {
                await loadHistory();
                showToast("Refreshed", "ok");
              } catch {
                showToast("Refresh failed", "err");
              }
            }}
            style={styles.iconBtn}
            title="Refresh"
          >
            ↻
          </button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {history.length ? (
            history.map((h) => {
              const b = statusBadge(h.status_code);
              return (
                <div
                  key={h.id}
                  style={{
                    padding: 10,
                    border: "1px solid #243040",
                    borderRadius: 14,
                    background: "#0b1220",
                  }}
                  title={h.url}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{(h.method || "").toUpperCase()}</span>
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 999, background: b.bg, color: b.fg }}>
                      {b.text}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.85 }}>{h.duration_ms} ms</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {h.url}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ opacity: 0.8, fontSize: 13 }}>No history yet.</div>
          )}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
          Backend: {API_BASE}
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        {/* Topbar */}
        <div style={styles.topbar}>
          <select value={method} onChange={(e) => setMethod(e.target.value)} style={styles.select}>
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>

          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/api  or  {{base_url}}/get"
            style={{ ...styles.input, flex: 1 }}
          />

          <button onClick={send} disabled={sending} style={styles.primaryBtn}>
            {sending ? "Sending…" : "Send"}
          </button>

          <button onClick={buildCurl} style={styles.secondaryBtn}>
            cURL
          </button>
        </div>

        {/* Tabs + editors */}
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 14 }}>
          <div style={styles.card}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={() => setActiveTab("headers")} style={styles.pill(activeTab === "headers")}>Headers</button>
              <button onClick={() => setActiveTab("params")} style={styles.pill(activeTab === "params")}>Params</button>
              <button onClick={() => setActiveTab("body")} style={styles.pill(activeTab === "body")}>Body</button>

              <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8, alignSelf: "center" }}>
                Env:{" "}
                <span style={styles.mono}>
                  {selectedEnvId ? (envs.find((e) => String(e.id) === String(selectedEnvId))?.name || "—") : "none"}
                </span>
              </div>
            </div>

            {activeTab === "headers" ? (
              <KVTable
                rows={headerRows}
                setRows={setHeaderRows}
                placeholderKey="Authorization"
                placeholderValue="Bearer {{token}}"
              />
            ) : null}

            {activeTab === "params" ? (
              <KVTable
                rows={paramRows}
                setRows={setParamRows}
                placeholderKey="limit"
                placeholderValue="10"
              />
            ) : null}

            {activeTab === "body" ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>JSON Body</div>
                  <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>
                    {isBodyMethod ? "Applied" : "Ignored for this method"}
                  </div>
                </div>
                <textarea
                  rows={14}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  style={styles.textarea}
                />
              </div>
            ) : null}
          </div>

          {/* Response */}
          <div style={styles.card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>Response</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {curlText ? (
                  <button onClick={copyCurl} style={styles.secondaryBtn}>
                    {copied ? "Copied" : "Copy cURL"}
                  </button>
                ) : null}
              </div>
            </div>

            {error ? (
              <div style={{ marginTop: 10, padding: 12, border: "1px solid #7f1d1d", background: "#1f0b0b", borderRadius: 12 }}>
                <b style={{ color: "#fecaca" }}>❌ {error}</b>
              </div>
            ) : null}

            {response ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 13 }}>
                    <b>Status:</b> {response.status_code}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    <b>Time:</b> {response.duration_ms} ms
                  </div>
                </div>

                <details style={{ marginBottom: 10 }}>
                  <summary style={{ cursor: "pointer" }}>Response headers</summary>
                  <pre style={{ ...styles.textarea, marginTop: 8, maxHeight: 220, overflow: "auto" }}>
                    {JSON.stringify(response.headers || {}, null, 2)}
                  </pre>
                </details>

                <pre style={{ ...styles.textarea, maxHeight: 360, overflow: "auto" }}>
                  {JSON.stringify(response.json ?? response.text, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.8 }}>Send a request to see output.</div>
            )}

            {curlText ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>cURL</div>
                <pre style={{ ...styles.textarea, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{curlText}</pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Env Modal */}
      {showEnvModal ? (
        <div style={styles.modalBackdrop} onClick={() => setShowEnvModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>New Environment</div>
              <button onClick={() => setShowEnvModal(false)} style={styles.iconBtn} title="Close">×</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Name</div>
              <input value={envName} onChange={(e) => setEnvName(e.target.value)} placeholder="dev / prod" style={styles.input} />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Variables (JSON)</div>
              <textarea rows={10} value={envVarsText} onChange={(e) => setEnvVarsText(e.target.value)} style={styles.textarea} />
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                Example usage: URL <span style={styles.mono}>{"{{base_url}}/get"}</span>, Header{" "}
                <span style={styles.mono}>{"Authorization: Bearer {{token}}"}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button onClick={() => setShowEnvModal(false)} style={styles.ghostBtn}>Cancel</button>
              <button onClick={createEnv} disabled={creatingEnv} style={styles.primaryBtn}>
                {creatingEnv ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast */}
      {toast.show ? (
        <div style={styles.toast(toast.kind)}>
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}