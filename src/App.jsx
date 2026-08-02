import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, CalendarCheck, BarChart3, Search, Plus, X, Trash2, Pencil,
  Save, Loader2, TrendingDown, LogOut, Upload, Download, UserCog,
  Home, BookOpen, Archive, Phone, Mail, MapPin, Briefcase,
  Heart, Star, AlertTriangle, CheckCheck, ChevronDown, Printer, RefreshCw,
  Lock, DollarSign, TrendingUp, Settings, Eye, EyeOff, PieChart as PieChartIcon, WifiOff, MessageCircle, StickyNote,
  FileText, FileSpreadsheet, History, Wallet, Landmark
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import Papa from "papaparse";
import { supabase } from "./supabaseClient";
import { useAuth } from "./useAuth";

function Logo({ className = "h-10" }) {
  return <img src="/logo.png" alt="SCC" style={{maxHeight:'55px', maxWidth:'160px', width:'auto', height:'auto', display:'block'}} />;
}

const SERVICES = [
  { id: "Sunday Service", label: "Sunday Service" },
  { id: "Wednesday Service", label: "Wednesday Service" },
  { id: "7HWG", label: "7HWG (Monthly)" }
];

const STATUS_OPTIONS = ["Active", "New Convert", "Visitor", "Inactive"];
const PRESETS = ["Today","Yesterday","This week","Last week","This month","Last month","Last 7 days","Last 30 days","Last 1 year","Last 2 years","Last 3 years"];

/* ---- Offline attendance queue — stores unsent records locally, syncs when back online ---- */
const OFFLINE_QUEUE_KEY = "scc_offline_attendance_queue";

function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]"); } catch { return []; }
}
function setOfflineQueue(queue) {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); } catch {}
}
function addToOfflineQueue(rows) {
  const queue = getOfflineQueue();
  queue.push({ id: Date.now() + Math.random(), rows, queuedAt: new Date().toISOString() });
  setOfflineQueue(queue);
}

function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);
  return online;
}

/* ---- Offline Sync Banner — shows status, auto-syncs queued attendance when back online ---- */
function OfflineSyncBanner() {
  const online = useOnlineStatus();
  const [queueLen, setQueueLen] = useState(getOfflineQueue().length);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setQueueLen(getOfflineQueue().length), 2000);
    return () => clearInterval(interval);
  }, []);

  const syncQueue = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    setSyncing(true); setSyncError(false);
    const remaining = [];
    let hadRealError = false;
    for (const batch of queue) {
      try {
        const { error } = await supabase.from("attendance_records").upsert(batch.rows, { onConflict: "member_id,service_type,service_date" });
        if (error) { remaining.push(batch); hadRealError = true; }
      } catch { remaining.push(batch); } // genuine network failure — safe to retry later
    }
    setOfflineQueue(remaining);
    setQueueLen(remaining.length);
    setSyncing(false);
    if (remaining.length === 0) { setJustSynced(true); setTimeout(() => setJustSynced(false), 4000); }
    else if (hadRealError) { setSyncError(true); }
  };

  useEffect(() => { if (online) syncQueue(); }, [online]); // eslint-disable-line

  if (!online) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-xs text-yellow-800 flex items-center gap-2">
        <WifiOff className="w-3.5 h-3.5 shrink-0" /> You're offline — attendance will save on this device and sync automatically once you're back online.
        {queueLen > 0 && <span className="ml-auto font-medium whitespace-nowrap">{queueLen} pending</span>}
      </div>
    );
  }
  if (syncing) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs text-blue-800 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Syncing {queueLen} offline record(s)...
      </div>
    );
  }
  if (justSynced) {
    return (
      <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-xs text-green-800 flex items-center gap-2">
        <CheckCheck className="w-3.5 h-3.5 shrink-0" /> All offline attendance synced successfully!
      </div>
    );
  }
  if (syncError) {
    return (
      <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-800 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {queueLen} record(s) could not sync due to an error — please tell your admin.
      </div>
    );
  }
  return null;
}

function presetToRange(preset) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  switch (preset) {
    case "Today": return { start: fmt(today), end: fmt(today) };
    case "Yesterday": { const y = addDays(today, -1); return { start: fmt(y), end: fmt(y) }; }
    case "This week": { const s = addDays(today, -today.getDay()); return { start: fmt(s), end: fmt(today) }; }
    case "Last week": { const s = addDays(today, -today.getDay() - 7); return { start: fmt(s), end: fmt(addDays(s, 6)) }; }
    case "This month": { return { start: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end: fmt(today) }; }
    case "Last month": { const s = new Date(today.getFullYear(), today.getMonth() - 1, 1); return { start: fmt(s), end: fmt(new Date(today.getFullYear(), today.getMonth(), 0)) }; }
    case "Last 7 days": return { start: fmt(addDays(today, -6)), end: fmt(today) };
    case "Last 30 days": return { start: fmt(addDays(today, -29)), end: fmt(today) };
    case "Last 1 year": return { start: fmt(new Date(today.getFullYear()-1, today.getMonth(), today.getDate())), end: fmt(today) };
    case "Last 2 years": return { start: fmt(new Date(today.getFullYear()-2, today.getMonth(), today.getDate())), end: fmt(today) };
    case "Last 3 years": return { start: fmt(new Date(today.getFullYear()-3, today.getMonth(), today.getDate())), end: fmt(today) };
    default: return null;
  }
}

/* ---- Confirm Dialog ---- */
function ConfirmDialog({ name, type, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-600" />
        </div>
        <h2 className="font-display text-lg text-center mb-1">Delete {type}?</h2>
        <p className="text-sm text-center text-gray-500 mb-6">Are you sure you want to delete <span className="font-medium text-gray-800">{name}</span>? You will have 5 seconds to undo.</p>
        <div className="flex gap-3">
          <div onClick={onCancel} className="flex-1 border border-[#E9E2CC] rounded-lg py-2.5 text-center text-sm cursor-pointer font-medium">Cancel</div>
          <div onClick={onConfirm} className="flex-1 bg-red-600 text-white rounded-lg py-2.5 text-center text-sm cursor-pointer font-medium">Yes, Delete</div>
        </div>
      </div>
    </div>
  );
}

/* ---- Undo Toast ---- */
function UndoToast({ message, onUndo, onDismiss }) {
  const [progress, setProgress] = useState(100);
  useEffect(() => {
    const dismiss = setTimeout(onDismiss, 5000);
    const interval = setInterval(() => setProgress((p) => Math.max(0, p - 2)), 100);
    return () => { clearTimeout(dismiss); clearInterval(interval); };
  }, [onDismiss]);
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-80 shadow-2xl rounded-xl overflow-hidden">
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <span className="text-sm flex-1">{message}</span>
        <div onClick={onUndo} className="text-[#F3D98B] text-sm font-bold cursor-pointer whitespace-nowrap">UNDO</div>
        <div onClick={onDismiss} className="cursor-pointer text-gray-400"><X className="w-4 h-4" /></div>
      </div>
      <div className="bg-gray-700 h-1"><div className="bg-[#F3D98B] h-1 transition-all duration-100" style={{width: progress + "%"}} /></div>
    </div>
  );
}

/* ---- Field helper ---- */
/* ---- Password Gate — full-page lock for protected features ---- */
function PasswordGate({ featureKey, title, onUnlock, onCancel }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async () => {
    setChecking(true); setError("");
    const { data, error: err } = await supabase.rpc("verify_feature_password", { key: featureKey, attempt: password });
    setChecking(false);
    if (err) { setError("Something went wrong. Try again."); return; }
    if (data === true) { onUnlock(); } else { setError("Incorrect password."); }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-xl border border-[#E9E2CC] p-8 text-center shadow-sm">
        <div className="w-14 h-14 bg-[#F7F3E9] rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-[#4A0E52]" />
        </div>
        <h2 className="font-display text-lg text-[#4A0E52] mb-1">{title}</h2>
        <p className="text-sm text-gray-400 mb-5">This section is password protected.</p>
        <div className="relative mb-3">
          <input
            type={show ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm pr-10"
          />
          <div onClick={() => setShow(!show)} className="absolute right-3 top-2.5 cursor-pointer text-gray-400">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div onClick={submit} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2 mb-2">
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Unlock
        </div>
        {onCancel && <div onClick={onCancel} className="text-xs text-gray-400 cursor-pointer">Cancel</div>}
      </div>
    </div>
  );
}

/* ---- Password Prompt Modal — for one-off protected actions like downloads ---- */
function PasswordPromptModal({ featureKey, title, onSuccess, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true); setError("");
    const { data, error: err } = await supabase.rpc("verify_feature_password", { key: featureKey, attempt: password });
    setChecking(false);
    if (err) { setError("Something went wrong."); return; }
    if (data === true) { onSuccess(); } else { setError("Incorrect password."); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg text-[#4A0E52] flex items-center gap-2"><Lock className="w-4 h-4" /> {title}</h2>
          <div onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></div>
        </div>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
          className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm mb-3"
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div onClick={submit} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm
        </div>
      </div>
    </div>
  );
}

// Re-auth against the app owner's actual login — used wherever an action must be
// restricted to the owner specifically, not any admin who knows a shared feature password.
const OWNER_EMAIL = "supernaturalcitychurch@gmail.com";

function OwnerReAuthModal({ title, onSuccess, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (!password) { setError("Enter the owner's login password to confirm."); return; }
    setChecking(true); setError("");
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: OWNER_EMAIL, password });
    setChecking(false);
    if (authErr) { setError("Incorrect owner password."); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg text-[#4A0E52] flex items-center gap-2"><Lock className="w-4 h-4" /> {title}</h2>
          <div onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></div>
        </div>
        <p className="text-xs text-gray-400 mb-3">Only the app owner's login can confirm this.</p>
        <input
          type="password"
          placeholder="Owner login password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          autoFocus
          className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm mb-3"
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div onClick={submit} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm
        </div>
      </div>
    </div>
  );
}

function MemberPicker({ members, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = members.find(m => m.id === value);
  const filtered = query ? members.filter(m => m.full_name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  return (
    <div className="relative">
      <input
        value={selected ? selected.full_name : query}
        readOnly={!!selected}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => !selected && setOpen(true)}
        placeholder="Search member name…"
        className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white pr-8"
      />
      {selected && (
        <div onClick={() => { onChange(""); setQuery(""); }} className="absolute right-2 top-2.5 text-gray-400 cursor-pointer">
          <X className="w-4 h-4" />
        </div>
      )}
      {open && !selected && query && (
        <div className="absolute z-10 bg-white border border-[#E9E2CC] rounded-md mt-1 w-full max-h-48 overflow-y-auto shadow-lg">
          {filtered.map(m => (
            <div key={m.id} onClick={() => { onChange(m.id); setQuery(""); setOpen(false); }} className="px-3 py-2 text-sm cursor-pointer hover:bg-[#F7F3E9]">
              {m.full_name}
            </div>
          ))}
          {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No matches</div>}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-xs text-gray-500 mb-3">
      {label}
      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm" />
      )}
    </label>
  );
}

/* ---- Contact Button — tap to choose WhatsApp or a real phone call ---- */
function ContactButton({ phone, size = "w-4 h-4", className, label }) {
  const [open, setOpen] = useState(false);
  if (!phone) return null;
  const waLink = "https://wa.me/234" + phone.replace(/^0/, "");
  const telLink = "tel:" + phone;

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen(!open)} className={className || "p-2 cursor-pointer text-green-600"}>
        <Phone className={size} />{label ? <span>{label}</span> : null}
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-[#E9E2CC] rounded-lg shadow-lg z-50 overflow-hidden w-40">
            <a href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[#F7F3E9] text-green-600 border-b border-[#F1ECDE]">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <a href={telLink} onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-[#F7F3E9] text-[#4A0E52]">
              <Phone className="w-3.5 h-3.5" /> Phone Call
            </a>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Date Range Picker ---- */
function DateRangePicker({ range, onChange }) {
  const [open, setOpen] = useState(false);
  const [activePreset, setActivePreset] = useState("This month");
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [draftStart, setDraftStart] = useState(range.start);
  const [draftEnd, setDraftEnd] = useState(range.end);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const pickPreset = (p) => { setActivePreset(p); const r = presetToRange(p); if (r) { setDraftStart(r.start); setDraftEnd(r.end); } };
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const dateStr = (d) => `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const clickDay = (d) => { const s = dateStr(d); setActivePreset(null); if (!draftStart || (draftStart && draftEnd)) { setDraftStart(s); setDraftEnd(null); } else if (s < draftStart) { setDraftStart(s); } else { setDraftEnd(s); } };
  const inRange = (d) => { const s = dateStr(d); return draftStart && draftEnd && s >= draftStart && s <= draftEnd; };
  const done = () => { onChange({ start: draftStart, end: draftEnd || draftStart, label: activePreset || "Custom range" }); setOpen(false); };
  return (
    <div className="relative">
      <div onClick={() => setOpen(true)} className="flex items-center gap-2 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white cursor-pointer">
        <CalendarCheck className="w-4 h-4 text-[#4A0E52]" />{range.label || "Select date range"}
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center z-30" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-lg w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-center text-base mb-4">Select date range</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PRESETS.map((p) => (<div key={p} onClick={() => pickPreset(p)} className={`text-sm border rounded-md px-3 py-2 text-center cursor-pointer ${activePreset === p ? "border-[#4A0E52] bg-[#F7F3E9]" : "border-[#E9E2CC]"}`}>{p}</div>))}
            </div>
            <div className="flex items-center justify-between mb-2">
              <div onClick={() => viewMonth === 0 ? (setViewMonth(11), setViewYear(viewYear-1)) : setViewMonth(viewMonth-1)} className="cursor-pointer px-2">‹</div>
              <div className="flex gap-2">
                <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} className="border border-[#E9E2CC] rounded-md px-2 py-1 text-sm">{monthNames.map((m,i) => <option key={m} value={i}>{m}</option>)}</select>
                <select value={viewYear} onChange={(e) => setViewYear(Number(e.target.value))} className="border border-[#E9E2CC] rounded-md px-2 py-1 text-sm">{Array.from({length:6},(_,i)=>new Date().getFullYear()-4+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
              </div>
              <div onClick={() => viewMonth === 11 ? (setViewMonth(0), setViewYear(viewYear+1)) : setViewMonth(viewMonth+1)} className="cursor-pointer px-2">›</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">{["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1 mb-4">{cells.map((d,i) => { if (!d) return <div key={i} />; const s = dateStr(d); const sel = s === draftStart || s === draftEnd; return (<div key={i} onClick={() => clickDay(d)} className={`text-sm text-center py-1.5 rounded-md cursor-pointer ${sel ? "bg-[#4A0E52] text-white" : inRange(d) ? "bg-[#F3D98B]" : "hover:bg-[#F7F3E9]"}`}>{d}</div>); })}</div>
            <div className="flex gap-2">
              <div onClick={() => setOpen(false)} className="flex-1 border border-[#E9E2CC] rounded-md py-2.5 text-center text-sm cursor-pointer">Cancel</div>
              <div onClick={done} className="flex-1 bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer">Done</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Login Screen ---- */
function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    setLoading(true); setError("");
    const { error } = await signIn(email.trim(), password.trim());
    setLoading(false);
    if (error) setError(error.message);
  };
  return (
    <div className="min-h-screen bg-[#F7F3E9] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-lg border border-[#E9E2CC] p-8">
        <div className="bg-[#4A0E52] rounded-lg px-5 py-3 inline-block mb-4"><Logo className="h-12" /></div>
        <h1 className="font-display text-xl mb-1 text-[#4A0E52]">SCC Attendance Register</h1>
        <p className="text-sm text-gray-400 mb-6">Sign in with your admin login.</p>
        <div className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm" />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} autoCapitalize="none" className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div onClick={handleLogin} className="w-full bg-[#4A0E52] hover:bg-[#63177A] text-white rounded-md py-2 text-sm text-center cursor-pointer flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Sign In
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Shell ---- */
/* ---- Global Search — find any member instantly from any page ---- */
function GlobalSearch({ members, onSelectMember }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = query.trim().length >= 1
    ? members.filter(m =>
        m.full_name.toLowerCase().includes(query.toLowerCase()) ||
        (m.phone && m.phone.includes(query)) ||
        (m.departments || []).some(d => d.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 8)
    : [];

  return (
    <div className="relative mb-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
        <input
          placeholder="Search any member, anywhere..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="w-full pl-9 pr-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white shadow-sm"
        />
        {query && (
          <div onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-3 top-2.5 cursor-pointer text-gray-400">
            <X className="w-4 h-4" />
          </div>
        )}
      </div>
      {open && query.trim().length >= 1 && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-lg border border-[#E9E2CC] shadow-lg max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-gray-400">No members found.</p>
          ) : results.map(m => (
            <div key={m.id}
              onMouseDown={() => { onSelectMember(m); setQuery(""); setOpen(false); }}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F7F3E9] cursor-pointer border-b border-[#F1ECDE] last:border-0">
              <div>
                <p className="text-sm font-medium">{m.full_name}</p>
                <p className="text-xs text-gray-400">{m.membership_status} {(m.departments && m.departments.length > 0) ? `· ${m.departments.join(", ")}` : ""}</p>
              </div>
              {m.phone && <span className="text-xs text-gray-400">{m.phone}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Global Search Bar — search any member from any page ---- */
function GlobalSearchBar({ members, onSelectMember }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = query.length >= 2
    ? members.filter(m =>
        !m.archived &&
        (m.full_name.toLowerCase().includes(query.toLowerCase()) ||
        (m.phone && m.phone.includes(query)) ||
        (m.departments || []).some(d => d.toLowerCase().includes(query.toLowerCase())))
      ).slice(0, 8)
    : [];

  return (
    <div className="relative z-40 mb-4">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
        <input
          placeholder="Search any member, phone, or department..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white"
        />
        {query && (
          <div onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-3 top-2.5 cursor-pointer text-gray-400">
            <X className="w-4 h-4" />
          </div>
        )}
      </div>
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E9E2CC] rounded-md shadow-lg max-h-80 overflow-y-auto z-50">
          {results.length === 0 && <p className="p-3 text-sm text-gray-400">No matches found.</p>}
          {results.map(m => (
            <div key={m.id} onClick={() => { onSelectMember(m); setQuery(""); setOpen(false); }}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F7F3E9] cursor-pointer border-b border-[#F1ECDE] last:border-0">
              <div>
                <p className="text-sm font-medium">{m.full_name}</p>
                <p className="text-xs text-gray-400">{m.membership_status}{m.departments?.length ? ` · ${m.departments.join(", ")}` : ""}</p>
              </div>
              {m.phone && <span className="text-xs text-gray-400">{m.phone}</span>}
            </div>
          ))}
        </div>
      )}
      {open && <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />}
    </div>
  );
}

function Shell({ view, setView, isAdmin, isOwner, signOut, members, onSelectMember, children }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "members", label: "Members", icon: Users },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "departments", label: "Depts", icon: BookOpen },
    ...(!isAdmin || isOwner ? [{ id: "finance", label: "Finance", icon: DollarSign }] : []),
    ...(isAdmin ? [{ id: "staff", label: "Secretariat", icon: UserCog }] : [])
  ];
  return (
    <div className="min-h-screen bg-[#F7F3E9] flex">
      <aside className="hidden md:flex w-64 shrink-0 h-screen sticky top-0 bg-[#4A0E52] text-[#EDE6D0] flex-col">
        <div className="px-6 pt-7 pb-5 border-b border-white/10">
          <Logo className="h-12 mb-2" />
          <p className="text-xs text-[#C9A5D6] font-body tracking-wide">Attendance Register</p>
        </div>
        <nav className="flex-1 py-4">
          {items.map((it) => { const Icon = it.icon; const active = view === it.id; return (
            <div key={it.id} onClick={() => setView(it.id)} className={`flex items-center gap-3 px-6 py-3 cursor-pointer text-sm ${active ? "bg-white/10 text-[#F3D98B]" : "text-[#EDE6D0] hover:bg-white/5"}`}>
              <Icon className="w-4 h-4" /> {it.label}
            </div>
          ); })}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-xs">
          <p className="mb-2 text-[#C9A5D6]">{isAdmin ? "Secretariat" : "Admin"}</p>
          <div onClick={signOut} className="flex items-center gap-2 cursor-pointer hover:text-[#F3D98B]"><LogOut className="w-3.5 h-3.5" /> Sign out</div>
        </div>
      </aside>
      <div className="flex-1 pb-16 md:pb-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#4A0E52] text-white sticky top-0 z-10">
          <Logo className="h-7" />
          <div onClick={signOut} className="text-xs flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> Sign out</div>
        </div>
        <main className="p-4 md:p-8 max-w-5xl mx-auto">
          <GlobalSearchBar members={members} onSelectMember={onSelectMember} />
          <OfflineSyncBanner />
          {children}
        </main>
      </div>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#4A0E52] flex z-10">
        {items.map((it) => { const Icon = it.icon; const active = view === it.id; return (
          <div key={it.id} onClick={() => setView(it.id)} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] ${active ? "text-[#F3D98B]" : "text-[#C7CBD6]"}`}>
            <Icon className="w-5 h-5" /> {it.label}
          </div>
        ); })}
      </nav>
    </div>
  );
}

