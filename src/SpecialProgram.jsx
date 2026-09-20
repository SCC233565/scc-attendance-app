import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, X, Trash2, Pencil, Save, Loader2, Search, Copy, Download, Printer,
  RefreshCw, Check, QrCode, Star, Archive, KeyRound, Users
} from "lucide-react";
import QRCode from "qrcode";
import Papa from "papaparse";
import { supabase } from "./supabaseClient";

/* ============================================================
   Special Program — fully separate from church members/departments/attendance.
   Also: attendance types (Secretariat-managed) and Programs with their own form + QR codes.
   ============================================================ */

const card = "bg-white rounded-lg border border-[#E9E2CC]";
const inputCls = "w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white";
const primaryBtn = "bg-[#4A0E52] hover:bg-[#63177A] text-white rounded-md px-3 py-2 text-sm inline-flex items-center gap-1.5 disabled:opacity-60";
const ghostBtn = "border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white inline-flex items-center gap-1.5 hover:bg-[#F7F3E9]";

const origin = () => window.location.origin;
const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function downloadCsv(filename, rows) {
  const blob = new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white rounded-lg w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9E2CC]">
          <h3 className="font-display text-lg text-[#4A0E52]">{title}</h3>
          <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function Labeled({ label, children }) {
  return <label className="block text-xs text-gray-500 mb-3">{label}<div className="mt-1">{children}</div></label>;
}

/* ---------- Church | Special Program switch ---------- */
export function SectionToggle({ section, setSection }) {
  return (
    <div className="inline-flex border border-[#E9E2CC] rounded-md overflow-hidden text-sm mb-4 bg-white">
      {[["church", "Church"], ["special", "Special Program"]].map(([id, label]) => (
        <button key={id} onClick={() => setSection(id)} className={`px-4 py-2 ${section === id ? "bg-[#4A0E52] text-white" : "text-gray-600"}`}>{label}</button>
      ))}
    </div>
  );
}

/* ---------- Attendance types loader (used by App to feed the dropdown) ---------- */
export async function loadAttendanceTypes() {
  const { data, error } = await supabase.from("attendance_types").select("*").order("sort_order").order("created_at");
  return error ? null : data;
}

