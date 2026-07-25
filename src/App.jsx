import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, CalendarCheck, BarChart3, Search, Plus, X, Trash2, Pencil,
  Save, Loader2, TrendingDown, LogOut, Upload, Download, UserCog,
  Home, BookOpen, Archive, WhatsApp, Phone, Mail, MapPin, Briefcase,
  Heart, Star, AlertTriangle, CheckCheck, ChevronDown, Printer, RefreshCw
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
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
function Shell({ view, setView, isAdmin, signOut, children }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "members", label: "Members", icon: Users },
    { id: "reports", label: "Reports", icon: BarChart3 },
    ...(isAdmin ? [{ id: "staff", label: "Staff", icon: UserCog }] : [])
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
          <p className="mb-2 text-[#C9A5D6]">{isAdmin ? "Admin" : "Staff"}</p>
          <div onClick={signOut} className="flex items-center gap-2 cursor-pointer hover:text-[#F3D98B]"><LogOut className="w-3.5 h-3.5" /> Sign out</div>
        </div>
      </aside>
      <div className="flex-1 pb-16 md:pb-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#4A0E52] text-white sticky top-0 z-10">
          <Logo className="h-7" />
          <div onClick={signOut} className="text-xs flex items-center gap-1"><LogOut className="w-3.5 h-3.5" /> Sign out</div>
        </div>
        <main className="p-4 md:p-8 max-w-5xl mx-auto">{children}</main>
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
   DASHBOARD VIEW
   ============================================================ */