/* ============================================================
   MEMBER LIST OVERLAY — opens from dashboard card clicks
   ============================================================ */
function MemberListOverlay({ title, subtitle, members, extra, onClose, onSelectMember, headerAction }) {
  const [search, setSearch] = useState("");
  const filtered = members.filter(m => m.full_name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-30">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-[#4A0E52] text-white px-5 py-4 rounded-t-2xl md:rounded-t-xl flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg">{title}</h2>
            {subtitle && <p className="text-[#C9A5D6] text-sm">{subtitle}</p>}
            {headerAction}
          </div>
          <div onClick={onClose} className="cursor-pointer mt-0.5"><X className="w-5 h-5" /></div>
        </div>
        {/* Search */}
        <div className="px-4 py-3 border-b border-[#E9E2CC]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F1ECDE]">
          {filtered.length === 0 && <p className="p-5 text-sm text-gray-400 text-center">No members found.</p>}
          {filtered.map((m, i) => (
            <div key={m.id || i} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 cursor-pointer" onClick={() => onSelectMember && onSelectMember(m)}>
                <p className="text-sm font-medium hover:text-[#4A0E52]">{m.full_name}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {m.membership_status && <span className="text-xs text-gray-400">{m.membership_status}</span>}
                  {(m.departments && m.departments.length > 0) && <span className="text-xs text-gray-400">· {m.departments.join(", ")}</span>}
                  {extra && extra[m.id] && <span className="text-xs text-[#4A0E52] bg-[#F7F3E9] px-2 py-0.5 rounded-full">{extra[m.id]}</span>}
                  {m.date_of_birth && <span className="text-xs text-pink-500">🎂 {new Date(m.date_of_birth).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                </div>
              </div>
              <div className="flex gap-1 items-center">
                <ContactButton phone={m.phone} />
              </div>
            </div>
          ))}
        </div>
        {/* Footer count */}
        <div className="px-5 py-3 border-t border-[#E9E2CC] text-xs text-gray-400 text-center">
          {filtered.length} member{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD VIEW
   ============================================================ */
function DashboardView({ members: allMembers, setView, isAdmin, profile }) {
  const members = allMembers.filter(m => !m.archived); // Dashboard never counts archived members
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overlay, setOverlay] = useState(null); // { title, subtitle, members, extra }
  const [selectedMember, setSelectedMember] = useState(null);

  const openOverlay = (title, subtitle, list, extra) => setOverlay({ title, subtitle, members: list, extra: extra || {} });
  const closeOverlay = () => setOverlay(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("attendance_records").select("*").order("service_date", { ascending: false });
      setRecords(data || []);
      setLoading(false);
    })();
  }, []);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

  const activeMembers = members.filter(m => m.membership_status === "Active").length;
  const newConverts = members.filter(m => m.membership_status === "New Convert").length;
  const visitors = members.filter(m => m.membership_status === "Visitor").length;

  // Members who haven't attended in 30+ days
  const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30).toISOString().slice(0, 10);
  const recentAttendees = new Set(records.filter(r => r.service_date >= thirtyDaysAgo).map(r => r.member_id));
  const needsFollowUp = members.filter(m => m.membership_status === "Active" && !recentAttendees.has(m.id)).slice(0, 5);

  // Birthday this month
  const birthdayMembers = members.filter(m => {
    if (!m.date_of_birth) return false;
    try {
      const dob = new Date(m.date_of_birth);
      return dob.getMonth() === today.getMonth();
    } catch { return false; }
  });

  // Repeat visitors (visited 2+ times)
  const visitorIds = members.filter(m => m.membership_status === "Visitor").map(m => m.id);
  const repeatVisitors = visitorIds.filter(id => records.filter(r => r.member_id === id).length >= 2)
    .map(id => members.find(m => m.id === id)).filter(Boolean);

  // Today's service attendance
  const todayRecords = records.filter(r => r.service_date === todayStr);

  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateDisplay = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      {/* Header */}
      <div className="bg-[#4A0E52] rounded-xl p-6 mb-6 text-white">
        <p className="text-[#C9A5D6] text-sm mb-1">{dayName}</p>
        <h1 className="font-display text-2xl mb-1">Welcome, {profile?.full_name || "there"}</h1>
        <p className="text-[#C9A5D6] text-sm">{dateDisplay}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Members", value: members.length, color: "text-[#4A0E52]", list: members, sub: "All church members" },
          { label: "Active", value: activeMembers, color: "text-green-600", list: members.filter(m=>m.membership_status==="Active"), sub: "Active members" },
          { label: "New Converts", value: newConverts, color: "text-[#C9A227]", list: members.filter(m=>m.membership_status==="New Convert"), sub: "New converts" },
          { label: "Visitors", value: visitors, color: "text-blue-600", list: members.filter(m=>m.membership_status==="Visitor"), sub: "Visitors" },
        ].map(s => (
          <div key={s.label} onClick={() => openOverlay(s.label, s.sub, s.list)} className="bg-white rounded-lg border border-[#E9E2CC] p-4 cursor-pointer hover:border-[#4A0E52] hover:shadow-sm transition-all">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-display ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-300 mt-1">Tap to view →</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div onClick={() => setView("attendance")} className="bg-[#4A0E52] text-white rounded-lg p-4 cursor-pointer flex items-center gap-3 hover:bg-[#63177A]">
          <CalendarCheck className="w-5 h-5 text-[#F3D98B]" />
          <span className="text-sm font-medium">Take Attendance</span>
        </div>
        <div onClick={() => setView("members")} className="bg-white border border-[#E9E2CC] rounded-lg p-4 cursor-pointer flex items-center gap-3 hover:bg-[#F7F3E9]">
          <Plus className="w-5 h-5 text-[#4A0E52]" />
          <span className="text-sm font-medium text-[#4A0E52]">Add Member</span>
        </div>
        <div onClick={() => setView("reports")} className="bg-white border border-[#E9E2CC] rounded-lg p-4 cursor-pointer flex items-center gap-3 hover:bg-[#F7F3E9]">
          <BarChart3 className="w-5 h-5 text-[#4A0E52]" />
          <span className="text-sm font-medium text-[#4A0E52]">View Reports</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Needs Follow-up */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-5">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Needs Follow-up
          </h2>
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-[#4A0E52]" /> :
            needsFollowUp.length === 0 ? <p className="text-sm text-gray-400">All active members attended recently.</p> :
            <>
              <ul className="space-y-2 mb-3">
                {needsFollowUp.map(m => (
                  <li key={m.id} className="flex items-center justify-between text-sm cursor-pointer hover:text-[#4A0E52]" onClick={() => setSelectedMember(m)}>
                    <span>{m.full_name}</span>
                    <ContactButton phone={m.phone} size="w-3 h-3" className="text-green-600 text-xs cursor-pointer" />
                  </li>
                ))}
              </ul>
              <div onClick={() => openOverlay("Needs Follow-up", "Active members not seen in 30+ days", members.filter(m=>m.membership_status==="Active" && !recentAttendees.has(m.id)))}
                className="text-xs text-[#4A0E52] cursor-pointer font-medium">View all {members.filter(m=>m.membership_status==="Active" && !recentAttendees.has(m.id)).length} →</div>
            </>
          }
        </div>

        {/* Repeat Visitors */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-5">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#C9A227]" /> Repeat Visitors
          </h2>
          {repeatVisitors.length === 0 ? <p className="text-sm text-gray-400">No repeat visitors yet.</p> :
            <>
              <ul className="space-y-2 mb-3">
                {repeatVisitors.slice(0,4).map(m => (
                  <li key={m.id} className="flex items-center justify-between text-sm cursor-pointer hover:text-[#4A0E52]" onClick={() => setSelectedMember(m)}>
                    <span>{m.full_name}</span>
                    <span className="text-xs text-[#C9A227] bg-[#FEF9EC] px-2 py-0.5 rounded-full">
                      {records.filter(r => r.member_id === m.id).length} visits
                    </span>
                  </li>
                ))}
              </ul>
              <div onClick={() => openOverlay("Repeat Visitors", "Visited 2+ times — ready to convert?", repeatVisitors, Object.fromEntries(repeatVisitors.map(m=>[m.id, records.filter(r=>r.member_id===m.id).length+" visits"])))}
                className="text-xs text-[#4A0E52] cursor-pointer font-medium">View all {repeatVisitors.length} →</div>
            </>
          }
        </div>

        {/* Birthdays This Month */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-5">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" /> Birthdays This Month
          </h2>
          {birthdayMembers.length === 0 ?
            <p className="text-sm text-gray-400">No birthdays recorded this month. Add dates of birth in member profiles.</p> :
            <>
              <ul className="space-y-2 mb-3">
                {birthdayMembers.slice(0,4).map(m => (
                  <li key={m.id} className="flex items-center justify-between text-sm cursor-pointer hover:text-[#4A0E52]" onClick={() => setSelectedMember(m)}>
                    <span>{m.full_name}</span>
                    <span className="text-xs text-pink-500">🎂 {new Date(m.date_of_birth).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  </li>
                ))}
              </ul>
              <div onClick={() => openOverlay("Birthdays This Month","Members celebrating this month",birthdayMembers)}
                className="text-xs text-[#4A0E52] cursor-pointer font-medium">View all {birthdayMembers.length} →</div>
            </>
          }
        </div>

        {/* Department Summary */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-5">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#4A0E52]" /> Departments
          </h2>
          <div className="space-y-2">
            {Object.entries(
              members.reduce((acc, m) => {
                (m.departments || []).forEach(d => { acc[d] = (acc[d] || 0) + 1; });
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dept, count]) => (
              <div key={dept} onClick={() => openOverlay(dept, "Department members", members.filter(m => (m.departments || []).includes(dept)))}
                className="flex items-center justify-between text-sm cursor-pointer hover:bg-[#F7F3E9] px-2 py-1 rounded-lg -mx-2 transition-colors">
                <span>{dept}</span>
                <span className="text-xs bg-[#F7F3E9] text-[#4A0E52] px-2 py-0.5 rounded-full font-medium">{count} →</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Overlay for clicked dashboard cards */}
      {overlay && (
        <MemberListOverlay
          title={overlay.title}
          subtitle={overlay.subtitle}
          members={overlay.members}
          extra={overlay.extra}
          onClose={closeOverlay}
          onSelectMember={(m) => { closeOverlay(); setSelectedMember(m); }}
        />
      )}

      {/* Member profile from dashboard item click */}
      {selectedMember && (
        <MemberProfileModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          isAdmin={isAdmin}
          onEdit={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   MEMBER PROFILE MODAL
   ============================================================ */
function MemberProfileModal({ member: initialMember, onClose, isAdmin, onEdit, onRefresh }) {
  const [member, setMember] = useState(initialMember);
  const [records, setRecords] = useState([]);
  const [allSessions, setAllSessions] = useState(0);
  const [absences, setAbsences] = useState([]); // sessions this member missed
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ ...initialMember });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: memberRecs }, { data: allRecs }] = await Promise.all([
        supabase.from("attendance_records").select("*").eq("member_id", member.id).order("service_date", { ascending: false }),
        supabase.from("attendance_records").select("service_date,service_type")
      ]);
      setRecords(memberRecs || []);

      // Build the full set of sessions that actually happened (deduped by date+type)
      const sessionMap = new Map();
      (allRecs || []).forEach(r => sessionMap.set(`${r.service_date}_${r.service_type}`, { service_date: r.service_date, service_type: r.service_type }));
      setAllSessions(sessionMap.size);

      // A session is a miss if this member has no attendance row for it.
      // Skip sessions that happened before this member joined, when we know their join date.
      const attendedKeys = new Set((memberRecs || []).map(r => `${r.service_date}_${r.service_type}`));
      const missed = [...sessionMap.entries()]
        .filter(([key, v]) => !attendedKeys.has(key) && (!member.date_joined || v.service_date >= member.date_joined))
        .map(([, v]) => v)
        .sort((a, b) => b.service_date.localeCompare(a.service_date));
      setAbsences(missed);

      setLoading(false);
    })();
  }, [member.id]);

  const saveEdit = async () => {
    if (!editData.full_name) return;
    setSaving(true);
    const { departments, ...payload } = editData; // departments is a display-only field, not a real column
    const { error } = await supabase.from("members").update(payload).eq("id", member.id);
    setSaving(false);
    if (error) { alert("Could not save changes: " + error.message); return; }
    setSaved(true);
    setMember(editData);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
    if (onRefresh) onRefresh();
  };

  const rate = allSessions > 0 ? Math.round((records.length / allSessions) * 100) : 0;
  const byService = SERVICES.map(s => ({ name: s.label, count: records.filter(r => r.service_type === s.id).length }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-[#4A0E52] text-white p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-display text-xl">{member.full_name}</h2>
              <p className="text-[#C9A5D6] text-sm">{(member.departments && member.departments.length) ? member.departments.join(" · ") : "No department"}</p>
            </div>
            <div onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              member.membership_status === "Active" ? "bg-green-500/20 text-green-200" :
              member.membership_status === "New Convert" ? "bg-yellow-500/20 text-yellow-200" :
              member.membership_status === "Visitor" ? "bg-blue-500/20 text-blue-200" :
              "bg-white/10 text-white/70"
            }`}>{member.membership_status}</span>
            <ContactButton phone={member.phone} size="w-3 h-3" label="Contact"
              className="text-xs px-2.5 py-1 rounded-full bg-green-600 text-white flex items-center gap-1 cursor-pointer" />
            {!editing && (
              <div onClick={() => { setEditData({ ...member }); setEditing(true); setTab("edit"); }}
                className="text-xs px-2.5 py-1 rounded-full bg-white/20 text-white cursor-pointer flex items-center gap-1 border border-white/30">
                <Pencil className="w-3 h-3" /> Edit Profile
              </div>
            )}
            {saved && <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/30 text-green-200">✓ Saved!</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E9E2CC]">
          {["info", "attendance", "edit"].map(t => (
            <div key={t} onClick={() => { setTab(t); if (t === "edit") { setEditData({ ...member }); setEditing(true); } else setEditing(false); }}
              className={`flex-1 text-center py-3 text-sm cursor-pointer font-medium ${tab === t ? "text-[#4A0E52] border-b-2 border-[#4A0E52]" : "text-gray-400"}`}>
              {t === "info" ? "Info" : t === "attendance" ? "Attendance" : "✏️ Edit"}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "info" ? (
            <div className="space-y-3">
              {[
                { icon: Phone, label: "Phone", value: member.phone },
                { icon: Mail, label: "Email", value: member.email },
                { icon: MapPin, label: "Address", value: member.address },
                { icon: Briefcase, label: "Occupation", value: member.occupation },
                { icon: Users, label: "Marital Status", value: member.marital_status },
                { icon: Heart, label: "Date of Birth", value: member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString("en-US", {month:"long", day:"numeric", year:"numeric"}) : null },
                { icon: CalendarCheck, label: "Date Joined", value: member.date_joined ? new Date(member.date_joined).toLocaleDateString() : null },
              ].filter(f => f.value).map(f => (
                <div key={f.label} className="flex items-start gap-3">
                  <f.icon className="w-4 h-4 text-[#4A0E52] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{f.label}</p>
                    <p className="text-sm">{f.value}</p>
                  </div>
                </div>
              ))}
              {member.notes && (
                <div className="bg-[#F7F3E9] rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Notes</p>
                  <p className="text-sm">{member.notes}</p>
                </div>
              )}
            </div>
          ) : tab === "edit" ? (
            <div>
              <Field label="Full name" value={editData.full_name} onChange={v => setEditData({ ...editData, full_name: v })} />
              <Field label="Phone" value={editData.phone} onChange={v => setEditData({ ...editData, phone: v })} />
              <Field label="Email" value={editData.email} onChange={v => setEditData({ ...editData, email: v })} />
              <Field label="Address" value={editData.address} onChange={v => setEditData({ ...editData, address: v })} />
              <Field label="Date of Birth" type="date" value={editData.date_of_birth} onChange={v => setEditData({ ...editData, date_of_birth: v })} />
              <Field label="Gender" value={editData.gender} onChange={v => setEditData({ ...editData, gender: v })} />
              <Field label="Marital Status" value={editData.marital_status} onChange={v => setEditData({ ...editData, marital_status: v })} />
              <Field label="Occupation" value={editData.occupation} onChange={v => setEditData({ ...editData, occupation: v })} />
              <Field label="Department" value={editData.department} onChange={v => setEditData({ ...editData, department: v })} />
              <Field label="Date Joined" type="date" value={editData.date_joined} onChange={v => setEditData({ ...editData, date_joined: v })} />
              <Field label="Membership Status" type="select" value={editData.membership_status} onChange={v => setEditData({ ...editData, membership_status: v })} />
              <Field label="Notes" value={editData.notes} onChange={v => setEditData({ ...editData, notes: v })} />
              <div onClick={saveEdit} className="mt-2 bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </div>
            </div>
          ) : (
            <div>
              {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#4A0E52] mx-auto" /> : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-[#F7F3E9] rounded-lg p-3 text-center">
                      <p className="text-xl font-display text-[#4A0E52]">{records.length}</p>
                      <p className="text-xs text-gray-400">Attended</p>
                    </div>
                    <div className="bg-[#F7F3E9] rounded-lg p-3 text-center">
                      <p className="text-xl font-display text-[#4A0E52]">{allSessions}</p>
                      <p className="text-xs text-gray-400">Total Sessions</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${rate >= 75 ? "bg-green-50" : rate >= 50 ? "bg-yellow-50" : "bg-red-50"}`}>
                      <p className={`text-xl font-display ${rate >= 75 ? "text-green-600" : rate >= 50 ? "text-yellow-600" : "text-red-600"}`}>{rate}%</p>
                      <p className="text-xs text-gray-400">Rate</p>
                    </div>
                  </div>

                  {/* By Service */}
                  <div className="mb-5">
                    <p className="text-xs text-gray-400 mb-2">By Service Type</p>
                    {byService.map(s => (
                      <div key={s.name} className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 w-36 shrink-0">{s.name}</span>
                        <div className="flex-1 bg-[#F1ECDE] rounded-full h-2">
                          <div className="bg-[#4A0E52] h-2 rounded-full" style={{width: `${records.length ? (s.count/records.length)*100 : 0}%`}} />
                        </div>
                        <span className="text-xs font-medium w-4">{s.count}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recent History */}
                  <p className="text-xs text-gray-400 mb-2">Recent Attendance</p>
                  {records.length === 0 ? <p className="text-sm text-gray-400">No attendance records yet.</p> :
                    <div className="space-y-1 mb-5">
                      {records.slice(0, 10).map(r => (
                        <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-[#F1ECDE]">
                          <span className="text-xs text-gray-500">{new Date(r.service_date).toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"})}</span>
                          <span className="text-xs bg-[#F7F3E9] text-[#4A0E52] px-2 py-0.5 rounded-full">{r.service_type}</span>
                        </div>
                      ))}
                    </div>
                  }

                  {/* Missed Services */}
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-400" /> Missed Services ({absences.length})</p>
                  {absences.length === 0 ? <p className="text-sm text-gray-400">No missed services on record — full attendance!</p> :
                    <div className="space-y-1">
                      {absences.slice(0, 10).map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-[#F1ECDE]">
                          <span className="text-xs text-gray-500">{new Date(a.service_date).toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"})}</span>
                          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">{a.service_type}</span>
                        </div>
                      ))}
                      {absences.length > 10 && <p className="text-xs text-gray-400 pt-1">+ {absences.length - 10} more missed</p>}
                    </div>
                  }
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ATTENDANCE VIEW — with Select All & Print
   ============================================================ */
function AttendanceView({ members: allMembers, jump }) {
  const members = allMembers.filter(m => !m.archived); // never mark attendance for archived members
  const [service, setService] = useState(jump ? jump.service : SERVICES[0].id);
  const [date, setDate] = useState(jump ? jump.date : new Date().toISOString().slice(0, 10));
  const [present, setPresent] = useState({});

  // Jump here from Reports with a specific date/service (e.g. "View in Attendance →")
  useEffect(() => {
    if (jump) {
      setDate(jump.date);
      setService(jump.service);
    }
  }, [jump]);
  const [originalPresent, setOriginalPresent] = useState({}); // snapshot of what's actually saved in the DB
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("service_notes").select("note").eq("service_type", service).eq("service_date", date).maybeSingle();
      setNote(data?.note || "");
      setOriginalNote(data?.note || "");
    })();
  }, [service, date]);

  const saveNote = async () => {
    if (note === originalNote) return;
    setNoteSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("service_notes")
      .upsert({ service_type: service, service_date: date, note, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: "service_date,service_type" });
    setNoteSaving(false);
    if (error) { alert("Could not save note: " + error.message); return; }
    setOriginalNote(note);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2500);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("attendance_records").select("member_id").eq("service_type", service).eq("service_date", date);
      const map = {};
      (data || []).forEach((r) => (map[r.member_id] = true));
      setPresent(map);
      setOriginalPresent(map);
    })();
  }, [service, date]);

  const toggle = (id) => setPresent((p) => ({ ...p, [id]: !p[id] }));
  const selectAll = () => { const map = {}; filtered.forEach(m => map[m.id] = true); setPresent(p => ({ ...p, ...map })); };
  const clearAll = () => { const map = {}; filtered.forEach(m => map[m.id] = false); setPresent(p => ({ ...p, ...map })); };

  // Auto-detect which service a picked date belongs to:
  // Sunday -> Sunday Service, Wednesday -> Wednesday Service, first Saturday of the month -> 7HWG
  const serviceForDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const picked = new Date(y, m - 1, d);
    const dayOfWeek = picked.getDay(); // 0=Sun, 3=Wed, 6=Sat
    if (dayOfWeek === 0) return "Sunday Service";
    if (dayOfWeek === 3) return "Wednesday Service";
    if (dayOfWeek === 6) {
      const isFirstSaturday = d <= 7;
      if (isFirstSaturday) return "7HWG";
    }
    return null; // no automatic match — leave service as-is
  };

  const handleDateChange = (newDate) => {
    setDate(newDate);
    const matched = serviceForDate(newDate);
    if (matched) setService(matched);
  };

  const [savedOffline, setSavedOffline] = useState(false);

  const save = async () => {
    setSaving(true);
    const rows = Object.entries(present).filter(([, v]) => v).map(([member_id]) => ({ member_id, service_type: service, service_date: date, present: true }));
    // Anyone who was saved as present before, but is now unchecked, needs their record removed —
    // otherwise unmarking someone by mistake never actually took effect.
    const toUnmark = Object.keys(originalPresent).filter(id => originalPresent[id] && !present[id]);

    if (!navigator.onLine) {
      if (rows.length) addToOfflineQueue(rows);
      setSaving(false); setSavedOffline(true);
      setTimeout(() => setSavedOffline(false), 4000);
      return;
    }

    try {
      if (rows.length) {
        const { error } = await supabase.from("attendance_records").upsert(rows, { onConflict: "member_id,service_type,service_date" });
        if (error) {
          setSaving(false);
          alert("Could not save attendance: " + error.message);
          return;
        }
      }
      if (toUnmark.length) {
        const { error } = await supabase.from("attendance_records").delete()
          .eq("service_type", service).eq("service_date", date).in("member_id", toUnmark);
        if (error) {
          setSaving(false);
          alert("Could not remove unmarked attendance: " + error.message);
          return;
        }
      }
    } catch (e) {
      // Genuine network failure — queue the additions for retry (removals require connectivity)
      if (rows.length) addToOfflineQueue(rows);
      setSaving(false); setSavedOffline(true);
      setTimeout(() => setSavedOffline(false), 4000);
      return;
    }

    setOriginalPresent(present); // snapshot now matches what's actually saved
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const [showDownloadAuth, setShowDownloadAuth] = useState(false);

  const handlePrint = () => {
    const presentMembers = filtered.filter(m => present[m.id]);
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>Attendance - ${service} ${date}</title><style>body{font-family:Arial;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px;font-size:13px}th{background:#f0f0f0}</style></head><body>`);
    win.document.write(`<h1>${service} — ${date}</h1><p>Present: ${presentMembers.length} members</p>`);
    win.document.write(`<table><tr><th>#</th><th>Name</th><th>Department</th><th>Phone</th></tr>`);
    presentMembers.forEach((m, i) => win.document.write(`<tr><td>${i+1}</td><td>${m.full_name}</td><td>${m.department || ""}</td><td>${m.phone || ""}</td></tr>`));
    win.document.write(`</body></html>`);
    win.document.close(); win.print();
  };

  const filtered = members.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()));
  const presentCount = filtered.filter(m => present[m.id]).length;

  return (
    <div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-4">SCC Attendance</h1>
      <div className="flex flex-wrap gap-3 mb-2">
        <select value={service} onChange={(e) => setService(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white" />
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">Pick a date and the service auto-selects: Sundays → Sunday Service, Wednesdays → Wednesday Service, first Saturday of the month → 7HWG.</p>

      {/* Service note */}
      <div className="bg-white rounded-lg border border-[#E9E2CC] p-3 mb-4">
        <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-400">
          <StickyNote className="w-3.5 h-3.5" /> Note for this service
          {noteSaving && <Loader2 className="w-3 h-3 animate-spin text-[#4A0E52]" />}
          {noteSaved && <span className="text-[#4A0E52]">Saved</span>}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder="e.g. Guest preacher, communion service, rain affected turnout…"
          rows={2}
          className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:border-[#4A0E52]"
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-2">
          <div onClick={selectAll} className="text-xs border border-[#4A0E52] text-[#4A0E52] rounded-md px-3 py-1.5 cursor-pointer flex items-center gap-1">
            <CheckCheck className="w-3.5 h-3.5" /> Select All
          </div>
          <div onClick={clearAll} className="text-xs border border-gray-300 text-gray-500 rounded-md px-3 py-1.5 cursor-pointer flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Clear
          </div>
        </div>
        <span className="text-sm text-[#4A0E52] font-medium">{presentCount} present</span>
      </div>

      <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
        {filtered.map((m) => (
          <div key={m.id} onClick={() => toggle(m.id)} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F7F3E9]">
            <div>
              <p className="text-sm">{m.full_name}</p>
              {(m.departments && m.departments.length > 0) && <p className="text-xs text-gray-400">{m.departments.join(", ")}</p>}
            </div>
            <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${present[m.id] ? "bg-[#C9A227] border-[#C9A227] text-white" : "border-[#D9D2BC] text-transparent"}`}>✓</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-400">No members found.</p>}
      </div>

      <div className="mt-4 flex gap-3 flex-wrap">
        <div onClick={save} className="inline-flex items-center gap-2 bg-[#4A0E52] hover:bg-[#63177A] text-white rounded-md px-5 py-2.5 text-sm cursor-pointer">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCheck className="w-4 h-4" /> : savedOffline ? <WifiOff className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : savedOffline ? "Saved offline — will sync" : "Save Attendance"}
        </div>
        <div onClick={() => setShowDownloadAuth(true)} className="inline-flex items-center gap-2 border border-[#4A0E52] text-[#4A0E52] rounded-md px-5 py-2.5 text-sm cursor-pointer">
          <Printer className="w-4 h-4" /> Print Register
        </div>
      </div>
      {showDownloadAuth && (
        <PasswordPromptModal
          featureKey="download"
          title="Confirm Print"
          onSuccess={() => { setShowDownloadAuth(false); handlePrint(); }}
          onClose={() => setShowDownloadAuth(false)}
        />
      )}
    </div>
  );
}

/* ============================================================
   MEMBERS VIEW — with profile, department filter, archive, WhatsApp
   ============================================================ */
const emptyMember = { full_name:"", phone:"", email:"", address:"", date_of_birth:"", gender:"", marital_status:"", occupation:"", department:"", date_joined:"", membership_status:"Active", notes:"" };

function MembersView({ members, refresh, isAdmin }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [undoData, setUndoData] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState("name-asc");

  const departments = ["All", ...Array.from(new Set(members.flatMap(m => m.departments || []))).sort()];

  const filtered = members
    .filter((m) => {
      if (showArchived ? !m.archived : m.archived) return false;
      if (deptFilter !== "All" && !(m.departments || []).includes(deptFilter)) return false;
      if (statusFilter !== "All" && m.membership_status !== statusFilter) return false;
      return m.full_name.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === "name-asc") return a.full_name.localeCompare(b.full_name);
      if (sortBy === "name-desc") return b.full_name.localeCompare(a.full_name);
      if (sortBy === "joined-newest") return (b.date_joined || "").localeCompare(a.date_joined || "");
      if (sortBy === "joined-oldest") return (a.date_joined || "").localeCompare(b.date_joined || "");
      return 0;
    });

  const save = async () => {
    if (!editing.full_name) return;
    const { departments, ...payload } = editing; // departments is a display-only field, not a real column
    if (editing.id) {
      const { error } = await supabase.from("members").update(payload).eq("id", editing.id);
      if (error) { alert("Could not save member: " + error.message); return; }
    } else {
      const { error } = await supabase.from("members").insert([payload]);
      if (error) { alert("Could not add member: " + error.message); return; }
    }
    setEditing(null); refresh();
  };

  const requestDelete = (member) => setConfirmDelete(member);

  const confirmRemove = async () => {
    const member = confirmDelete;
    setConfirmDelete(null);
    await supabase.from("members").update({ archived: true }).eq("id", member.id);
    setUndoData(member); refresh();
  };

  const handleUndo = async () => {
    if (!undoData) return;
    await supabase.from("members").update({ archived: false }).eq("id", undoData.id);
    setUndoData(null); refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[#4A0E52]">Members</h1>
        <div className="flex gap-2">
          <div onClick={() => setShowImport(true)} className="flex items-center gap-1 border border-[#4A0E52] text-[#4A0E52] rounded-md px-3 py-2 text-sm cursor-pointer">
            <Upload className="w-4 h-4" /> Import
          </div>
          <div onClick={() => setEditing({ ...emptyMember })} className="flex items-center gap-1 bg-[#4A0E52] text-white rounded-md px-3 py-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> Add
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white" />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          <option value="All">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          <option value="name-asc">Name (A–Z)</option>
          <option value="name-desc">Name (Z–A)</option>
          <option value="joined-newest">Newest Joined</option>
          <option value="joined-oldest">Oldest Joined</option>
        </select>
      </div>

      {/* Archive toggle */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm text-gray-500">{filtered.length} {showArchived ? "archived" : "members"}</span>
        <div onClick={() => setShowArchived(!showArchived)} className={`text-xs cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-full border ${showArchived ? "bg-[#4A0E52] text-white border-[#4A0E52]" : "border-gray-300 text-gray-500"}`}>
          <Archive className="w-3 h-3" /> {showArchived ? "Showing Archived" : "Show Archived"}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
        {filtered.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 cursor-pointer" onClick={() => setSelectedMember(m)}>
              <p className="text-sm font-medium hover:text-[#4A0E52]">{m.full_name}</p>
              <p className="text-xs text-gray-400">{m.membership_status} {(m.departments && m.departments.length > 0) ? `· ${m.departments.join(", ")}` : ""}</p>
            </div>
            <div className="flex items-center gap-1">
              <ContactButton phone={m.phone} />
              <div onClick={() => setEditing(m)} className="p-2 cursor-pointer text-[#4A0E52]"><Pencil className="w-4 h-4" /></div>
              <div onClick={() => requestDelete(m)} className="p-2 cursor-pointer text-red-500"><Archive className="w-4 h-4" /></div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-400">No members found.</p>}
      </div>

      {/* Member Profile Modal */}
      {selectedMember && (
        <MemberProfileModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          isAdmin={isAdmin}
          onEdit={(m) => { setSelectedMember(null); setEditing(m); }}
        />
      )}

      {/* Edit / Add Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52]">{editing.id ? "Edit Member" : "Add Member"}</h2>
              <div onClick={() => setEditing(null)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <Field label="Full name" value={editing.full_name} onChange={(v) => setEditing({ ...editing, full_name: v })} />
            <Field label="Phone" value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
            <Field label="Email" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
            <Field label="Address" value={editing.address} onChange={(v) => setEditing({ ...editing, address: v })} />
            <Field label="Date of birth" type="date" value={editing.date_of_birth} onChange={(v) => setEditing({ ...editing, date_of_birth: v })} />
            <Field label="Gender" value={editing.gender} onChange={(v) => setEditing({ ...editing, gender: v })} />
            <Field label="Marital status" value={editing.marital_status} onChange={(v) => setEditing({ ...editing, marital_status: v })} />
            <Field label="Occupation" value={editing.occupation} onChange={(v) => setEditing({ ...editing, occupation: v })} />
            <Field label="Department" value={editing.department} onChange={(v) => setEditing({ ...editing, department: v })} />
            <Field label="Date joined" type="date" value={editing.date_joined} onChange={(v) => setEditing({ ...editing, date_joined: v })} />
            <Field label="Membership status" type="select" value={editing.membership_status} onChange={(v) => setEditing({ ...editing, membership_status: v })} />
            <Field label="Notes" value={editing.notes} onChange={(v) => setEditing({ ...editing, notes: v })} />
            <div onClick={save} className="mt-2 bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer">Save Member</div>
          </div>
        </div>
      )}

      {showImport && <BulkImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); refresh(); }} />}

      {confirmDelete && (
        <ConfirmDialog name={confirmDelete.full_name} type="member" onConfirm={confirmRemove} onCancel={() => setConfirmDelete(null)} />
      )}
      {undoData && (
        <UndoToast message={`"${undoData.full_name}" archived.`} onUndo={handleUndo} onDismiss={() => setUndoData(null)} />
      )}
    </div>
  );
}

/* ---- Bulk Import ---- */
function BulkImportModal({ onClose, onDone }) {
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [showDownloadAuth, setShowDownloadAuth] = useState(false);
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => setRows(res.data) });
  };
  const doImport = async () => {
    setImporting(true);
    const mapped = rows.map((r) => ({ full_name: r["Full Name"] || r["full_name"] || r["Full name"] || r["Name"] || "", phone: r["Phone"] || r["Phone Number"] || r["phone"] || "", email: r["Email"] || r["email"] || "", membership_status: r["Membership Status"] || r["Membership status"] || r["membership_status"] || "Active" })).filter((r) => r.full_name);
    if (mapped.length) await supabase.from("members").insert(mapped);
    setImporting(false); onDone();
  };
  const downloadTemplate = () => {
    const csv = "Full Name,Phone,Email,Membership Status\nJane Doe,08012345678,jane@example.com,Active\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "scc_members_template.csv"; a.click();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg text-[#4A0E52]">Bulk Import Members</h2>
          <div onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></div>
        </div>
        <div onClick={() => setShowDownloadAuth(true)} className="flex items-center gap-2 text-sm text-[#4A0E52] cursor-pointer mb-4"><Download className="w-4 h-4" /> Download CSV template</div>
        <input type="file" accept=".csv" onChange={handleFile} className="text-sm mb-3" />
        {rows.length > 0 && <p className="text-xs text-gray-500 mb-3">{rows.length} rows detected.</p>}
        <div onClick={doImport} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Import {rows.length || ""} Members
        </div>
        {showDownloadAuth && (
          <PasswordPromptModal
            featureKey="download"
            title="Confirm Download"
            onSuccess={() => { setShowDownloadAuth(false); downloadTemplate(); }}
            onClose={() => setShowDownloadAuth(false)}
          />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   REPORTS VIEW — enhanced with visitor tracker
   ============================================================ */
/* ---- Service Sessions Overlay — every logged service in the period, drill into attendees ---- */
function ServiceSessionsOverlay({ sessions, onClose, onSelectSession }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-30">
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="bg-[#4A0E52] text-white px-5 py-4 rounded-t-2xl md:rounded-t-xl flex items-center justify-between">
          <h2 className="font-display text-lg">Services Logged</h2>
          <div onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-[#F1ECDE]">
          {sessions.length === 0 && <p className="p-5 text-sm text-gray-400 text-center">No services logged in this period.</p>}
          {sessions.map((s, i) => (
            <div key={i} onClick={() => onSelectSession(s)} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F7F3E9]">
              <div>
                <p className="text-sm font-medium">{new Date(s.service_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
                <p className="text-xs text-gray-400">{s.service_type}</p>
                {s.note && <p className="text-xs text-[#4A0E52] mt-0.5 flex items-center gap-1"><StickyNote className="w-3 h-3" /> {s.note}</p>}
              </div>
              <span className="text-xs bg-[#F7F3E9] text-[#4A0E52] px-2.5 py-1 rounded-full font-medium">{s.memberIds.length} attended →</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsView({ members, onGoToAttendance }) {
  const [records, setRecords] = useState([]);
  const [serviceNotes, setServiceNotes] = useState([]);
  const [range, setRange] = useState(() => ({ ...presetToRange("This month"), label: "This month" }));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("attendance_records").select("*").order("service_date", { ascending: true });
      setRecords(data || []);
      const { data: notes } = await supabase.from("service_notes").select("service_date, service_type, note");
      setServiceNotes(notes || []);
    })();
  }, []);

  const noteFor = (date, type) => serviceNotes.find(n => n.service_date === date && n.service_type === type)?.note || "";

  const filteredRecords = useMemo(() => records.filter(r => r.service_date >= range.start && r.service_date <= range.end), [records, range]);
  const activeMembers = members.filter(m => !m.archived);

  const bySession = useMemo(() => {
    const map = {};
    filteredRecords.forEach((r) => { const key = `${r.service_date} ${r.service_type}`; map[key] = (map[key] || 0) + 1; });
    return Object.entries(map).slice(-12).map(([key, count]) => ({ name: key, count }));
  }, [filteredRecords]);

  const byServiceType = useMemo(() => {
    const map = {};
    SERVICES.forEach(s => (map[s.id] = { total: 0, sessions: new Set() }));
    filteredRecords.forEach(r => { if (!map[r.service_type]) map[r.service_type] = { total: 0, sessions: new Set() }; map[r.service_type].total += 1; map[r.service_type].sessions.add(r.service_date); });
    return Object.entries(map).map(([type, v]) => ({ name: type, avg: v.sessions.size ? Math.round(v.total / v.sessions.size) : 0 }));
  }, [filteredRecords]);

  const memberRates = useMemo(() => {
    const sessions = new Set(filteredRecords.map(r => `${r.service_date}_${r.service_type}`)).size || 1;
    return activeMembers.map(m => { const attended = filteredRecords.filter(r => r.member_id === m.id).length; return { ...m, rate: Math.round((attended / sessions) * 100) }; });
  }, [filteredRecords, activeMembers]);

  const atRisk = memberRates.filter(m => m.rate < 50).sort((a, b) => a.rate - b.rate);
  const faithful = [...memberRates].sort((a, b) => b.rate - a.rate).slice(0, 5);
  const totalSessions = new Set(filteredRecords.map(r => `${r.service_date}_${r.service_type}`)).size;

  // Every distinct service session in the selected period, with who attended
  const sessionsList = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      const key = `${r.service_date}_${r.service_type}`;
      if (!map[key]) map[key] = { service_date: r.service_date, service_type: r.service_type, memberIds: [] };
      map[key].memberIds.push(r.member_id);
    });
    return Object.values(map).map(s => ({ ...s, note: noteFor(s.service_date, s.service_type) })).sort((a, b) => b.service_date.localeCompare(a.service_date));
  }, [filteredRecords, serviceNotes]);

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessionMemberOverlay, setSessionMemberOverlay] = useState(null);
  const [selectedMemberFromSession, setSelectedMemberFromSession] = useState(null);

  const handleSelectSession = (session) => {
    const sessionMembers = session.memberIds.map(id => members.find(m => m.id === id)).filter(Boolean);
    setSessionsOpen(false);
    setSessionMemberOverlay({
      title: `${session.service_type} — ${new Date(session.service_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      subtitle: `${sessionMembers.length} member${sessionMembers.length !== 1 ? "s" : ""} attended${session.note ? ` · ${session.note}` : ""}`,
      members: sessionMembers,
      service_date: session.service_date,
      service_type: session.service_type
    });
  };

  // Repeat visitors
  const visitorIds = members.filter(m => m.membership_status === "Visitor").map(m => m.id);
  const repeatVisitors = visitorIds.filter(id => records.filter(r => r.member_id === id).length >= 2)
    .map(id => { const m = members.find(x => x.id === id); return m ? { ...m, visits: records.filter(r => r.member_id === id).length } : null; }).filter(Boolean);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="font-display text-2xl text-[#4A0E52]">Reports</h1>
        <DateRangePicker range={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-4"><p className="text-xs text-gray-400">Total Members</p><p className="text-2xl font-display text-[#4A0E52]">{activeMembers.length}</p></div>
        <div onClick={() => setSessionsOpen(true)} className="bg-white rounded-lg border border-[#E9E2CC] p-4 cursor-pointer hover:border-[#4A0E52] hover:shadow-sm transition-all"><p className="text-xs text-gray-400">Services Logged</p><p className="text-2xl font-display text-[#4A0E52]">{totalSessions}</p><p className="text-xs text-gray-300 mt-1">Tap to view →</p></div>
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-4"><p className="text-xs text-gray-400">Avg Attendance</p><p className="text-2xl font-display text-[#4A0E52]">{totalSessions ? Math.round(filteredRecords.length / totalSessions) : 0}</p></div>
      </div>

      <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
        <h2 className="font-display text-base mb-3">Attendance Trend (last 12 sessions)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={bySession}><CartesianGrid stroke="#F1ECDE" /><XAxis dataKey="name" tick={{ fontSize: 9 }} hide /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#C9A227" strokeWidth={2} dot={false} /></LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
        <h2 className="font-display text-base mb-3">Average Attendance by Service</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byServiceType}><CartesianGrid stroke="#F1ECDE" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="avg" fill="#4A0E52" radius={[4,4,0,0]} /></BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
          <h2 className="font-display text-base mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-[#C9A227]" /> Most Faithful</h2>
          <ul className="space-y-2">{faithful.map(m => (<li key={m.id} className="flex justify-between text-sm"><span>{m.full_name}</span><span className="text-[#C9A227] font-medium">{m.rate}%</span></li>))}</ul>
        </div>
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
          <h2 className="font-display text-base mb-3 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Needs Follow-up</h2>
          {atRisk.length === 0 ? <p className="text-sm text-gray-400">No one below 50%.</p> :
            <ul className="space-y-2">{atRisk.map(m => (<li key={m.id} className="flex justify-between text-sm"><span>{m.full_name}</span><span className="text-red-500 font-medium">{m.rate}%</span></li>))}</ul>}
        </div>
      </div>

      {/* Repeat Visitors */}
      {repeatVisitors.length > 0 && (
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
          <h2 className="font-display text-base mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-500" /> Repeat Visitors — Ready to Convert?</h2>
          <ul className="space-y-2">
            {repeatVisitors.map(m => (
              <li key={m.id} className="flex justify-between items-center text-sm">
                <div><p>{m.full_name}</p>{m.phone && <p className="text-xs text-gray-400">{m.phone}</p>}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{m.visits} visits</span>
                  <ContactButton phone={m.phone} size="w-3 h-3" className="text-green-600 text-xs cursor-pointer" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sessionsOpen && (
        <ServiceSessionsOverlay sessions={sessionsList} onClose={() => setSessionsOpen(false)} onSelectSession={handleSelectSession} />
      )}
      {sessionMemberOverlay && (
        <MemberListOverlay
          title={sessionMemberOverlay.title}
          subtitle={sessionMemberOverlay.subtitle}
          members={sessionMemberOverlay.members}
          onClose={() => setSessionMemberOverlay(null)}
          onSelectMember={(m) => { setSessionMemberOverlay(null); setSelectedMemberFromSession(m); }}
          headerAction={onGoToAttendance && (
            <div
              onClick={() => { onGoToAttendance(sessionMemberOverlay.service_date, sessionMemberOverlay.service_type); setSessionMemberOverlay(null); }}
              className="text-[#F3D98B] text-xs font-medium cursor-pointer mt-1 hover:underline"
            >
              View in Attendance →
            </div>
          )}
        />
      )}
      {selectedMemberFromSession && (
        <MemberProfileModal
          member={selectedMemberFromSession}
          onClose={() => setSelectedMemberFromSession(null)}
          isAdmin={false}
          onEdit={() => {}}
        />
      )}
    </div>
  );
}


/* ============================================================
   DEPARTMENTS VIEW
   ============================================================ */
function DepartmentsView({ members, refresh, isAdmin }) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { id, name, description }
  const [showCreate, setShowCreate] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [assigningMember, setAssigningMember] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const loadDepts = async () => {
    setLoading(true);
    const { data } = await supabase.from("departments").select("*").order("name");
    setDepartments(data || []);
    setLoading(false);
  };

  useEffect(() => { loadDepts(); }, []);

  const deptMembers = selected
    ? members.filter(m => (m.departments || []).includes(selected.name) && !m.archived)
    : [];

  const unassignedInDept = members.filter(m =>
    !m.archived &&
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) &&
    !(m.departments || []).includes(selected?.name)
  );

  const createDept = async () => {
    if (!newDept.name.trim()) { setError("Department name is required."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("departments").insert([{ name: newDept.name.trim(), description: newDept.description.trim() }]);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setNewDept({ name: "", description: "" });
    setShowCreate(false);
    loadDepts();
  };

  const deleteDept = async () => {
    await supabase.from("departments").delete().eq("id", confirmDel.id);
    setConfirmDel(null);
    if (selected?.id === confirmDel.id) setSelected(null);
    loadDepts();
  };

  const assignMember = async (member) => {
    await supabase.from("member_departments").insert([{ member_id: member.id, department_id: selected.id }]);
    refresh(); setMemberSearch("");
  };

  const removeMember = async (member) => {
    await supabase.from("member_departments").delete().eq("member_id", member.id).eq("department_id", selected.id);
    refresh();
  };

  const filteredDepts = departments.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

  // Department detail view
  if (selected) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div onClick={() => setSelected(null)} className="cursor-pointer text-[#4A0E52] flex items-center gap-1 text-sm">
            ← Back
          </div>
          <h1 className="font-display text-2xl text-[#4A0E52] flex-1">{selected.name}</h1>
          {isAdmin && (
            <div onClick={() => setConfirmDel(selected)} className="p-2 cursor-pointer text-red-500">
              <Trash2 className="w-4 h-4" />
            </div>
          )}
        </div>
        {selected.description && <p className="text-sm text-gray-500 mb-4">{selected.description}</p>}

        {/* Members in this department */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] mb-4">
          <div className="px-4 py-3 border-b border-[#F1ECDE] flex items-center justify-between">
            <p className="text-sm font-medium">{deptMembers.length} member{deptMembers.length !== 1 ? "s" : ""}</p>
          </div>
          {deptMembers.length === 0 && <p className="p-4 text-sm text-gray-400">No members in this department yet.</p>}
          {deptMembers.map(m => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-[#F1ECDE] last:border-0">
              <div className="cursor-pointer flex-1" onClick={() => setSelectedProfile(m)}>
                <p className="text-sm font-medium hover:text-[#4A0E52]">{m.full_name}</p>
                <p className="text-xs text-gray-400">{m.membership_status}</p>
              </div>
              <div className="flex items-center gap-1">
                <ContactButton phone={m.phone} />
                <div onClick={() => removeMember(m)} className="p-2 cursor-pointer text-red-400" title="Remove from department">
                  <X className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add members to department */}
        {true && (
          <div className="bg-white rounded-lg border border-[#E9E2CC]">
            <div className="px-4 py-3 border-b border-[#F1ECDE] flex items-center justify-between cursor-pointer"
              onClick={() => setAssigningMember(!assigningMember)}>
              <p className="text-sm font-medium text-[#4A0E52]">+ Add members to this department</p>
              <ChevronDown className={`w-4 h-4 text-[#4A0E52] transition-transform ${assigningMember ? "rotate-180" : ""}`} />
            </div>
            {assigningMember && (
              <div>
                <div className="px-4 py-2 border-b border-[#F1ECDE]">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                    <input placeholder="Search members to add..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                      className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm" />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {memberSearch.length < 2 && <p className="px-4 py-3 text-xs text-gray-400">Type at least 2 characters to search</p>}
                  {memberSearch.length >= 2 && unassignedInDept.slice(0, 20).map(m => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F7F3E9] cursor-pointer" onClick={() => assignMember(m)}>
                      <div>
                        <p className="text-sm">{m.full_name}</p>
                        <p className="text-xs text-gray-400">{m.membership_status} {(m.departments && m.departments.length > 0) ? `· Already in: ${m.departments.join(", ")}` : ""}</p>
                      </div>
                      <Plus className="w-4 h-4 text-[#4A0E52]" />
                    </div>
                  ))}
                  {memberSearch.length >= 2 && unassignedInDept.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No members found.</p>}
                </div>
              </div>
            )}
          </div>
        )}

        {confirmDel && (
          <ConfirmDialog name={confirmDel.name} type="department" onConfirm={deleteDept} onCancel={() => setConfirmDel(null)} />
        )}
        {selectedProfile && (
          <MemberProfileModal member={selectedProfile} onClose={() => setSelectedProfile(null)} isAdmin={isAdmin} onEdit={() => setSelectedProfile(null)} />
        )}
      </div>
    );
  }

  // Department list view
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[#4A0E52]">Departments</h1>
        {isAdmin && (
          <div onClick={() => setShowCreate(true)} className="flex items-center gap-1 bg-[#4A0E52] text-white rounded-md px-3 py-2 text-sm cursor-pointer">
            <Plus className="w-4 h-4" /> New Department
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
        <input placeholder="Search departments..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white" />
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#4A0E52]" /> : (
        <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
          {filteredDepts.map(d => {
            const count = members.filter(m => (m.departments || []).includes(d.name) && !m.archived).length;
            return (
              <div key={d.id} onClick={() => setSelected(d)} className="flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-[#F7F3E9]">
                <div>
                  <p className="text-sm font-medium">{d.name}</p>
                  {d.description && <p className="text-xs text-gray-400">{d.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-[#F7F3E9] text-[#4A0E52] px-2.5 py-1 rounded-full font-medium">{count} members</span>
                  <span className="text-gray-300">›</span>
                </div>
              </div>
            );
          })}
          {filteredDepts.length === 0 && <p className="p-4 text-sm text-gray-400">No departments found.</p>}
        </div>
      )}

      {/* Create Department Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52]">New Department</h2>
              <div onClick={() => setShowCreate(false)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <label className="block text-xs text-gray-500 mb-3">
              Department Name *
              <input value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                placeholder="e.g. Media, Choir, Ushering..."
                className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs text-gray-500 mb-4">
              Description (optional)
              <input value={newDept.description} onChange={e => setNewDept({ ...newDept, description: e.target.value })}
                placeholder="What does this department do?"
                className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm" />
            </label>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div onClick={createDept} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create Department
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STAFF VIEW
   ============================================================ */

/* ============================================================
   FINANCE VIEW — password protected, income/expense, own reports
   ============================================================ */
const FINANCE_COLORS = ["#4A0E52", "#C9A227", "#63177A", "#A6423A", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"];

function FinanceView({ isOwner }) {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PasswordGate featureKey="finance" title="Finance" onUnlock={() => setUnlocked(true)} />;
  }
  return <FinanceDashboard isOwner={isOwner} onLock={() => setUnlocked(false)} />;
}

function FinanceDashboard({ isOwner, onLock }) {
  const [tab, setTab] = useState("overview");
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTx, setShowAddTx] = useState(null); // "income" | "expense" | null
  const [showAddCat, setShowAddCat] = useState(null);
  const [newCatName, setNewCatName] = useState("");
  const [txForm, setTxForm] = useState({ category_id: "", amount: "", description: "", transaction_date: new Date().toISOString().slice(0,10), payment_method: "Cash", member_id: "" });
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(null);
  const [deleteAuthTx, setDeleteAuthTx] = useState(null); // transaction pending owner confirmation
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null);
  const [editTx, setEditTx] = useState(null); // transaction currently open in the edit modal
  const [editAuthTx, setEditAuthTx] = useState(null); // edited values pending owner confirmation
  const [budgetInputs, setBudgetInputs] = useState({}); // category_id -> draft monthly amount string
  const [editingBudget, setEditingBudget] = useState(null); // category_id currently open for edit, or null
  const [showExportAuth, setShowExportAuth] = useState(null); // "pdf" | "excel" | null — pending the download password
  const [range, setRange] = useState(() => ({ ...presetToRange("This month"), label: "This month" }));

  const load = async () => {
    setLoading(true);
    const [{ data: cats }, { data: txs }, { data: buds }, { data: audit }, { data: mems }] = await Promise.all([
      supabase.from("finance_categories").select("*").order("name"),
      supabase.from("finance_transactions").select("*, finance_categories(name), members(full_name)").order("transaction_date", { ascending: false }),
      supabase.from("finance_budgets").select("*"),
      supabase.from("finance_transaction_audit").select("*, profiles(full_name)").order("changed_at", { ascending: false }).limit(200),
      supabase.from("members").select("id, full_name").order("full_name")
    ]);
    setCategories(cats || []);
    setTransactions(txs || []);
    setBudgets(buds || []);
    setAuditLog(audit || []);
    setMembers(mems || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filteredTx = transactions.filter(t => t.transaction_date >= range.start && t.transaction_date <= range.end);
  const totalIncome = filteredTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = filteredTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const incomeCategories = categories.filter(c => c.type === "income");
  const expenseCategories = categories.filter(c => c.type === "expense");

  const fmt = (n) => "₦" + Number(n).toLocaleString();

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await supabase.from("finance_categories").insert([{ type: showAddCat, name: newCatName.trim() }]);
    setNewCatName(""); setShowAddCat(null); load();
  };

  const deleteCategory = async () => {
    await supabase.from("finance_categories").delete().eq("id", confirmDeleteCat.id);
    setConfirmDeleteCat(null); load();
  };

  const saveBudget = async (categoryId) => {
    const raw = budgetInputs[categoryId];
    if (raw === undefined) return;
    const amount = Number(raw) || 0;
    const { data: ud } = await supabase.auth.getUser();
    await supabase.from("finance_budgets").upsert(
      { category_id: categoryId, monthly_amount: amount, updated_by: ud?.user?.id, updated_at: new Date().toISOString() },
      { onConflict: "category_id" }
    );
    load();
  };

  const addTransaction = async () => {
    if (!txForm.category_id || !txForm.amount) return;
    const { data: ud } = await supabase.auth.getUser();
    const { data: inserted } = await supabase.from("finance_transactions").insert([{
      type: showAddTx, category_id: txForm.category_id, amount: Number(txForm.amount),
      description: txForm.description, transaction_date: txForm.transaction_date, payment_method: txForm.payment_method,
      member_id: txForm.member_id || null, created_by: ud?.user?.id
    }]).select().single();
    if (inserted) {
      await supabase.from("finance_transaction_audit").insert([{
        transaction_id: inserted.id, action: "create", new_data: inserted, changed_by: ud?.user?.id
      }]);
    }
    setTxForm({ category_id: "", amount: "", description: "", transaction_date: new Date().toISOString().slice(0,10), payment_method: "Cash", member_id: "" });
    setShowAddTx(null); load();
  };

  // Two-step delete: confirm intent, then require the owner's own login before it actually happens
  const requestDeleteTransaction = () => { setDeleteAuthTx(confirmDeleteTx); setConfirmDeleteTx(null); };
  const deleteTransaction = async () => {
    const { data: ud } = await supabase.auth.getUser();
    await supabase.from("finance_transaction_audit").insert([{
      transaction_id: deleteAuthTx.id, action: "delete", old_data: deleteAuthTx, changed_by: ud?.user?.id
    }]);
    await supabase.from("finance_transactions").delete().eq("id", deleteAuthTx.id);
    setDeleteAuthTx(null); load();
  };

  // Two-step edit: draft changes in the modal, then require the owner's own login before saving
  const openEditTransaction = (t) => setEditTx({
    id: t.id, category_id: t.category_id, amount: String(t.amount), description: t.description || "",
    transaction_date: t.transaction_date, payment_method: t.payment_method || "Cash", type: t.type, member_id: t.member_id || ""
  });
  const requestSaveEdit = () => { setEditAuthTx(editTx); setEditTx(null); };
  const saveEditedTransaction = async () => {
    const original = transactions.find(t => t.id === editAuthTx.id);
    const { data: ud } = await supabase.auth.getUser();
    const newData = {
      category_id: editAuthTx.category_id, amount: Number(editAuthTx.amount),
      description: editAuthTx.description, transaction_date: editAuthTx.transaction_date, payment_method: editAuthTx.payment_method,
      member_id: editAuthTx.member_id || null
    };
    await supabase.from("finance_transactions").update(newData).eq("id", editAuthTx.id);
    await supabase.from("finance_transaction_audit").insert([{
      transaction_id: editAuthTx.id, action: "update", old_data: original, new_data: { ...original, ...newData }, changed_by: ud?.user?.id
    }]);
    setEditAuthTx(null); load();
  };

  // Expense by category for pie/bar chart
  const expenseByCategory = useMemo(() => {
    const map = {};
    filteredTx.filter(t => t.type === "expense").forEach(t => {
      const name = t.finance_categories?.name || "Uncategorized";
      map[name] = (map[name] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredTx]);

  // Income by category, same shape, for its own separate chart
  const incomeByCategory = useMemo(() => {
    const map = {};
    filteredTx.filter(t => t.type === "income").forEach(t => {
      const name = t.finance_categories?.name || "Uncategorized";
      map[name] = (map[name] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredTx]);

  // Monthly total per income category — "how much came in from each income source, each month"
  const monthlyIncomeByCategory = useMemo(() => {
    const months = [...new Set(filteredTx.map(t => t.transaction_date.slice(0, 7)))].sort();
    const cats = [...new Set(filteredTx.filter(t => t.type === "income").map(t => t.finance_categories?.name || "Uncategorized"))].sort();
    const grid = {};
    cats.forEach(c => { grid[c] = {}; months.forEach(m => (grid[c][m] = 0)); });
    filteredTx.filter(t => t.type === "income").forEach(t => {
      const name = t.finance_categories?.name || "Uncategorized";
      const month = t.transaction_date.slice(0, 7);
      grid[name][month] = (grid[name][month] || 0) + Number(t.amount);
    });
    return { months, cats, grid };
  }, [filteredTx]);

  // Income vs Expense over time (by month)
  const monthlyTrend = useMemo(() => {
    const map = {};
    filteredTx.forEach(t => {
      const month = t.transaction_date.slice(0, 7);
      if (!map[month]) map[month] = { month, income: 0, expense: 0 };
      map[month][t.type] += Number(t.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredTx]);

  // Running balances — computed from ALL transactions ever recorded, not just the selected period,
  // so this always reflects what's actually on hand right now.
  const cashBalance = useMemo(() => transactions.reduce((s, t) => {
    if ((t.payment_method || "Cash") !== "Cash") return s;
    return s + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
  }, 0), [transactions]);
  const transferBalance = useMemo(() => transactions.reduce((s, t) => {
    if (t.payment_method !== "Transfer") return s;
    return s + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
  }, 0), [transactions]);

  // Budget vs actual for expense categories, scaled to however many months the selected range spans
  const monthsInRange = useMemo(() => {
    const start = new Date(range.start), end = new Date(range.end);
    return Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
  }, [range]);
  const budgetVsActual = useMemo(() => {
    return expenseCategories.map(c => {
      const budget = budgets.find(b => b.category_id === c.id);
      const monthly = budget ? Number(budget.monthly_amount) : 0;
      const budgeted = monthly * monthsInRange;
      const actual = filteredTx.filter(t => t.type === "expense" && t.category_id === c.id).reduce((s, t) => s + Number(t.amount), 0);
      return { id: c.id, name: c.name, monthly, budgeted, actual, variance: budgeted - actual };
    }).filter(r => r.monthly > 0 || r.actual > 0);
  }, [expenseCategories, budgets, filteredTx, monthsInRange]);

  // Tithe (or any income category matching "tithe") broken down per member for this period
  const titheByMember = useMemo(() => {
    const map = {};
    filteredTx.filter(t => t.type === "income" && t.member_id && (t.finance_categories?.name || "").toLowerCase().includes("tithe")).forEach(t => {
      const key = t.member_id;
      if (!map[key]) map[key] = { member_id: key, name: t.members?.full_name || "Unknown", total: 0, count: 0 };
      map[key].total += Number(t.amount);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredTx]);

  // Year-over-year: same date range, shifted back exactly one year, from the full all-time transaction set
  const lastYearRange = useMemo(() => {
    const shift = (d) => { const dt = new Date(d); dt.setFullYear(dt.getFullYear() - 1); return dt.toISOString().slice(0, 10); };
    return { start: shift(range.start), end: shift(range.end) };
  }, [range]);
  const lastYearTx = useMemo(() => transactions.filter(t => t.transaction_date >= lastYearRange.start && t.transaction_date <= lastYearRange.end), [transactions, lastYearRange]);
  const lastYearIncome = lastYearTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const lastYearExpense = lastYearTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const pctChange = (curr, prev) => prev === 0 ? (curr === 0 ? 0 : 100) : ((curr - prev) / prev * 100);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SCC Finance Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`Period: ${range.label || `${range.start} to ${range.end}`}`, 14, 25);
    doc.text(`Income: ${fmt(totalIncome)}   Expense: ${fmt(totalExpense)}   Net: ${fmt(balance)}`, 14, 31);
    autoTable(doc, {
      startY: 38,
      head: [["Date", "Type", "Category", "Description", "Method", "Amount"]],
      body: filteredTx.map(t => [t.transaction_date, t.type, t.finance_categories?.name || "", t.description || "", t.payment_method || "Cash", fmt(t.amount)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [74, 14, 82] }
    });
    doc.save(`SCC-Finance-${range.start}_to_${range.end}.pdf`);
  };

  const exportExcel = () => {
    const rows = filteredTx.map(t => ({
      Date: t.transaction_date, Type: t.type, Category: t.finance_categories?.name || "",
      Description: t.description || "", Method: t.payment_method || "Cash", Amount: Number(t.amount)
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Transactions");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Period", range.label || `${range.start} to ${range.end}`],
      ["Total Income", totalIncome], ["Total Expense", totalExpense], ["Net Balance", balance],
      ["Cash on Hand (all-time)", cashBalance], ["Bank/Transfer Balance (all-time)", transferBalance]
    ]), "Summary");
    XLSX.writeFile(wb, `SCC-Finance-${range.start}_to_${range.end}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h1 className="font-display text-2xl text-[#4A0E52] flex items-center gap-2"><DollarSign className="w-6 h-6" /> Finance</h1>
        <div className="flex items-center gap-2">
          <DateRangePicker range={range} onChange={setRange} />
          <div onClick={onLock} className="text-xs border border-[#E9E2CC] rounded-md px-3 py-2 cursor-pointer flex items-center gap-1 text-gray-500">
            <Lock className="w-3.5 h-3.5" /> Lock
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-[#E9E2CC] overflow-x-auto">
        {["overview", "transactions", "categories", "budgets", "reports", ...(isOwner ? ["audit log"] : [])].map(t => (
          <div key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm cursor-pointer capitalize font-medium whitespace-nowrap ${tab === t ? "text-[#4A0E52] border-b-2 border-[#4A0E52]" : "text-gray-400"}`}>
            {t}
          </div>
        ))}
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#4A0E52]" /> : (
        <>
          {tab === "overview" && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-[#4A0E52] rounded-lg p-4 text-white flex items-center gap-3">
                  <Wallet className="w-8 h-8 text-[#F3D98B]" />
                  <div>
                    <p className="text-xs text-[#C9A5D6]">Cash on Hand (all-time)</p>
                    <p className="text-xl font-display">{fmt(cashBalance)}</p>
                  </div>
                </div>
                <div className="bg-[#4A0E52] rounded-lg p-4 text-white flex items-center gap-3">
                  <Landmark className="w-8 h-8 text-[#F3D98B]" />
                  <div>
                    <p className="text-xs text-[#C9A5D6]">Bank/Transfer Balance (all-time)</p>
                    <p className="text-xl font-display">{fmt(transferBalance)}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 rounded-lg border border-green-100 p-4">
                  <p className="text-xs text-green-700">Total Income</p>
                  <p className="text-2xl font-display text-green-700">{fmt(totalIncome)}</p>
                </div>
                <div className="bg-red-50 rounded-lg border border-red-100 p-4">
                  <p className="text-xs text-red-700">Total Expense</p>
                  <p className="text-2xl font-display text-red-700">{fmt(totalExpense)}</p>
                </div>
                <div className={`rounded-lg border p-4 ${balance >= 0 ? "bg-[#F7F3E9] border-[#E9E2CC]" : "bg-red-50 border-red-100"}`}>
                  <p className="text-xs text-gray-500">Net Balance</p>
                  <p className={`text-2xl font-display ${balance >= 0 ? "text-[#4A0E52]" : "text-red-700"}`}>{fmt(balance)}</p>
                </div>
              </div>
              <div className="flex gap-3 mb-6">
                <div onClick={() => setShowAddTx("income")} className="flex-1 bg-green-600 text-white rounded-lg py-3 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Income
                </div>
                <div onClick={() => setShowAddTx("expense")} className="flex-1 bg-red-600 text-white rounded-lg py-3 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Add Expense
                </div>
              </div>
              <h3 className="font-display text-base mb-3">Recent Transactions</h3>
              <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
                {filteredTx.slice(0, 8).map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm">{t.finance_categories?.name || "Uncategorized"}</p>
                      <p className="text-xs text-gray-400">{t.description || t.transaction_date}</p>
                    </div>
                    <span className={`text-sm font-medium ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {t.type === "income" ? "+" : "-"}{fmt(t.amount)}
                    </span>
                  </div>
                ))}
                {filteredTx.length === 0 && <p className="p-4 text-sm text-gray-400">No transactions in this period.</p>}
              </div>
            </div>
          )}

          {tab === "transactions" && (
            <div>
              <div className="flex gap-3 mb-4">
                <div onClick={() => setShowAddTx("income")} className="flex items-center gap-1 bg-green-600 text-white rounded-md px-3 py-2 text-sm cursor-pointer"><Plus className="w-4 h-4" /> Income</div>
                <div onClick={() => setShowAddTx("expense")} className="flex items-center gap-1 bg-red-600 text-white rounded-md px-3 py-2 text-sm cursor-pointer"><Plus className="w-4 h-4" /> Expense</div>
              </div>
              <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
                {filteredTx.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm">{t.finance_categories?.name || "Uncategorized"} <span className="text-xs text-gray-400">· {t.transaction_date}</span></p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.description && <p className="text-xs text-gray-400">{t.description}</p>}
                        <span className="text-[10px] uppercase tracking-wide bg-[#F7F3E9] text-[#4A0E52] px-1.5 py-0.5 rounded">{t.payment_method || "Cash"}</span>
                        {t.members?.full_name && <span className="text-[10px] bg-[#F3D98B]/40 text-[#4A0E52] px-1.5 py-0.5 rounded">{t.members.full_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>{t.type === "income" ? "+" : "-"}{fmt(t.amount)}</span>
                      <div onClick={() => openEditTransaction(t)} className="p-1 cursor-pointer text-gray-400 hover:text-[#4A0E52]"><Pencil className="w-4 h-4" /></div>
                      <div onClick={() => setConfirmDeleteTx(t)} className="p-1 cursor-pointer text-red-400"><Trash2 className="w-4 h-4" /></div>
                    </div>
                  </div>
                ))}
                {filteredTx.length === 0 && <p className="p-4 text-sm text-gray-400">No transactions found.</p>}
              </div>
            </div>
          )}

          {tab === "categories" && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base text-green-700">Income Categories</h3>
                  <div onClick={() => setShowAddCat("income")} className="text-xs text-[#4A0E52] cursor-pointer flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</div>
                </div>
                <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
                  {incomeCategories.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm">{c.name}</span>
                      <div onClick={() => setConfirmDeleteCat(c)} className="p-1 cursor-pointer text-red-400"><Trash2 className="w-3.5 h-3.5" /></div>
                    </div>
                  ))}
                  {incomeCategories.length === 0 && <p className="p-3 text-sm text-gray-400">No categories yet.</p>}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base text-red-700">Expense Categories</h3>
                  <div onClick={() => setShowAddCat("expense")} className="text-xs text-[#4A0E52] cursor-pointer flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</div>
                </div>
                <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
                  {expenseCategories.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm">{c.name}</span>
                      <div onClick={() => setConfirmDeleteCat(c)} className="p-1 cursor-pointer text-red-400"><Trash2 className="w-3.5 h-3.5" /></div>
                    </div>
                  ))}
                  {expenseCategories.length === 0 && <p className="p-3 text-sm text-gray-400">No categories yet.</p>}
                </div>
              </div>
            </div>
          )}

          {tab === "budgets" && (
            <div>
              <p className="text-xs text-gray-400 mb-4">Set a recurring monthly budget for each expense category. The Reports tab compares this against what's actually been spent.</p>
              <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
                {expenseCategories.map(c => {
                  const existing = budgets.find(b => b.category_id === c.id);
                  const isEditing = editingBudget === c.id;
                  const value = budgetInputs[c.id] !== undefined ? budgetInputs[c.id] : (existing ? String(existing.monthly_amount) : "");
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-sm">{c.name}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">₦</span>
                          <input
                            type="number"
                            autoFocus
                            value={value}
                            onChange={(e) => setBudgetInputs({ ...budgetInputs, [c.id]: e.target.value })}
                            placeholder="0"
                            className="w-28 border border-[#E9E2CC] rounded-md px-2 py-1.5 text-sm text-right"
                          />
                          <span className="text-xs text-gray-400">/mo</span>
                          <div onClick={() => { saveBudget(c.id); setEditingBudget(null); }} className="text-xs bg-[#4A0E52] text-white rounded-md px-2.5 py-1.5 cursor-pointer">Save</div>
                          <div onClick={() => setEditingBudget(null)} className="text-xs border border-[#E9E2CC] text-gray-500 rounded-md px-2.5 py-1.5 cursor-pointer">Cancel</div>
                        </div>
                      ) : existing ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">{fmt(existing.monthly_amount)}/mo</span>
                          <div onClick={() => { setBudgetInputs({ ...budgetInputs, [c.id]: String(existing.monthly_amount) }); setEditingBudget(c.id); }}
                            className="text-xs border border-[#4A0E52] text-[#4A0E52] rounded-md px-2.5 py-1.5 cursor-pointer flex items-center gap-1">
                            <Pencil className="w-3 h-3" /> Edit
                          </div>
                        </div>
                      ) : (
                        <div onClick={() => { setBudgetInputs({ ...budgetInputs, [c.id]: "" }); setEditingBudget(c.id); }}
                          className="text-xs bg-[#4A0E52] text-white rounded-md px-2.5 py-1.5 cursor-pointer flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add Budget
                        </div>
                      )}
                    </div>
                  );
                })}
                {expenseCategories.length === 0 && <p className="p-3 text-sm text-gray-400">Add expense categories first.</p>}
              </div>
            </div>
          )}

          {tab === "reports" && (
            <div>
              <div className="flex justify-end gap-2 mb-4">
                <div onClick={() => setShowExportAuth("pdf")} className="text-xs border border-[#4A0E52] text-[#4A0E52] rounded-md px-3 py-2 cursor-pointer flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Export PDF</div>
                <div onClick={() => setShowExportAuth("excel")} className="text-xs border border-[#4A0E52] text-[#4A0E52] rounded-md px-3 py-2 cursor-pointer flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel</div>
              </div>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
                  <h3 className="font-display text-base mb-3 flex items-center gap-2 text-green-700"><TrendingUp className="w-4 h-4" /> Income Breakdown</h3>
                  {incomeByCategory.length === 0 ? <p className="text-sm text-gray-400">No income data for this period.</p> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={incomeByCategory}>
                        <CartesianGrid stroke="#F1ECDE" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Bar dataKey="value" fill="#10B981" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
                  <h3 className="font-display text-base mb-3 flex items-center gap-2 text-red-700"><TrendingDown className="w-4 h-4" /> Expense Breakdown</h3>
                  {expenseByCategory.length === 0 ? <p className="text-sm text-gray-400">No expense data for this period.</p> : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={expenseByCategory}>
                        <CartesianGrid stroke="#F1ECDE" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v) => fmt(v)} />
                        <Bar dataKey="value" fill="#A6423A" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
                <h3 className="font-display text-base mb-3 flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-[#4A0E52]" /> Expense Breakdown (share of total)</h3>
                {expenseByCategory.length === 0 ? <p className="text-sm text-gray-400">No expense data for this period.</p> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(entry) => entry.name}>
                        {expenseByCategory.map((entry, i) => <Cell key={i} fill={FINANCE_COLORS[i % FINANCE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
                <h3 className="font-display text-base mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#4A0E52]" /> Income vs Expense Trend</h3>
                {monthlyTrend.length === 0 ? <p className="text-sm text-gray-400">No data yet.</p> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid stroke="#F1ECDE" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="income" fill="#10B981" radius={[4,4,0,0]} />
                      <Bar dataKey="expense" fill="#A6423A" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 overflow-x-auto">
                <h3 className="font-display text-base mb-3 flex items-center gap-2 text-green-700"><DollarSign className="w-4 h-4" /> Monthly Total per Income Source</h3>
                {monthlyIncomeByCategory.months.length === 0 || monthlyIncomeByCategory.cats.length === 0 ? (
                  <p className="text-sm text-gray-400">No income data for this period.</p>
                ) : (
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-[#E9E2CC] text-left text-xs text-gray-400">
                        <th className="py-2 pr-3">Income Source</th>
                        {monthlyIncomeByCategory.months.map(m => <th key={m} className="py-2 px-3 text-right">{m}</th>)}
                        <th className="py-2 pl-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyIncomeByCategory.cats.map(cat => {
                        const rowTotal = monthlyIncomeByCategory.months.reduce((s, m) => s + (monthlyIncomeByCategory.grid[cat][m] || 0), 0);
                        return (
                          <tr key={cat} className="border-b border-[#F1ECDE]">
                            <td className="py-2 pr-3">{cat}</td>
                            {monthlyIncomeByCategory.months.map(m => (
                              <td key={m} className="py-2 px-3 text-right text-gray-600">{fmt(monthlyIncomeByCategory.grid[cat][m] || 0)}</td>
                            ))}
                            <td className="py-2 pl-3 text-right font-medium text-green-700">{fmt(rowTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
                <h3 className="font-display text-base mb-3 flex items-center gap-2 text-green-700"><Users className="w-4 h-4" /> Tithe by Member</h3>
                <p className="text-xs text-gray-400 mb-3">Only income transactions tagged to a member, in a category containing "Tithe."</p>
                {titheByMember.length === 0 ? (
                  <p className="text-sm text-gray-400">No member-tagged tithe for this period. Attribute a member when adding a Tithe income entry to see it here.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E9E2CC] text-left text-xs text-gray-400">
                        <th className="py-2 pr-3">Member</th>
                        <th className="py-2 px-3 text-right">Payments</th>
                        <th className="py-2 pl-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {titheByMember.map(r => (
                        <tr key={r.member_id} className="border-b border-[#F1ECDE]">
                          <td className="py-2 pr-3">{r.name}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{r.count}</td>
                          <td className="py-2 pl-3 text-right font-medium text-green-700">{fmt(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6 mt-6">
                <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
                  <h3 className="font-display text-base mb-3 flex items-center gap-2"><History className="w-4 h-4 text-[#4A0E52]" /> vs Same Period Last Year</h3>
                  <p className="text-xs text-gray-400 mb-3">{lastYearRange.start} to {lastYearRange.end}</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-700">Income</span>
                      <div className="text-right">
                        <p className="text-sm font-medium">{fmt(totalIncome)} <span className="text-gray-400 font-normal">vs {fmt(lastYearIncome)}</span></p>
                        <p className={`text-xs ${totalIncome - lastYearIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pctChange(totalIncome, lastYearIncome) >= 0 ? "+" : ""}{pctChange(totalIncome, lastYearIncome).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-700">Expense</span>
                      <div className="text-right">
                        <p className="text-sm font-medium">{fmt(totalExpense)} <span className="text-gray-400 font-normal">vs {fmt(lastYearExpense)}</span></p>
                        <p className={`text-xs ${totalExpense - lastYearExpense <= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pctChange(totalExpense, lastYearExpense) >= 0 ? "+" : ""}{pctChange(totalExpense, lastYearExpense).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 overflow-x-auto">
                  <h3 className="font-display text-base mb-3 flex items-center gap-2 text-red-700"><DollarSign className="w-4 h-4" /> Budget vs Actual</h3>
                  {budgetVsActual.length === 0 ? (
                    <p className="text-sm text-gray-400">No budgets set yet — add them in the Budgets tab.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E9E2CC] text-left text-xs text-gray-400">
                          <th className="py-2 pr-3">Category</th>
                          <th className="py-2 px-3 text-right">Budgeted</th>
                          <th className="py-2 px-3 text-right">Actual</th>
                          <th className="py-2 pl-3 text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budgetVsActual.map(r => (
                          <tr key={r.id} className="border-b border-[#F1ECDE]">
                            <td className="py-2 pr-3">{r.name}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{fmt(r.budgeted)}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{fmt(r.actual)}</td>
                            <td className={`py-2 pl-3 text-right font-medium ${r.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {r.variance >= 0 ? `${fmt(r.variance)} under` : `${fmt(Math.abs(r.variance))} over`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "audit log" && isOwner && (
            <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
              <p className="text-xs text-gray-400 p-4 pb-2">Every create, edit, and delete on finance transactions — owner-only view, append-only.</p>
              {auditLog.length === 0 && <p className="p-4 text-sm text-gray-400">No changes recorded yet.</p>}
              {auditLog.map(a => (
                <div key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium uppercase tracking-wide ${a.action === "create" ? "text-green-600" : a.action === "delete" ? "text-red-600" : "text-[#4A0E52]"}`}>{a.action}</span>
                    <span className="text-xs text-gray-400">{new Date(a.changed_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    By {a.profiles?.full_name || "Unknown"}
                    {a.action === "update" && a.old_data && a.new_data && (
                      <> · {fmt(a.old_data.amount)} → {fmt(a.new_data.amount)}</>
                    )}
                    {a.action !== "update" && (a.new_data || a.old_data) && (
                      <> · {fmt((a.new_data || a.old_data).amount)}</>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Transaction Modal */}
      {showAddTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52] capitalize">Add {showAddTx}</h2>
              <div onClick={() => setShowAddTx(null)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <label className="block text-xs text-gray-500 mb-3">Category
              <select value={txForm.category_id} onChange={(e) => setTxForm({ ...txForm, category_id: e.target.value })} className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Select category</option>
                {(showAddTx === "income" ? incomeCategories : expenseCategories).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Field label="Amount (₦)" type="number" value={txForm.amount} onChange={(v) => setTxForm({ ...txForm, amount: v })} />
            <Field label="Date" type="date" value={txForm.transaction_date} onChange={(v) => setTxForm({ ...txForm, transaction_date: v })} />
            {showAddTx === "income" && (
              <label className="block text-xs text-gray-500 mb-3">Member (optional — for tithe/giving tracking)
                <div className="mt-1"><MemberPicker members={members} value={txForm.member_id} onChange={(v) => setTxForm({ ...txForm, member_id: v })} /></div>
              </label>
            )}
            <label className="block text-xs text-gray-500 mb-3">Payment Method
              <div className="mt-1 flex gap-2">
                {["Cash", "Transfer"].map(pm => (
                  <div key={pm} onClick={() => setTxForm({ ...txForm, payment_method: pm })}
                    className={`flex-1 text-center text-sm rounded-md py-2 cursor-pointer border ${txForm.payment_method === pm ? "bg-[#4A0E52] text-white border-[#4A0E52]" : "border-[#E9E2CC] text-gray-500"}`}>
                    {pm}
                  </div>
                ))}
              </div>
            </label>
            <Field label="Description (optional)" value={txForm.description} onChange={(v) => setTxForm({ ...txForm, description: v })} />
            <div onClick={addTransaction} className="mt-2 bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer">Save</div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52] capitalize">New {showAddCat} Category</h2>
              <div onClick={() => setShowAddCat(null)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name"
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
              className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm mb-3" />
            <div onClick={addCategory} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer">Add Category</div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52] capitalize">Edit {editTx.type}</h2>
              <div onClick={() => setEditTx(null)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <label className="block text-xs text-gray-500 mb-3">Category
              <select value={editTx.category_id} onChange={(e) => setEditTx({ ...editTx, category_id: e.target.value })} className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
                <option value="">Select category</option>
                {(editTx.type === "income" ? incomeCategories : expenseCategories).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Field label="Amount (₦)" type="number" value={editTx.amount} onChange={(v) => setEditTx({ ...editTx, amount: v })} />
            <Field label="Date" type="date" value={editTx.transaction_date} onChange={(v) => setEditTx({ ...editTx, transaction_date: v })} />
            {editTx.type === "income" && (
              <label className="block text-xs text-gray-500 mb-3">Member (optional — for tithe/giving tracking)
                <div className="mt-1"><MemberPicker members={members} value={editTx.member_id} onChange={(v) => setEditTx({ ...editTx, member_id: v })} /></div>
              </label>
            )}
            <label className="block text-xs text-gray-500 mb-3">Payment Method
              <div className="mt-1 flex gap-2">
                {["Cash", "Transfer"].map(pm => (
                  <div key={pm} onClick={() => setEditTx({ ...editTx, payment_method: pm })}
                    className={`flex-1 text-center text-sm rounded-md py-2 cursor-pointer border ${editTx.payment_method === pm ? "bg-[#4A0E52] text-white border-[#4A0E52]" : "border-[#E9E2CC] text-gray-500"}`}>
                    {pm}
                  </div>
                ))}
              </div>
            </label>
            <Field label="Description (optional)" value={editTx.description} onChange={(v) => setEditTx({ ...editTx, description: v })} />
            <p className="text-xs text-gray-400 mb-2">Saving requires owner confirmation, same as delete.</p>
            <div onClick={requestSaveEdit} className="mt-1 bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer">Save Changes</div>
          </div>
        </div>
      )}
      {editAuthTx && (
        <OwnerReAuthModal
          title="Owner Confirmation Required"
          onSuccess={saveEditedTransaction}
          onClose={() => setEditAuthTx(null)}
        />
      )}

      {confirmDeleteTx && <ConfirmDialog name={confirmDeleteTx.description || confirmDeleteTx.finance_categories?.name || "this transaction"} type="transaction" onConfirm={requestDeleteTransaction} onCancel={() => setConfirmDeleteTx(null)} />}
      {deleteAuthTx && (
        <OwnerReAuthModal
          title="Owner Confirmation Required"
          onSuccess={deleteTransaction}
          onClose={() => setDeleteAuthTx(null)}
        />
      )}
      {confirmDeleteCat && <ConfirmDialog name={confirmDeleteCat.name} type="category" onConfirm={deleteCategory} onCancel={() => setConfirmDeleteCat(null)} />}
      {showExportAuth && (
        <PasswordPromptModal
          featureKey="download"
          title="Confirm Export"
          onSuccess={() => { const kind = showExportAuth; setShowExportAuth(null); kind === "pdf" ? exportPDF() : exportExcel(); }}
          onClose={() => setShowExportAuth(null)}
        />
      )}
    </div>
  );
}

/* ---- Owner Password Settings — set/change per-feature passwords ---- */
/* ---- Backup & Export — full data download, password protected ---- */
function BackupExport() {
  const [showAuth, setShowAuth] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const doBackup = async () => {
    setExporting(true);
    const [{ data: members }, { data: attendance }, { data: departments }] = await Promise.all([
      supabase.from("members").select("*"),
      supabase.from("attendance_records").select("*"),
      supabase.from("departments").select("*")
    ]);
    const backup = {
      church: "Supernatural City Church",
      exported_at: new Date().toISOString(),
      counts: { members: (members || []).length, attendance_records: (attendance || []).length, departments: (departments || []).length },
      members: members || [],
      attendance_records: attendance || [],
      departments: departments || []
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scc-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setExporting(false);
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div className="bg-white rounded-lg border border-[#E9E2CC] mt-6 p-4">
      <p className="text-sm font-medium text-[#4A0E52] flex items-center gap-2 mb-1"><Download className="w-4 h-4" /> Backup & Export</p>
      <p className="text-xs text-gray-400 mb-3">Download a complete backup of all members, attendance records, and departments — useful to keep a safe copy on your computer.</p>
      <div onClick={() => setShowAuth(true)} className="inline-flex items-center gap-2 border border-[#4A0E52] text-[#4A0E52] rounded-md px-3 py-2 text-sm cursor-pointer">
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCheck className="w-4 h-4" /> : <Download className="w-4 h-4" />}
        {done ? "Downloaded!" : "Download Full Backup"}
      </div>
      {showAuth && (
        <PasswordPromptModal
          featureKey="download"
          title="Confirm Backup Download"
          onSuccess={() => { setShowAuth(false); doBackup(); }}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}

function OwnerPasswordSettings() {
  const [open, setOpen] = useState(false);
  const [locks, setLocks] = useState({ finance: false, download: false });
  const [editing, setEditing] = useState(null); // "finance" | "download" | null
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removingKey, setRemovingKey] = useState(null); // which feature is being removed (re-auth step)
  const [loginPassword, setLoginPassword] = useState("");
  const [reAuthError, setReAuthError] = useState("");
  const [reAuthChecking, setReAuthChecking] = useState(false);

  const loadLocks = async () => {
    const [{ data: fin }, { data: dl }] = await Promise.all([
      supabase.rpc("is_feature_locked", { key: "finance" }),
      supabase.rpc("is_feature_locked", { key: "download" })
    ]);
    setLocks({ finance: fin === true, download: dl === true });
  };
  useEffect(() => { loadLocks(); }, []);

  const savePassword = async () => {
    if (!password || password.length < 4) { setError("Password must be at least 4 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.rpc("set_feature_password", { key: editing, new_password: password });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setPassword(""); setConfirm(""); setEditing(null); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    loadLocks();
  };

  // Step 1: owner clicks Remove — open re-auth prompt instead of removing immediately
  const requestRemove = (key) => {
    setRemovingKey(key); setLoginPassword(""); setReAuthError("");
  };

  // Step 2: owner confirms with their actual login password before the removal proceeds
  const OWNER_EMAIL = "supernaturalcitychurch@gmail.com";

  const confirmRemoveWithReAuth = async () => {
    if (!loginPassword) { setReAuthError("Enter the app owner's password to confirm."); return; }
    setReAuthChecking(true); setReAuthError("");
    // Always verify against the app owner's fixed account — never the current session's email
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: OWNER_EMAIL, password: loginPassword });
    setReAuthChecking(false);
    if (authErr) { setReAuthError("Incorrect owner password."); return; }
    await supabase.rpc("remove_feature_password", { key: removingKey });
    setRemovingKey(null); setLoginPassword("");
    loadLocks();
  };

  const features = [
    { key: "finance", label: "Finance Page", desc: "Protects access to the Finance section" },
    { key: "download", label: "Downloads & Print", desc: "Required before any export, download, or print" }
  ];

  return (
    <div className="bg-white rounded-lg border border-[#E9E2CC] mt-6">
      <div className="px-4 py-3 border-b border-[#F1ECDE] flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
        <p className="text-sm font-medium text-[#4A0E52] flex items-center gap-2"><Settings className="w-4 h-4" /> Owner: Manage Passwords</p>
        <ChevronDown className={`w-4 h-4 text-[#4A0E52] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="p-4 space-y-3">
          {features.map(f => (
            <div key={f.key} className="flex items-center justify-between border border-[#E9E2CC] rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-gray-400">{f.desc}</p>
                <p className="text-xs mt-1">
                  {locks[f.key] ? <span className="text-green-600">🔒 Password set</span> : <span className="text-gray-400">🔓 No password set</span>}
                </p>
              </div>
              <div className="flex gap-2">
                <div onClick={() => { setEditing(f.key); setPassword(""); setConfirm(""); setError(""); }}
                  className="text-xs border border-[#4A0E52] text-[#4A0E52] rounded-md px-2.5 py-1.5 cursor-pointer">
                  {locks[f.key] ? "Change" : "Set"}
                </div>
                {locks[f.key] && (
                  <div onClick={() => requestRemove(f.key)} className="text-xs border border-red-300 text-red-500 rounded-md px-2.5 py-1.5 cursor-pointer">
                    Remove
                  </div>
                )}
              </div>
            </div>
          ))}
          {saved && <p className="text-xs text-green-600">✓ Password saved successfully.</p>}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52] capitalize">Set {editing} Password</h2>
              <div onClick={() => setEditing(null)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm mb-3" />
            <input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && savePassword()}
              className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm mb-3" />
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div onClick={savePassword} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Password
            </div>
          </div>
        </div>
      )}

      {removingKey && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52] flex items-center gap-2"><Lock className="w-4 h-4" /> Confirm Removal</h2>
              <div onClick={() => setRemovingKey(null)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              For security, removing the <span className="font-medium capitalize">{removingKey}</span> password requires the <strong>app owner's</strong> login password (supernaturalcitychurch@gmail.com) — not any other account's password.
            </p>
            <input type="password" placeholder="App owner's password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmRemoveWithReAuth()}
              autoFocus
              className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm mb-3" />
            {reAuthError && <p className="text-xs text-red-600 mb-3">{reAuthError}</p>}
            <div onClick={confirmRemoveWithReAuth} className="bg-red-600 text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
              {reAuthChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Confirm & Remove
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StaffView({ isOwner }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "usher" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [confirmStaff, setConfirmStaff] = useState(null);
  const [undoStaff, setUndoStaff] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data: ud } = await supabase.auth.getUser();
    setCurrentUserId(ud?.user?.id || null);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
    setStaff(data || []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const callFn = async (payload) => {
    const { data: sd } = await supabase.auth.getSession();
    const token = sd?.session?.access_token;
    const res = await fetch(`https://jpevyhcxcivlrznaebmk.supabase.co/functions/v1/manage-staff`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
    return res.json();
  };

  const addStaff = async () => {
    if (!form.full_name || !form.email || !form.password) { setError("Please fill in all fields."); return; }
    setSaving(true); setError("");
    const result = await callFn({ action: "create", ...form });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setShowAdd(false); setForm({ full_name: "", email: "", password: "", role: "usher" }); load();
  };

  const requestDeleteStaff = (person) => setConfirmStaff(person);
  const removeStaff = async () => {
    const person = confirmStaff; setConfirmStaff(null);
    const result = await callFn({ action: "delete", id: person.id });
    if (result.error) { alert(result.error); return; }
    setUndoStaff(person); load();
  };
  const handleUndoStaff = async () => {
    if (!undoStaff) return;
    await callFn({ action: "create", email: undoStaff.email, full_name: undoStaff.full_name, password: "TempPass123!", role: undoStaff.role });
    setUndoStaff(null); load();
  };
  const toggleRole = async (person) => {
    const newRole = person.role === "admin" ? "usher" : "admin";
    await callFn({ action: "update_role", id: person.id, role: newRole }); load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[#4A0E52]">SCC Secretariat</h1>
        <div onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-[#4A0E52] text-white rounded-md px-3 py-2 text-sm cursor-pointer"><Plus className="w-4 h-4" /> Add Users</div>
      </div>
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#4A0E52]" /> : (
        <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
          {staff.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
              <div><p className="text-sm font-medium">{s.full_name}</p><p className="text-xs text-gray-400">{s.email}</p></div>
              <div className="flex items-center gap-3">
                <span onClick={() => s.id !== currentUserId && toggleRole(s)} className={`text-xs px-2.5 py-1 rounded-full cursor-pointer ${s.role === "admin" ? "bg-[#4A0E52] text-white" : "bg-[#F1ECDE] text-[#4A0E52]"}`}>
                  {s.role === "admin" ? "Secretariat" : "Admin"}
                </span>
                {s.id === currentUserId ? <span className="text-xs text-gray-400">You</span> :
                  <div onClick={() => requestDeleteStaff(s)} className="p-1 cursor-pointer text-red-500"><Trash2 className="w-4 h-4" /></div>}
              </div>
            </div>
          ))}
          {staff.length === 0 && <p className="p-4 text-sm text-gray-400">No staff yet.</p>}
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg text-[#4A0E52]">Add Users</h2>
              <div onClick={() => setShowAdd(false)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <label className="block text-xs text-gray-500 mb-3">Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
                <option value="usher">Admin</option><option value="admin">Secretariat</option>
              </select>
            </label>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div onClick={addStaff} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Users
            </div>
          </div>
        </div>
      )}
      {confirmStaff && <ConfirmDialog name={confirmStaff.full_name} type="account" onConfirm={removeStaff} onCancel={() => setConfirmStaff(null)} />}
      {undoStaff && <UndoToast message={`"${undoStaff.full_name}" removed.`} onUndo={handleUndoStaff} onDismiss={() => setUndoStaff(null)} />}
      <BackupExport />
      {isOwner && <OwnerPasswordSettings />}
    </div>
  );
}

/* ============================================================
   APP ROOT
   ============================================================ */
export default function App() {
  const { session, profile, loading, signOut, isAdmin, isOwner } = useAuth();
  const [view, setView] = useState("dashboard");
  const [members, setMembers] = useState([]);
  const [globalSelectedMember, setGlobalSelectedMember] = useState(null);
  const [attendanceJump, setAttendanceJump] = useState(null); // { date, service, nonce } — set when jumping in from Reports

  const goToAttendance = (date, service) => {
    setAttendanceJump({ date, service, nonce: Date.now() });
    setView("attendance");
  };

  const refreshMembers = useCallback(async () => {
    const [{ data: mems }, { data: mds }] = await Promise.all([
      supabase.from("members").select("*").order("full_name", { ascending: true }),
      supabase.from("member_departments").select("member_id, departments(name)")
    ]);
    const deptMap = {};
    (mds || []).forEach(md => {
      if (!deptMap[md.member_id]) deptMap[md.member_id] = [];
      if (md.departments?.name) deptMap[md.member_id].push(md.departments.name);
    });
    const enriched = (mems || []).map(m => ({ ...m, departments: deptMap[m.id] || (m.department ? [m.department] : []) }));
    setMembers(enriched);
  }, []);

  useEffect(() => { if (session) refreshMembers(); }, [session, refreshMembers]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F7F3E9]"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div>;
  if (!session) return <LoginScreen />;

  return (
    <Shell view={view} setView={setView} isAdmin={isAdmin} isOwner={isOwner} signOut={signOut} members={members} onSelectMember={setGlobalSelectedMember}>
      {view === "dashboard" && <DashboardView members={members} setView={setView} isAdmin={isAdmin} profile={profile} />}
      {view === "attendance" && <AttendanceView members={members} jump={attendanceJump} />}
      {view === "members" && <MembersView members={members} refresh={refreshMembers} isAdmin={isAdmin} />}
      {view === "reports" && <ReportsView members={members} onGoToAttendance={goToAttendance} />}
      {view === "departments" && <DepartmentsView members={members} refresh={refreshMembers} isAdmin={isAdmin} />}
      {view === "finance" && (!isAdmin || isOwner) && <FinanceView isOwner={isOwner} />}
      {view === "staff" && isAdmin && <StaffView isOwner={isOwner} />}
      {globalSelectedMember && (
        <MemberProfileModal
          member={globalSelectedMember}
          onClose={() => setGlobalSelectedMember(null)}
          isAdmin={isAdmin}
          onEdit={() => {}}
          onRefresh={refreshMembers}
        />
      )}
    </Shell>
  );
}