/* ---------- Church member code row (shown in the church member profile) ---------- */
export function ChurchMemberCode({ memberId, isAdmin }) {
  const [row, setRow] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("member_codes").select("id, code").eq("church_member_id", memberId).maybeSingle();
    setRow(data || null);
  }, [memberId]);
  useEffect(() => { load(); }, [load]);
  if (!row) return null;
  const reset = async () => {
    if (!window.confirm("Issue a new code for this member? Their old code and PIN will stop working.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("sc_reset_member_code", { p_code_id: row.id });
    setBusy(false);
    if (error) return alert("Could not reset: " + error.message);
    load();
  };
  return (
    <div className="bg-[#F7F3E9] rounded-lg p-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-gray-400 mb-0.5">Attendance code</p>
        <p className="font-mono tracking-widest text-[#4A0E52]">{row.code}</p>
      </div>
      {isAdmin && <button onClick={reset} disabled={busy} className={ghostBtn + " text-xs"}><KeyRound className="w-3.5 h-3.5" /> New code</button>}
    </div>
  );
}

/* ============================================================
   PROGRAMS (admin): attendance types, programs, forms, QR codes
   ============================================================ */
const FULL_NAME_FIELD = { key: "full_name", label: "Full name", type: "text", required: true };
const PHONE_FIELD = { key: "phone", label: "Phone number", type: "tel", required: true };
const PRESET_FIELDS = [
  { key: "email", label: "Email", type: "text" },
  { key: "gender", label: "Gender", type: "select", optionsText: "Male, Female" },
  { key: "address", label: "Address", type: "text" },
  { key: "date_of_birth", label: "Date of birth", type: "date" },
  { key: "occupation", label: "Occupation", type: "text" }
];

function AttendanceTypesManager({ types, reload }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id, old, value }
  const [err, setErr] = useState("");

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true); setErr("");
    const max = types.reduce((m, t) => Math.max(m, t.sort_order || 0), 0);
    const { error } = await supabase.from("attendance_types").insert({ name: n, sort_order: max + 1 });
    setBusy(false);
    if (error) return setErr(error.code === "23505" ? "That attendance type already exists." : error.message);
    setName(""); reload();
  };
  const rename = async () => {
    const v = editing.value.trim();
    if (!v || v === editing.old) return setEditing(null);
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("sc_rename_attendance_type", { p_old: editing.old, p_new: v });
    setBusy(false);
    if (error) return setErr(error.code === "23505" ? "That attendance type already exists." : error.message);
    setEditing(null); reload();
  };
  const toggle = async (t) => {
    const { error } = await supabase.from("attendance_types").update({ active: !t.active }).eq("id", t.id);
    if (error) return alert(error.message);
    reload();
  };

  return (
    <div className={card + " p-4 mb-6"}>
      <h2 className="font-display text-lg text-[#4A0E52] mb-1">Attendance types</h2>
      <p className="text-xs text-gray-400 mb-3">These appear in the Church attendance dropdown. Turn a type off to hide it without losing its history.</p>
      <ul className="divide-y divide-[#F0EAD6] mb-3">
        {types.map((t) => (
          <li key={t.id} className="py-2 flex items-center gap-2">
            {editing?.id === t.id ? (
              <>
                <input className={inputCls} value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && rename()} autoFocus />
                <button onClick={rename} disabled={busy} className={primaryBtn}><Save className="w-4 h-4" /></button>
                <button onClick={() => setEditing(null)} className={ghostBtn}><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className={`flex-1 text-sm ${t.active ? "" : "text-gray-400 line-through"}`}>{t.name}</span>
                <button onClick={() => setEditing({ id: t.id, old: t.name, value: t.name })} className="text-gray-400 hover:text-[#4A0E52]" title="Rename"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => toggle(t)} className={ghostBtn + " text-xs"}>{t.active ? "Turn off" : "Turn on"}</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="New attendance type, e.g. Vigil" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button onClick={add} disabled={busy || !name.trim()} className={primaryBtn}><Plus className="w-4 h-4" /> Add</button>
      </div>
      {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
    </div>
  );
}

function QrCard({ title, url, program, hint }) {
  const [src, setSrc] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M" }).then(setSrc).catch(() => setSrc("")); }, [url]);

  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { window.prompt("Copy this link:", url); } };
  const save = () => { const a = document.createElement("a"); a.href = src; a.download = `${program.name} - ${title}.png`.replace(/[\\/:*?"<>|]/g, ""); a.click(); };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return alert("Please allow pop-ups to print.");
    w.document.write(`<html><head><title>${esc(program.name)}</title><style>body{font-family:Georgia,serif;text-align:center;padding:40px;color:#222}h1{color:#4A0E52;margin-bottom:4px}h2{font-weight:normal;margin-top:0}img{width:380px;height:380px;margin:20px 0}p{word-break:break-all;font-size:13px;color:#555}</style></head><body><h1>${esc(program.name)}</h1><h2>${esc(title)}</h2><div>${esc(fmtDate(program.program_date))}</div><img src="${src}" /><p>${esc(url)}</p></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 350);
  };

  return (
    <div className="border border-[#E9E2CC] rounded-lg p-3 text-center">
      <p className="text-sm font-medium text-[#4A0E52]">{title}</p>
      {hint && <p className="text-[11px] text-gray-400 mb-2">{hint}</p>}
      {src ? <img src={src} alt={title} className="w-44 h-44 mx-auto" /> : <div className="w-44 h-44 mx-auto flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}
      <p className="text-[10px] text-gray-400 break-all mt-1 mb-2">{url}</p>
      <div className="flex flex-wrap gap-1.5 justify-center">
        <button onClick={copy} className={ghostBtn + " text-xs"}>{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy link"}</button>
        <button onClick={save} disabled={!src} className={ghostBtn + " text-xs"}><Download className="w-3.5 h-3.5" /> PNG</button>
        <button onClick={print} disabled={!src} className={ghostBtn + " text-xs"}><Printer className="w-3.5 h-3.5" /> Print</button>
      </div>
    </div>
  );
}

function FieldsEditor({ fields, onChange }) {
  const patch = (i, p) => onChange(fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)));
  const remove = (i) => onChange(fields.filter((_, idx) => idx !== i));
  const addPreset = (p) => { if (!fields.some((f) => f.key === p.key)) onChange([...fields, { ...p, required: false }]); };
  const addCustom = () => onChange([...fields, { key: `c_${Date.now().toString(36)}`, label: "New question", type: "text", required: false }]);
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">Form questions. Full name and phone number are always included.</p>
      <div className="space-y-2 mb-2">
        {fields.map((f, i) => (
          <div key={f.key} className="border border-[#E9E2CC] rounded-md p-2 flex flex-wrap gap-2 items-center">
            <input className={inputCls + " flex-1 min-w-[140px]"} value={f.label} onChange={(e) => patch(i, { label: e.target.value })} />
            <select className={inputCls + " w-28"} value={f.type} onChange={(e) => patch(i, { type: e.target.value })} disabled={["gender", "date_of_birth"].includes(f.key)}>
              <option value="text">Text</option><option value="select">Choice</option><option value="date">Date</option>
            </select>
            <label className="text-xs text-gray-500 flex items-center gap-1"><input type="checkbox" checked={!!f.required} onChange={(e) => patch(i, { required: e.target.checked })} /> Required</label>
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
            {f.type === "select" && <input className={inputCls} placeholder="Choices, separated by commas" value={f.optionsText || ""} onChange={(e) => patch(i, { optionsText: e.target.value })} />}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_FIELDS.filter((p) => !fields.some((f) => f.key === p.key)).map((p) => (
          <button key={p.key} onClick={() => addPreset(p)} className={ghostBtn + " text-xs"}><Plus className="w-3 h-3" /> {p.label}</button>
        ))}
        <button onClick={addCustom} className={ghostBtn + " text-xs"}><Plus className="w-3 h-3" /> Custom question</button>
      </div>
    </div>
  );
}

function ProgramModal({ program, types, onClose, onSaved }) {
  const editing = !!program?.id;
  const initialFields = (program?.form_fields || PRESET_FIELDS.filter((p) => ["email", "gender", "address"].includes(p.key)).map((p) => ({ ...p, required: false })))
    .filter((f) => f.key !== "full_name" && f.key !== "phone")
    .map((f) => ({ ...f, optionsText: f.optionsText ?? (f.options || []).join(", ") }));
  const [d, setD] = useState({
    name: program?.name || "", description: program?.description || "",
    program_date: program?.program_date || new Date().toISOString().slice(0, 10),
    section: program?.section || "special", attendance_type: program?.attendance_type || "",
    whatsapp_link: program?.whatsapp_link || "",
  });
  const [fields, setFields] = useState(initialFields);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const activeTypes = types.filter((t) => t.active);

  const save = async () => {
    setErr("");
    if (!d.name.trim()) return setErr("Please enter a program name.");
    if (d.section === "church" && !d.attendance_type) return setErr("Choose the attendance type this church program counts under.");
    const cleaned = fields.map((f) => {
      const { optionsText, ...rest } = f;
      const out = { ...rest, label: (f.label || "").trim() || "Question" };
      if (f.type === "select") out.options = (optionsText || "").split(",").map((s) => s.trim()).filter(Boolean);
      return out;
    });
    if (cleaned.some((f) => f.type === "select" && !f.options.length)) return setErr("Add at least one choice to each 'Choice' question.");
    const wa = d.whatsapp_link.trim();
    if (wa && !/^https:\/\/chat\.whatsapp\.com\/\S+$/i.test(wa)) return setErr("WhatsApp link should look like https://chat.whatsapp.com/...");
    const payload = {
      name: d.name.trim(), description: d.description.trim() || null, program_date: d.program_date,
      attendance_type: d.section === "church" ? d.attendance_type : null,
      whatsapp_link: wa || null,
      form_fields: [FULL_NAME_FIELD, PHONE_FIELD, ...cleaned]
    };
    setSaving(true);
    let error;
    if (editing) {
      ({ error } = await supabase.from("programs").update(payload).eq("id", program.id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      ({ error } = await supabase.from("programs").insert({ ...payload, section: d.section, created_by: u?.user?.id || null }));
    }
    setSaving(false);
    if (error) return setErr(error.message);
    onSaved();
  };

  return (
    <Modal title={editing ? "Edit program" : "New program"} onClose={onClose} wide>
      <Labeled label="Program name"><input className={inputCls} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Youth Conference 2026" /></Labeled>
      <Labeled label="Short description (optional)"><input className={inputCls} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Labeled>
      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Date"><input type="date" className={inputCls} value={d.program_date} onChange={(e) => setD({ ...d, program_date: e.target.value })} /></Labeled>
        <Labeled label="Type">
          <select className={inputCls} value={d.section} disabled={editing} onChange={(e) => setD({ ...d, section: e.target.value })}>
            <option value="special">Special Program</option><option value="church">Church Program</option>
          </select>
        </Labeled>
      </div>
      <Labeled label="WhatsApp group link (optional)">
        <input className={inputCls} value={d.whatsapp_link} onChange={(e) => setD({ ...d, whatsapp_link: e.target.value })} placeholder="https://chat.whatsapp.com/..." />
      </Labeled>
      {d.section === "church" && (
        <Labeled label="Counts under attendance type">
          <select className={inputCls} value={d.attendance_type} onChange={(e) => setD({ ...d, attendance_type: e.target.value })}>
            <option value="">Select…</option>
            {activeTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </Labeled>
      )}
      <FieldsEditor fields={fields} onChange={setFields} />
      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className={ghostBtn}>Cancel</button>
        <button onClick={save} disabled={saving} className={primaryBtn}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
      </div>
    </Modal>
  );
}

export function ProgramsView({ onTypesChanged }) {
  const [types, setTypes] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {} for new, program for edit
  const [open, setOpen] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      loadAttendanceTypes(),
      supabase.from("programs").select("*").order("program_date", { ascending: false })
    ]);
    setTypes(t || []); setPrograms(p.data || []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const typesReload = async () => { await load(); if (onTypesChanged) onTypesChanged(); };
  const setFlag = async (p, col) => {
    const { error } = await supabase.from("programs").update({ [col]: !p[col] }).eq("id", p.id);
    if (error) return alert(error.message);
    load();
  };
  const del = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? Its QR codes stop working and any Special Program attendance recorded for it is removed. Registered people are kept.`)) return;
    const { error } = await supabase.from("programs").delete().eq("id", p.id);
    if (error) return alert(error.message);
    load();
  };

  const exportCodes = async (section) => {
    setExporting(true);
    const codeRes = await supabase.from("member_codes").select("code, church_member_id, sp_member_id").eq("section", section);
    let rows = [];
    if (section === "church") {
      const { data: m } = await supabase.from("members").select("id, full_name, phone").eq("archived", false).order("full_name");
      const map = new Map((codeRes.data || []).map((c) => [c.church_member_id, c.code]));
      rows = (m || []).map((x) => ({ Name: x.full_name, Phone: x.phone || "", Code: map.get(x.id) || "" }));
    } else {
      const { data: m } = await supabase.from("sp_members").select("id, full_name, phone").eq("archived", false).order("full_name");
      const map = new Map((codeRes.data || []).map((c) => [c.sp_member_id, c.code]));
      rows = (m || []).map((x) => ({ Name: x.full_name, Phone: x.phone || "", Code: map.get(x.id) || "" }));
    }
    setExporting(false);
    downloadCsv(section === "church" ? "church-member-codes.csv" : "special-program-codes.csv", rows);
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div>;

  return (
    <div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-4">Programs</h1>

      <AttendanceTypesManager types={types} reload={typesReload} />

      <div className={card + " p-4 mb-6"}>
        <h2 className="font-display text-lg text-[#4A0E52] mb-1">Member portal and codes</h2>
        <p className="text-xs text-gray-400 mb-3">Members log in with their phone number and PIN to see their own code and attendance. Church members activate the first time with the code you give them.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { navigator.clipboard?.writeText(`${origin()}/me`); alert(`Member portal link copied:\n${origin()}/me`); }} className={ghostBtn}><Copy className="w-4 h-4" /> Copy portal link</button>
          <button onClick={() => exportCodes("church")} disabled={exporting} className={ghostBtn}><Download className="w-4 h-4" /> Church codes (CSV)</button>
          <button onClick={() => exportCodes("special")} disabled={exporting} className={ghostBtn}><Download className="w-4 h-4" /> Special Program codes (CSV)</button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg text-[#4A0E52]">Programs</h2>
        <button onClick={() => setModal({})} className={primaryBtn}><Plus className="w-4 h-4" /> New program</button>
      </div>

      {programs.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">No programs yet. Create one to get its registration form and attendance QR code.</p>}
      <div className="space-y-3">
        {programs.map((p) => (
          <div key={p.id} className={card}>
            <div className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[180px]">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-gray-400">{fmtDate(p.program_date)} · {p.section === "special" ? "Special Program" : `Church · ${p.attendance_type || "no type"}`}</p>
              </div>
              <button onClick={() => setOpen(open === p.id ? null : p.id)} className={ghostBtn + " text-xs"}><QrCode className="w-4 h-4" /> Forms and QR codes</button>
              <button onClick={() => setModal(p)} className="text-gray-400 hover:text-[#4A0E52]" title="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => del(p)} className="text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
            {open === p.id && (
              <div className="border-t border-[#F0EAD6] p-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <QrCard title="Registration form" hint="People scan this to register" url={`${origin()}/r/${p.reg_token}`} program={p} />
                  <QrCard title="Attendance" hint="People scan this and enter their code" url={`${origin()}/a/${p.attendance_token}`} program={p} />
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={p.reg_open} onChange={() => setFlag(p, "reg_open")} /> Registration open</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={p.attendance_open} onChange={() => setFlag(p, "attendance_open")} /> Attendance open</label>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">The attendance link only accepts codes on the program date.</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && <ProgramModal program={modal.id ? modal : null} types={types} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

/* ============================================================
   SPECIAL PROGRAM — members
   ============================================================ */
function useSpecialData() {
  const [state, setState] = useState({ members: [], depts: [], links: [], codes: [], programs: [], loading: true });
  const load = useCallback(async () => {
    const [m, d, l, c, p] = await Promise.all([
      supabase.from("sp_members").select("*").order("full_name"),
      supabase.from("sp_departments").select("*").order("name"),
      supabase.from("sp_member_departments").select("sp_member_id, sp_department_id"),
      supabase.from("member_codes").select("id, code, sp_member_id").eq("section", "special"),
      supabase.from("programs").select("id, name, program_date, section").eq("section", "special").order("program_date", { ascending: false })
    ]);
    setState({ members: m.data || [], depts: d.data || [], links: l.data || [], codes: c.data || [], programs: p.data || [], loading: false });
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

function SpMemberModal({ member, depts, links, code, isAdmin, onClose, onSaved }) {
  const editing = !!member?.id;
  const [d, setD] = useState({
    full_name: member?.full_name || "", phone: member?.phone || "", email: member?.email || "",
    address: member?.address || "", gender: member?.gender || "", date_of_birth: member?.date_of_birth || "",
    occupation: member?.occupation || "", is_worker: !!member?.is_worker, notes: member?.notes || ""
  });
  const initialDepts = useMemo(() => links.filter((l) => l.sp_member_id === member?.id).map((l) => l.sp_department_id), [links, member]);
  const [deptIds, setDeptIds] = useState(initialDepts);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [newCode, setNewCode] = useState("");
  const extra = member?.extra && Object.keys(member.extra).length ? Object.entries(member.extra) : [];

  const save = async () => {
    setErr("");
    if (!d.full_name.trim()) return setErr("Full name is required.");
    const payload = {
      full_name: d.full_name.trim(), phone: d.phone.trim() || null, email: d.email.trim() || null,
      address: d.address.trim() || null, gender: d.gender.trim() || null, date_of_birth: d.date_of_birth || null,
      occupation: d.occupation.trim() || null, is_worker: d.is_worker, notes: d.notes.trim() || null
    };
    setSaving(true);
    let id = member?.id;
    let error;
    if (editing) {
      ({ error } = await supabase.from("sp_members").update(payload).eq("id", id));
    } else {
      const { data: u } = await supabase.auth.getUser();
      const res = await supabase.from("sp_members").insert({ ...payload, created_by: u?.user?.id || null }).select("id").single();
      error = res.error; id = res.data?.id;
    }
    if (error) {
      setSaving(false);
      return setErr(error.code === "23505" ? "That phone number is already registered in Special Program." : error.message);
    }
    const removed = initialDepts.filter((x) => !deptIds.includes(x));
    const added = deptIds.filter((x) => !initialDepts.includes(x));
    if (removed.length) await supabase.from("sp_member_departments").delete().eq("sp_member_id", id).in("sp_department_id", removed);
    if (added.length) await supabase.from("sp_member_departments").insert(added.map((x) => ({ sp_member_id: id, sp_department_id: x })));
    setSaving(false);
    onSaved();
  };

  const archive = async () => {
    const { error } = await supabase.from("sp_members").update({ archived: !member.archived }).eq("id", member.id);
    if (error) return setErr(error.message);
    onSaved();
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${member.full_name} permanently? Their attendance records are removed too.`)) return;
    const { error } = await supabase.from("sp_members").delete().eq("id", member.id);
    if (error) return setErr(error.message);
    onSaved();
  };
  const reset = async () => {
    if (!window.confirm("Issue a new code for this person? Their old code and PIN will stop working.")) return;
    const { data, error } = await supabase.rpc("sc_reset_member_code", { p_code_id: code.id });
    if (error) return setErr(error.message);
    setNewCode(data);
  };

  const text = (k, label, type = "text") => <Labeled label={label}><input type={type} className={inputCls} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></Labeled>;

  return (
    <Modal title={editing ? member.full_name : "Add Special Program member"} onClose={onClose} wide>
      {editing && (code || newCode) && (
        <div className="bg-[#F7F3E9] rounded-lg p-3 mb-4 flex items-center justify-between gap-3">
          <div><p className="text-xs text-gray-400 mb-0.5">Special Program code</p><p className="font-mono tracking-widest text-[#4A0E52]">{newCode || code.code}</p></div>
          {isAdmin && code && <button onClick={reset} className={ghostBtn + " text-xs"}><KeyRound className="w-3.5 h-3.5" /> New code</button>}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-x-3">
        {text("full_name", "Full name *")}
        {text("phone", "Phone")}
        {text("email", "Email")}
        {text("gender", "Gender")}
        {text("address", "Address")}
        {text("date_of_birth", "Date of birth", "date")}
        {text("occupation", "Occupation")}
      </div>
      {extra.length > 0 && (
        <div className="bg-[#F7F3E9] rounded-lg p-3 mb-3 text-sm">
          <p className="text-xs text-gray-400 mb-1">From the registration form</p>
          {extra.map(([k, v]) => <p key={k}><span className="text-gray-500">{k}:</span> {String(v)}</p>)}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={d.is_worker} onChange={(e) => setD({ ...d, is_worker: e.target.checked })} /> Worker</label>
      <div className="mb-3">
        <p className="text-xs text-gray-500 mb-1">Departments</p>
        {depts.length === 0 ? <p className="text-xs text-gray-400">No Special Program departments yet. Secretariat can create them in the Depts page.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {depts.map((x) => (
              <button key={x.id} type="button" onClick={() => setDeptIds((s) => s.includes(x.id) ? s.filter((i) => i !== x.id) : [...s, x.id])}
                className={`text-xs px-2.5 py-1 rounded-full border ${deptIds.includes(x.id) ? "bg-[#4A0E52] text-white border-[#4A0E52]" : "bg-white border-[#E9E2CC] text-gray-600"}`}>{x.name}</button>
            ))}
          </div>
        )}
      </div>
      <Labeled label="Notes"><textarea className={inputCls} rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Labeled>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}
      <div className="flex flex-wrap justify-between gap-2 mt-4">
        <div className="flex gap-2">
          {editing && <button onClick={archive} className={ghostBtn + " text-xs"}><Archive className="w-3.5 h-3.5" /> {member.archived ? "Restore" : "Archive"}</button>}
          {editing && isAdmin && <button onClick={remove} className={ghostBtn + " text-xs text-red-600"}><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className={ghostBtn}>Cancel</button>
          <button onClick={save} disabled={saving} className={primaryBtn}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
        </div>
      </div>
    </Modal>
  );
}

export function SpecialMembersPanel({ isAdmin }) {
  const { members, depts, links, codes, programs, loading, reload } = useSpecialData();
  const [search, setSearch] = useState("");
  const [deptF, setDeptF] = useState("all");
  const [progF, setProgF] = useState("all");
  const [workersOnly, setWorkersOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null);

  const deptNames = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const memberDepts = useMemo(() => {
    const m = new Map();
    links.forEach((l) => { if (!m.has(l.sp_member_id)) m.set(l.sp_member_id, []); m.get(l.sp_member_id).push(l.sp_department_id); });
    return m;
  }, [links]);
  const codeOf = useMemo(() => new Map(codes.map((c) => [c.sp_member_id, c])), [codes]);
  const progName = useMemo(() => new Map(programs.map((p) => [p.id, p.name])), [programs]);

  const list = members.filter((m) => {
    if (m.archived !== showArchived) return false;
    if (workersOnly && !m.is_worker) return false;
    if (deptF !== "all" && !(memberDepts.get(m.id) || []).includes(deptF)) return false;
    if (progF !== "all" && m.source_program_id !== progF) return false;
    const q = search.toLowerCase();
    return !q || m.full_name.toLowerCase().includes(q) || (m.phone || "").includes(q);
  });

  const exportList = () => downloadCsv("special-program-members.csv", list.map((m) => ({
    Name: m.full_name, Phone: m.phone || "", Email: m.email || "", Gender: m.gender || "", Address: m.address || "",
    Worker: m.is_worker ? "Yes" : "", Departments: (memberDepts.get(m.id) || []).map((i) => deptNames.get(i)).join("; "),
    Registered_via: progName.get(m.source_program_id) || "", Code: codeOf.get(m.id)?.code || ""
  })));

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h1 className="font-display text-2xl text-[#4A0E52]">Special Program members <span className="text-sm text-gray-400 font-body">({list.length})</span></h1>
        <div className="flex gap-2">
          <button onClick={exportList} className={ghostBtn}><Download className="w-4 h-4" /> CSV</button>
          <button onClick={() => setModal({})} className={primaryBtn}><Plus className="w-4 h-4" /> Add</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input className={inputCls + " pl-9"} placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={inputCls + " w-auto"} value={progF} onChange={(e) => setProgF(e.target.value)}>
          <option value="all">All programs</option>{programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={deptF} onChange={(e) => setDeptF(e.target.value)}>
          <option value="all">All departments</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="flex gap-4 mb-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={workersOnly} onChange={(e) => setWorkersOnly(e.target.checked)} /> Workers only</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived</label>
      </div>

      {list.length === 0 ? <p className="text-sm text-gray-400 py-10 text-center">No Special Program members found.</p> : (
        <div className={card + " divide-y divide-[#F0EAD6]"}>
          {list.map((m) => (
            <div key={m.id} onClick={() => setModal(m)} className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-[#FBF9F1]">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium flex items-center gap-1.5 truncate">{m.full_name}{m.is_worker && <Star className="w-3.5 h-3.5 text-[#C9A227] shrink-0" />}</p>
                <p className="text-xs text-gray-400 truncate">{[m.phone, progName.get(m.source_program_id)].filter(Boolean).join(" · ")}</p>
                {(memberDepts.get(m.id) || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">{(memberDepts.get(m.id) || []).map((i) => <span key={i} className="text-[10px] bg-[#F3E9F5] text-[#4A0E52] rounded-full px-2 py-0.5">{deptNames.get(i)}</span>)}</div>
                )}
              </div>
              {codeOf.get(m.id) && <span className="font-mono text-xs text-gray-500 tracking-wider">{codeOf.get(m.id).code}</span>}
            </div>
          ))}
        </div>
      )}
      {modal && <SpMemberModal member={modal.id ? modal : null} depts={depts} links={links} code={modal.id ? codeOf.get(modal.id) : null} isAdmin={isAdmin} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </div>
  );
}

/* ============================================================
   SPECIAL PROGRAM — departments
   ============================================================ */
export function SpecialDepartmentsPanel({ isAdmin }) {
  const { members, depts, links, loading, reload } = useSpecialData();
  const [name, setName] = useState("");
  const [open, setOpen] = useState(null);
  const [addId, setAddId] = useState("");
  const [err, setErr] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    setErr("");
    const { error } = await supabase.from("sp_departments").insert({ name: name.trim() });
    if (error) return setErr(error.code === "23505" ? "That department already exists." : error.message);
    setName(""); reload();
  };
  const rename = async (d) => {
    const v = window.prompt("Rename department", d.name);
    if (!v || !v.trim() || v.trim() === d.name) return;
    const { error } = await supabase.from("sp_departments").update({ name: v.trim() }).eq("id", d.id);
    if (error) return alert(error.message);
    reload();
  };
  const del = async (d) => {
    if (!window.confirm(`Delete department "${d.name}"? Members stay, but lose this department.`)) return;
    const { error } = await supabase.from("sp_departments").delete().eq("id", d.id);
    if (error) return alert(error.message);
    reload();
  };
  const assign = async (deptId) => {
    if (!addId) return;
    const { error } = await supabase.from("sp_member_departments").insert({ sp_member_id: addId, sp_department_id: deptId });
    if (error) return alert(error.message);
    setAddId(""); reload();
  };
  const unassign = async (deptId, memberId) => {
    await supabase.from("sp_member_departments").delete().eq("sp_member_id", memberId).eq("sp_department_id", deptId);
    reload();
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div>;
  const active = members.filter((m) => !m.archived);

  return (
    <div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-1">Special Program departments</h1>
      <p className="text-xs text-gray-400 mb-4">These are separate from the church departments.</p>
      {isAdmin && (
        <div className="flex gap-2 mb-4">
          <input className={inputCls} placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button onClick={add} disabled={!name.trim()} className={primaryBtn}><Plus className="w-4 h-4" /> Add</button>
        </div>
      )}
      {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
      {depts.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">No departments yet.</p>}
      <div className="space-y-2">
        {depts.map((d) => {
          const ids = links.filter((l) => l.sp_department_id === d.id).map((l) => l.sp_member_id);
          const inDept = active.filter((m) => ids.includes(m.id));
          const candidates = active.filter((m) => !ids.includes(m.id));
          return (
            <div key={d.id} className={card}>
              <div className="px-4 py-3 flex items-center gap-2 cursor-pointer" onClick={() => setOpen(open === d.id ? null : d.id)}>
                <Users className="w-4 h-4 text-[#4A0E52]" />
                <span className="flex-1 text-sm font-medium">{d.name}</span>
                <span className="text-xs text-gray-400">{inDept.length} member{inDept.length === 1 ? "" : "s"}</span>
                {isAdmin && <button onClick={(e) => { e.stopPropagation(); rename(d); }} className="text-gray-400 hover:text-[#4A0E52]"><Pencil className="w-4 h-4" /></button>}
                {isAdmin && <button onClick={(e) => { e.stopPropagation(); del(d); }} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
              </div>
              {open === d.id && (
                <div className="border-t border-[#F0EAD6] px-4 py-3">
                  {inDept.length === 0 ? <p className="text-xs text-gray-400 mb-2">No members yet.</p> : (
                    <ul className="mb-3 divide-y divide-[#F0EAD6]">
                      {inDept.map((m) => (
                        <li key={m.id} className="py-1.5 flex items-center justify-between text-sm">
                          <span>{m.full_name}{m.is_worker && <Star className="inline w-3 h-3 ml-1 text-[#C9A227]" />}</span>
                          <button onClick={() => unassign(d.id, m.id)} className="text-gray-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <select className={inputCls} value={addId} onChange={(e) => setAddId(e.target.value)}>
                      <option value="">Add a member…</option>{candidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                    <button onClick={() => assign(d.id)} disabled={!addId} className={primaryBtn}>Add</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   SPECIAL PROGRAM — attendance (manual marking; QR marks land here too)
   ============================================================ */
export function SpecialAttendancePanel() {
  const { members, programs, loading } = useSpecialData();
  const [programId, setProgramId] = useState("");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [registeredHere, setRegisteredHere] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { if (!programId && programs.length) setProgramId(programs[0].id); }, [programs, programId]);

  const loadRows = useCallback(async () => {
    if (!programId) return;
    const { data } = await supabase.from("sp_attendance").select("id, sp_member_id, method, created_at").eq("program_id", programId);
    setRows(data || []);
  }, [programId]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const attended = useMemo(() => new Map(rows.map((r) => [r.sp_member_id, r])), [rows]);
  const toggle = async (m) => {
    setBusyId(m.id);
    const existing = attended.get(m.id);
    if (existing) {
      const { error } = await supabase.from("sp_attendance").delete().eq("id", existing.id);
      if (error) alert(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("sp_attendance").insert({ program_id: programId, sp_member_id: m.id, method: "manual", marked_by: u?.user?.id || null });
      if (error) alert(error.message);
    }
    await loadRows();
    setBusyId(null);
  };

  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div>;
  if (!programs.length) return (
    <div><h1 className="font-display text-2xl text-[#4A0E52] mb-3">Special Program attendance</h1>
      <p className="text-sm text-gray-400 py-8 text-center">No Special Programs yet. The Secretariat can create one in Programs.</p></div>
  );

  const list = members.filter((m) => !m.archived)
    .filter((m) => !registeredHere || m.source_program_id === programId)
    .filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()));
  const presentCount = list.filter((m) => attended.has(m.id)).length;

  return (
    <div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-4">Special Program attendance</h1>
      <div className="flex flex-wrap gap-2 mb-2">
        <select className={inputCls + " w-auto"} value={programId} onChange={(e) => setProgramId(e.target.value)}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name} · {fmtDate(p.program_date)}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input className={inputCls + " pl-9"} placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={loadRows} className={ghostBtn} title="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center justify-between mb-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={registeredHere} onChange={(e) => setRegisteredHere(e.target.checked)} /> Only people registered for this program</label>
        <span className="text-gray-500">{presentCount} present of {list.length} · {rows.length} total for this program</span>
      </div>
      {list.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center">No Special Program members to show.</p> : (
        <div className={card + " divide-y divide-[#F0EAD6]"}>
          {list.map((m) => {
            const a = attended.get(m.id);
            return (
              <div key={m.id} onClick={() => busyId !== m.id && toggle(m)} className={`px-4 py-3 flex items-center gap-3 cursor-pointer ${a ? "bg-[#F1F8F1]" : "hover:bg-[#FBF9F1]"}`}>
                <div className={`w-5 h-5 rounded border flex items-center justify-center ${a ? "bg-green-600 border-green-600 text-white" : "border-gray-300"}`}>
                  {busyId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : a ? <Check className="w-3.5 h-3.5" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{m.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{m.phone || ""}</p>
                </div>
                {a && <span className="text-[10px] uppercase tracking-wide text-green-700">{a.method === "qr" ? "QR" : "Manual"}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SPECIAL PROGRAM — reports
   ============================================================ */
export function SpecialReportsPanel() {
  const { members, programs, loading } = useSpecialData();
  const [attendance, setAttendance] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => { (async () => { const { data } = await supabase.from("sp_attendance").select("program_id, sp_member_id, method, created_at"); setAttendance(data || []); })(); }, []);
  if (loading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div>;

  const byId = new Map(members.map((m) => [m.id, m]));
  const attendeesOf = (pid) => attendance.filter((a) => a.program_id === pid);

  if (selected) {
    const rows = attendeesOf(selected.id).map((a) => ({ m: byId.get(a.sp_member_id), a })).filter((x) => x.m)
      .sort((x, y) => x.m.full_name.localeCompare(y.m.full_name));
    return (
      <div>
        <button onClick={() => setSelected(null)} className="text-sm text-[#4A0E52] mb-3">← Back to reports</button>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div><h1 className="font-display text-2xl text-[#4A0E52]">{selected.name}</h1><p className="text-xs text-gray-400">{fmtDate(selected.program_date)} · {rows.length} present</p></div>
          <button onClick={() => downloadCsv(`${selected.name}-attendance.csv`, rows.map(({ m, a }) => ({ Name: m.full_name, Phone: m.phone || "", Method: a.method, Marked_at: a.created_at })))} className={ghostBtn}><Download className="w-4 h-4" /> CSV</button>
        </div>
        <div className={card + " divide-y divide-[#F0EAD6]"}>
          {rows.length === 0 && <p className="text-sm text-gray-400 py-8 text-center">Nobody marked present yet.</p>}
          {rows.map(({ m, a }) => (
            <div key={m.id} className="px-4 py-2.5 flex justify-between text-sm"><span>{m.full_name}</span><span className="text-xs text-gray-400">{a.method === "qr" ? "QR" : "Manual"}</span></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-4">Special Program reports</h1>
      {programs.length === 0 ? <p className="text-sm text-gray-400 py-8 text-center">No Special Programs yet.</p> : (
        <div className="space-y-2">
          {programs.map((p) => {
            const registered = members.filter((m) => m.source_program_id === p.id).length;
            return (
              <div key={p.id} onClick={() => setSelected(p)} className={card + " px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-[#FBF9F1]"}>
                <div className="flex-1"><p className="text-sm font-medium">{p.name}</p><p className="text-xs text-gray-400">{fmtDate(p.program_date)}</p></div>
                <div className="text-center"><p className="text-lg font-display text-[#4A0E52]">{registered}</p><p className="text-[10px] text-gray-400">registered</p></div>
                <div className="text-center"><p className="text-lg font-display text-[#4A0E52]">{attendeesOf(p.id).length}</p><p className="text-[10px] text-gray-400">present</p></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