function DashboardView({ members, setView, isAdmin }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <h1 className="font-display text-2xl mb-1">Welcome, Pastor</h1>
        <p className="text-[#C9A5D6] text-sm">{dateDisplay}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Members", value: members.length, color: "text-[#4A0E52]" },
          { label: "Active", value: activeMembers, color: "text-green-600" },
          { label: "New Converts", value: newConverts, color: "text-[#C9A227]" },
          { label: "Visitors", value: visitors, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-[#E9E2CC] p-4">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-2xl font-display ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div onClick={() => setView("attendance")} className="bg-[#4A0E52] text-white rounded-lg p-4 cursor-pointer flex items-center gap-3 hover:bg-[#63177A]">
          <CalendarCheck className="w-5 h-5 text-[#F3D98B]" />
          <span className="text-sm font-medium">Take Attendance</span>
        </div>
        {isAdmin && (
          <div onClick={() => setView("members")} className="bg-white border border-[#E9E2CC] rounded-lg p-4 cursor-pointer flex items-center gap-3 hover:bg-[#F7F3E9]">
            <Plus className="w-5 h-5 text-[#4A0E52]" />
            <span className="text-sm font-medium text-[#4A0E52]">Add Member</span>
          </div>
        )}
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
            <ul className="space-y-2">
              {needsFollowUp.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.full_name}</span>
                  {m.phone && (
                    <a href={`https://wa.me/234${m.phone.replace(/^0/, "")}`} target="_blank" rel="noopener noreferrer"
                      className="text-green-600 text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3" /> WhatsApp
                    </a>
                  )}
                </li>
              ))}
            </ul>
          }
        </div>

        {/* Repeat Visitors */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-5">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-[#C9A227]" /> Repeat Visitors
          </h2>
          {repeatVisitors.length === 0 ? <p className="text-sm text-gray-400">No repeat visitors yet.</p> :
            <ul className="space-y-2">
              {repeatVisitors.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.full_name}</span>
                  <span className="text-xs text-[#C9A227] bg-[#FEF9EC] px-2 py-0.5 rounded-full">
                    {records.filter(r => r.member_id === m.id).length} visits
                  </span>
                </li>
              ))}
            </ul>
          }
        </div>

        {/* Birthdays This Month */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-5">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" /> Birthdays This Month
          </h2>
          {birthdayMembers.length === 0 ?
            <p className="text-sm text-gray-400">No birthdays recorded this month. Add dates of birth in member profiles.</p> :
            <ul className="space-y-2">
              {birthdayMembers.map(m => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.full_name}</span>
                  <span className="text-xs text-gray-400">{new Date(m.date_of_birth).toLocaleDateString("en-US", {month:"short", day:"numeric"})}</span>
                </li>
              ))}
            </ul>
          }
        </div>

        {/* Department Summary */}
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-5">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#4A0E52]" /> Departments
          </h2>
          <div className="space-y-2">
            {Object.entries(
              members.filter(m => m.department && m.department !== "" && m.department !== "None")
                .reduce((acc, m) => ({ ...acc, [m.department]: (acc[m.department] || 0) + 1 }), {})
            ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between text-sm">
                <span>{dept}</span>
                <span className="text-xs bg-[#F7F3E9] text-[#4A0E52] px-2 py-0.5 rounded-full font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MEMBER PROFILE MODAL
   ============================================================ */
function MemberProfileModal({ member, onClose, isAdmin, onEdit }) {
  const [records, setRecords] = useState([]);
  const [allSessions, setAllSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: memberRecs }, { data: allRecs }] = await Promise.all([
        supabase.from("attendance_records").select("*").eq("member_id", member.id).order("service_date", { ascending: false }),
        supabase.from("attendance_records").select("service_date,service_type")
      ]);
      setRecords(memberRecs || []);
      const sessions = new Set((allRecs || []).map(r => `${r.service_date}_${r.service_type}`)).size;
      setAllSessions(sessions);
      setLoading(false);
    })();
  }, [member.id]);

  const rate = allSessions > 0 ? Math.round((records.length / allSessions) * 100) : 0;
  const byService = SERVICES.map(s => ({ name: s.label, count: records.filter(r => r.service_type === s.id).length }));
  const waPhone = member.phone ? `https://wa.me/234${member.phone.replace(/^0/, "")}` : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-[#4A0E52] text-white p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="font-display text-xl">{member.full_name}</h2>
              <p className="text-[#C9A5D6] text-sm">{member.department || "No department"}</p>
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
            {waPhone && (
              <a href={waPhone} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2.5 py-1 rounded-full bg-green-600 text-white flex items-center gap-1">
                <Phone className="w-3 h-3" /> WhatsApp
              </a>
            )}
            {isAdmin && (
              <div onClick={() => { onClose(); onEdit(member); }}
                className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white cursor-pointer flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E9E2CC]">
          {["info", "attendance"].map(t => (
            <div key={t} onClick={() => setTab(t)}
              className={`flex-1 text-center py-3 text-sm cursor-pointer capitalize font-medium ${tab === t ? "text-[#4A0E52] border-b-2 border-[#4A0E52]" : "text-gray-400"}`}>
              {t === "info" ? "Personal Info" : "Attendance"}
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
                    <div className="space-y-1">
                      {records.slice(0, 10).map(r => (
                        <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-[#F1ECDE]">
                          <span className="text-xs text-gray-500">{new Date(r.service_date).toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric"})}</span>
                          <span className="text-xs bg-[#F7F3E9] text-[#4A0E52] px-2 py-0.5 rounded-full">{r.service_type}</span>
                        </div>
                      ))}
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
function AttendanceView({ members }) {
  const [service, setService] = useState(SERVICES[0].id);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [present, setPresent] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("attendance_records").select("member_id").eq("service_type", service).eq("service_date", date);
      const map = {};
      (data || []).forEach((r) => (map[r.member_id] = true));
      setPresent(map);
    })();
  }, [service, date]);

  const toggle = (id) => setPresent((p) => ({ ...p, [id]: !p[id] }));
  const selectAll = () => { const map = {}; filtered.forEach(m => map[m.id] = true); setPresent(p => ({ ...p, ...map })); };
  const clearAll = () => { const map = {}; filtered.forEach(m => map[m.id] = false); setPresent(p => ({ ...p, ...map })); };

  const save = async () => {
    setSaving(true);
    const rows = Object.entries(present).filter(([, v]) => v).map(([member_id]) => ({ member_id, service_type: service, service_date: date, present: true }));
    if (rows.length) await supabase.from("attendance_records").upsert(rows, { onConflict: "member_id,service_type,service_date" });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

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
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={service} onChange={(e) => setService(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white" />
        </div>
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
              {m.department && <p className="text-xs text-gray-400">{m.department}</p>}
            </div>
            <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${present[m.id] ? "bg-[#C9A227] border-[#C9A227] text-white" : "border-[#D9D2BC] text-transparent"}`}>✓</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-gray-400">No members found.</p>}
      </div>

      <div className="mt-4 flex gap-3 flex-wrap">
        <div onClick={save} className="inline-flex items-center gap-2 bg-[#4A0E52] hover:bg-[#63177A] text-white rounded-md px-5 py-2.5 text-sm cursor-pointer">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCheck className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Attendance"}
        </div>
        <div onClick={handlePrint} className="inline-flex items-center gap-2 border border-[#4A0E52] text-[#4A0E52] rounded-md px-5 py-2.5 text-sm cursor-pointer">
          <Printer className="w-4 h-4" /> Print Register
        </div>
      </div>
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

  const departments = ["All", ...Array.from(new Set(members.filter(m => m.department).map(m => m.department))).sort()];

  const filtered = members.filter((m) => {
    if (showArchived ? !m.archived : m.archived) return false;
    if (deptFilter !== "All" && m.department !== deptFilter) return false;
    if (statusFilter !== "All" && m.membership_status !== statusFilter) return false;
    return m.full_name.toLowerCase().includes(search.toLowerCase());
  });

  const save = async () => {
    if (!editing.full_name) return;
    if (editing.id) {
      await supabase.from("members").update(editing).eq("id", editing.id);
    } else {
      await supabase.from("members").insert([editing]);
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
        {isAdmin && (
          <div className="flex gap-2">
            <div onClick={() => setShowImport(true)} className="flex items-center gap-1 border border-[#4A0E52] text-[#4A0E52] rounded-md px-3 py-2 text-sm cursor-pointer">
              <Upload className="w-4 h-4" /> Import
            </div>
            <div onClick={() => setEditing({ ...emptyMember })} className="flex items-center gap-1 bg-[#4A0E52] text-white rounded-md px-3 py-2 text-sm cursor-pointer">
              <Plus className="w-4 h-4" /> Add
            </div>
          </div>
        )}
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
              <p className="text-xs text-gray-400">{m.membership_status} {m.department ? `· ${m.department}` : ""}</p>
            </div>
            <div className="flex items-center gap-1">
              {m.phone && (
                <a href={`https://wa.me/234${m.phone.replace(/^0/, "")}`} target="_blank" rel="noopener noreferrer"
                  className="p-2 text-green-600" onClick={e => e.stopPropagation()}>
                  <Phone className="w-4 h-4" />
                </a>
              )}
              {isAdmin && (
                <>
                  <div onClick={() => setEditing(m)} className="p-2 cursor-pointer text-[#4A0E52]"><Pencil className="w-4 h-4" /></div>
                  <div onClick={() => requestDelete(m)} className="p-2 cursor-pointer text-red-500"><Archive className="w-4 h-4" /></div>
                </>
              )}
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
        <div onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-[#4A0E52] cursor-pointer mb-4"><Download className="w-4 h-4" /> Download CSV template</div>
        <input type="file" accept=".csv" onChange={handleFile} className="text-sm mb-3" />
        {rows.length > 0 && <p className="text-xs text-gray-500 mb-3">{rows.length} rows detected.</p>}
        <div onClick={doImport} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Import {rows.length || ""} Members
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   REPORTS VIEW — enhanced with visitor tracker
   ============================================================ */
function ReportsView({ members }) {
  const [records, setRecords] = useState([]);
  const [range, setRange] = useState(() => ({ ...presetToRange("This month"), label: "This month" }));

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("attendance_records").select("*").order("service_date", { ascending: true });
      setRecords(data || []);
    })();
  }, []);

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
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-4"><p className="text-xs text-gray-400">Services Logged</p><p className="text-2xl font-display text-[#4A0E52]">{totalSessions}</p></div>
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
                  {m.phone && <a href={`https://wa.me/234${m.phone.replace(/^0/,"")}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 flex items-center gap-1"><Phone className="w-3 h-3" /> WhatsApp</a>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STAFF VIEW
   ============================================================ */
function StaffView() {
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
        <h1 className="font-display text-2xl text-[#4A0E52]">Staff</h1>
        <div onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-[#4A0E52] text-white rounded-md px-3 py-2 text-sm cursor-pointer"><Plus className="w-4 h-4" /> Add Staff</div>
      </div>
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-[#4A0E52]" /> : (
        <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
          {staff.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
              <div><p className="text-sm font-medium">{s.full_name}</p><p className="text-xs text-gray-400">{s.email}</p></div>
              <div className="flex items-center gap-3">
                <span onClick={() => s.id !== currentUserId && toggleRole(s)} className={`text-xs px-2.5 py-1 rounded-full cursor-pointer ${s.role === "admin" ? "bg-[#4A0E52] text-white" : "bg-[#F1ECDE] text-[#4A0E52]"}`}>
                  {s.role === "admin" ? "Admin" : "Staff"}
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
              <h2 className="font-display text-lg text-[#4A0E52]">Add Staff</h2>
              <div onClick={() => setShowAdd(false)} className="cursor-pointer"><X className="w-5 h-5" /></div>
            </div>
            <Field label="Full name" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <label className="block text-xs text-gray-500 mb-3">Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
                <option value="usher">Staff</option><option value="admin">Admin</option>
              </select>
            </label>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <div onClick={addStaff} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add Staff
            </div>
          </div>
        </div>
      )}
      {confirmStaff && <ConfirmDialog name={confirmStaff.full_name} type="staff" onConfirm={removeStaff} onCancel={() => setConfirmStaff(null)} />}
      {undoStaff && <UndoToast message={`"${undoStaff.full_name}" removed.`} onUndo={handleUndoStaff} onDismiss={() => setUndoStaff(null)} />}
    </div>
  );
}

/* ============================================================
   APP ROOT
   ============================================================ */
export default function App() {
  const { session, loading, signOut, isAdmin } = useAuth();
  const [view, setView] = useState("dashboard");
  const [members, setMembers] = useState([]);

  const refreshMembers = useCallback(async () => {
    const { data } = await supabase.from("members").select("*").eq("archived", false).order("full_name", { ascending: true });
    setMembers(data || []);
  }, []);

  useEffect(() => { if (session) refreshMembers(); }, [session, refreshMembers]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F7F3E9]"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div>;
  if (!session) return <LoginScreen />;

  return (
    <Shell view={view} setView={setView} isAdmin={isAdmin} signOut={signOut}>
      {view === "dashboard" && <DashboardView members={members} setView={setView} isAdmin={isAdmin} />}
      {view === "attendance" && <AttendanceView members={members} />}
      {view === "members" && <MembersView members={members} refresh={refreshMembers} isAdmin={isAdmin} />}
      {view === "reports" && <ReportsView members={members} />}
      {view === "staff" && isAdmin && <StaffView />}
    </Shell>
  );
}
