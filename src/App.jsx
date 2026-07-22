import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users, CalendarCheck, BarChart3, Search, Plus, X, Trash2, Pencil,
  Save, Loader2, TrendingDown, LogOut, Upload, Download, UserCog, ArrowLeft
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";
import Papa from "papaparse";
import { supabase } from "./supabaseClient";
import { useAuth } from "./useAuth";


const SERVICES = [
  { id: "Sunday Service", label: "Sunday Service" },
  { id: "Wednesday Service", label: "Wednesday Service" },
  { id: "7HWG", label: "7HWG (Monthly)" }
];

const STATUS_OPTIONS = ["Active", "New Convert", "Visitor", "Inactive"];

/* ---------------------------- Login Screen ---------------------------- */
function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-[#F7F3E9] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-lg border border-[#E9E2CC] p-8">
        <div className="bg-[#F7F3E9] rounded-md px-3 py-2 inline-block mb-4">
          <img src="/logo.png" alt="Supernatural City Church" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="font-display text-xl mb-1 text-[#4A0E52]">SCC Attendance Register</h1>
        <p className="text-sm text-[#9CA3AF] mb-6">Sign in with the login your admin gave you.</p>
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm"
          />
          {error && <p className="text-xs text-[#A6423A]">{error}</p>}
          <div
            onClick={handleLogin}
            className="w-full bg-[#4A0E52] hover:bg-[#63177A] text-white rounded-md py-2 text-sm text-center cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Sign In
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Nav Shell ------------------------------ */
function Shell({ view, setView, isAdmin, signOut, children }) {
  const items = [
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    { id: "members", label: "Members", icon: Users },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "staff", label: "Staff", icon: UserCog }
  ];
  return (
    <div className="min-h-screen bg-[#F7F3E9] flex">
      <aside className="hidden md:flex w-64 shrink-0 h-screen sticky top-0 bg-[#4A0E52] text-[#EDE6D0] flex-col">
        <div className="px-6 pt-7 pb-5 border-b border-white/10">
          <div className="bg-[#F7F3E9] rounded-md px-3 py-2 inline-block mb-2">
            <img src="/logo.png" alt="Supernatural City Church" className="h-9 w-auto object-contain" />
          </div>
          <p className="text-xs text-[#C9A5D6] font-body tracking-wide">Attendance Register</p>
        </div>
        <nav className="flex-1 py-4">
          {items.map((it) => {
            const Icon = it.icon;
            const active = view === it.id;
            return (
              <div
                key={it.id}
                onClick={() => setView(it.id)}
                className={`flex items-center gap-3 px-6 py-3 cursor-pointer text-sm ${
                  active ? "bg-white/10 text-[#F3D98B]" : "text-[#EDE6D0] hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" /> {it.label}
              </div>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-xs">
          <p className="mb-2 text-[#C9A5D6]">{isAdmin ? "Admin" : "Usher"}</p>
          <div onClick={signOut} className="flex items-center gap-2 cursor-pointer hover:text-[#F3D98B]">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </div>
        </div>
      </aside>

      <div className="flex-1 pb-16 md:pb-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#4A0E52] text-white sticky top-0 z-10">
          <div className="bg-[#F7F3E9] rounded-md px-2 py-1">
            <img src="/logo.png" alt="SCC" className="h-6 w-auto object-contain" />
          </div>
          <div onClick={signOut} className="text-xs flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </div>
        </div>
        <main className="p-4 md:p-8 max-w-5xl mx-auto">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#4A0E52] flex z-10">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.id;
          return (
            <div
              key={it.id}
              onClick={() => setView(it.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] ${
                active ? "text-[#F3D98B]" : "text-[#C7CBD6]"
              }`}
            >
              <Icon className="w-5 h-5" />
              {it.label}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/* ---------------------------- Attendance View --------------------------- */
function AttendanceView({ members }) {
  const [service, setService] = useState(SERVICES[0].id);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [present, setPresent] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("member_id")
        .eq("service_type", service)
        .eq("service_date", date);
      const map = {};
      (data || []).forEach((r) => (map[r.member_id] = true));
      setPresent(map);
    })();
  }, [service, date]);

  const toggle = (id) => setPresent((p) => ({ ...p, [id]: !p[id] }));

  const save = async () => {
    setSaving(true);
    const rows = Object.entries(present)
      .filter(([, v]) => v)
      .map(([member_id]) => ({ member_id, service_type: service, service_date: date, present: true }));
    if (rows.length) {
      await supabase.from("attendance_records").upsert(rows, { onConflict: "member_id,service_type,service_date" });
    }
    setSaving(false);
  };

  const filtered = members.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-4">Take Attendance</h1>
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={service} onChange={(e) => setService(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          {SERVICES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white" />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#9CA3AF]" />
          <input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white"
          />
        </div>
      </div>
      <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
        {filtered.map((m) => (
          <div key={m.id} onClick={() => toggle(m.id)} className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F7F3E9]">
            <span className="text-sm">{m.full_name}</span>
            <span
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                present[m.id] ? "bg-[#C9A227] border-[#C9A227] text-white" : "border-[#D9D2BC] text-transparent"
              }`}
            >
              ✓
            </span>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-[#9CA3AF]">No members found.</p>}
      </div>
      <div
        onClick={save}
        className="mt-4 inline-flex items-center gap-2 bg-[#4A0E52] hover:bg-[#63177A] text-white rounded-md px-5 py-2.5 text-sm cursor-pointer"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Attendance
      </div>
    </div>
  );
}

/* ------------------------------ Field helper ------------------------------ */
function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block text-xs text-[#6B7280] mb-3">
      {label}
      {type === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white">
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full border border-[#E9E2CC] rounded-md px-3 py-2 text-sm"
        />
      )}
    </label>
  );
}

const emptyMember = {
  full_name: "", phone: "", email: "", address: "", date_of_birth: "",
  gender: "", marital_status: "", occupation: "", department: "",
  date_joined: "", membership_status: "Active"
};

/* ------------------------------ Members View ------------------------------ */
function MembersView({ members, refresh, isAdmin, onSelectMember }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // member object or "new" draft
  const [showImport, setShowImport] = useState(false);

  const filtered = members.filter((m) => m.full_name.toLowerCase().includes(search.toLowerCase()));

  const save = async () => {
    if (!editing.full_name) return;
    if (editing.id) {
      await supabase.from("members").update(editing).eq("id", editing.id);
    } else {
      await supabase.from("members").insert([editing]);
    }
    setEditing(null);
    refresh();
  };

  const remove = async (id) => {
    await supabase.from("members").delete().eq("id", id);
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-[#4A0E52]">Members</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <div onClick={() => setShowImport(true)} className="flex items-center gap-1 border border-[#4A0E52] text-[#4A0E52] rounded-md px-3 py-2 text-sm cursor-pointer">
              <Upload className="w-4 h-4" /> Bulk Import
            </div>
            <div onClick={() => setEditing({ ...emptyMember })} className="flex items-center gap-1 bg-[#4A0E52] text-white rounded-md px-3 py-2 text-sm cursor-pointer">
              <Plus className="w-4 h-4" /> Add Member
            </div>
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#9CA3AF]" />
        <input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 border border-[#E9E2CC] rounded-md px-3 py-2 text-sm bg-white"
        />
      </div>

      <div className="bg-white rounded-lg border border-[#E9E2CC] divide-y divide-[#F1ECDE]">
        {filtered.map((m) => (
          <div
            key={m.id}
            onClick={() => onSelectMember(m.id)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F7F3E9]"
          >
            <div>
              <p className="text-sm font-medium">{m.full_name}</p>
              <p className="text-xs text-[#9CA3AF]">{m.membership_status} · {m.phone || "no phone"}</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <div onClick={(e) => { e.stopPropagation(); setEditing(m); }} className="p-2 cursor-pointer text-[#4A0E52]"><Pencil className="w-4 h-4" /></div>
                <div onClick={(e) => { e.stopPropagation(); remove(m.id); }} className="p-2 cursor-pointer text-[#A6423A]"><Trash2 className="w-4 h-4" /></div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="p-4 text-sm text-[#9CA3AF]">No members found.</p>}
      </div>

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
            <div onClick={save} className="mt-2 bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer">Save Member</div>
          </div>
        </div>
      )}

      {showImport && (
        <BulkImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); refresh(); }} />
      )}
    </div>
  );
}

/* --------------------------- Bulk Import Modal --------------------------- */
function BulkImportModal({ onClose, onDone }) {
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data)
    });
  };

  const doImport = async () => {
    setImporting(true);
    const mapped = rows
      .map((r) => ({
        full_name: r["Full Name"] || r["full_name"] || r["Name"] || "",
        phone: r["Phone"] || r["Phone Number"] || r["phone"] || "",
        email: r["Email"] || r["email"] || "",
        membership_status: r["Membership Status"] || r["membership_status"] || "Active"
      }))
      .filter((r) => r.full_name);
    if (mapped.length) await supabase.from("members").insert(mapped);
    setImporting(false);
    onDone();
  };

  const downloadTemplate = () => {
    const csv = "Full Name,Phone,Email,Membership Status\nJane Doe,08012345678,jane@example.com,Active\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scc_members_template.csv";
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg text-[#4A0E52]">Bulk Import Members</h2>
          <div onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></div>
        </div>
        <div onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-[#4A0E52] cursor-pointer mb-4">
          <Download className="w-4 h-4" /> Download CSV template
        </div>
        <input type="file" accept=".csv" onChange={handleFile} className="text-sm mb-3" />
        {rows.length > 0 && <p className="text-xs text-[#6B7280] mb-3">{rows.length} rows detected.</p>}
        <div onClick={doImport} className="bg-[#4A0E52] text-white rounded-md py-2.5 text-center text-sm cursor-pointer flex items-center justify-center gap-2">
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Import {rows.length || ""} Members
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Reports View ------------------------------ */
function ReportsView({ members }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("attendance_records").select("*").order("service_date", { ascending: true });
      setRecords(data || []);
    })();
  }, []);

  const bySession = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      const key = `${r.service_date} ${r.service_type}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).slice(-12).map(([key, count]) => ({ name: key, count }));
  }, [records]);

  const byServiceType = useMemo(() => {
    const map = {};
    SERVICES.forEach((s) => (map[s.id] = { total: 0, sessions: new Set() }));
    records.forEach((r) => {
      if (!map[r.service_type]) map[r.service_type] = { total: 0, sessions: new Set() };
      map[r.service_type].total += 1;
      map[r.service_type].sessions.add(r.service_date);
    });
    return Object.entries(map).map(([type, v]) => ({
      name: type,
      avg: v.sessions.size ? Math.round(v.total / v.sessions.size) : 0
    }));
  }, [records]);

  const memberRates = useMemo(() => {
    const sessions = new Set(records.map((r) => `${r.service_date}_${r.service_type}`)).size || 1;
    return members.map((m) => {
      const attended = records.filter((r) => r.member_id === m.id).length;
      return { ...m, rate: Math.round((attended / sessions) * 100) };
    });
  }, [records, members]);

  const atRisk = memberRates.filter((m) => m.rate < 50).sort((a, b) => a.rate - b.rate);
  const faithful = [...memberRates].sort((a, b) => b.rate - a.rate).slice(0, 5);
  const totalSessions = new Set(records.map((r) => `${r.service_date}_${r.service_type}`)).size;

  return (
    <div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-4">Reports</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-4">
          <p className="text-xs text-[#9CA3AF]">Total Members</p>
          <p className="text-2xl font-display text-[#4A0E52]">{members.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-4">
          <p className="text-xs text-[#9CA3AF]">Services Logged</p>
          <p className="text-2xl font-display text-[#4A0E52]">{totalSessions}</p>
        </div>
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-4">
          <p className="text-xs text-[#9CA3AF]">Avg Attendance</p>
          <p className="text-2xl font-display text-[#4A0E52]">
            {totalSessions ? Math.round(records.length / totalSessions) : 0}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
        <h2 className="font-display text-base mb-3">Attendance Trend (last 12 sessions)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={bySession}>
            <CartesianGrid stroke="#F1ECDE" />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} hide />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#C9A227" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
        <h2 className="font-display text-base mb-3">Average Attendance by Service</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byServiceType}>
            <CartesianGrid stroke="#F1ECDE" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="avg" fill="#4A0E52" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
          <h2 className="font-display text-base mb-3">Most Faithful</h2>
          <ul className="space-y-2">
            {faithful.map((m) => (
              <li key={m.id} className="flex justify-between text-sm">
                <span>{m.full_name}</span>
                <span className="text-[#C9A227] font-medium">{m.rate}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
          <h2 className="font-display text-base mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#A6423A]" /> Needs a follow-up
          </h2>
          {atRisk.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No one below 50% attendance.</p>
          ) : (
            <ul className="space-y-2">
              {atRisk.map((m) => (
                <li key={m.id} className="flex justify-between text-sm">
                  <span>{m.full_name}</span>
                  <span className="text-[#A6423A] font-medium">{m.rate}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- App --------------------------------- */
/* ------------------------------ Staff View ------------------------------ */
function cleanStaffName(name) {
  // Display-only clean up: drop a leading "Pastor " title from the name.
  return (name || "").replace(/^pastor\s+/i, "").trim();
}

function StaffView() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name", { ascending: true });
      setStaff(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h2 className="font-display text-2xl text-[#4A0E52] mb-4">Staff</h2>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#4A0E52]" />
      ) : (
        <div className="space-y-3">
          {staff.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-lg border border-[#E9E2CC] px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{cleanStaffName(s.full_name)}</p>
                <p className="text-xs text-[#9CA3AF]">{s.email}</p>
              </div>
              {s.role && (
                <span className="text-xs px-2 py-1 rounded-full bg-[#F7F3E9] text-[#4A0E52] capitalize">
                  {s.role}
                </span>
              )}
            </div>
          ))}
          {staff.length === 0 && (
            <p className="text-sm text-[#9CA3AF]">No staff members found.</p>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Member Report View --------------------------- */
function MemberReportView({ memberId, members, onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const member = members.find((m) => m.id === memberId);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("member_id", memberId)
        .order("service_date", { ascending: true });
      setRecords(data || []);
      setLoading(false);
    })();
  }, [memberId]);

  const byService = useMemo(() => {
    const map = {};
    SERVICES.forEach((s) => (map[s.id] = 0));
    records.forEach((r) => { map[r.service_type] = (map[r.service_type] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [records]);

  if (!member) {
    return <p className="text-sm text-[#9CA3AF]">Member not found.</p>;
  }

  return (
    <div>
      <div onClick={onBack} className="flex items-center gap-2 text-sm text-[#4A0E52] cursor-pointer mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Members
      </div>
      <h1 className="font-display text-2xl text-[#4A0E52] mb-1">{member.full_name}</h1>
      <p className="text-sm text-[#9CA3AF] mb-6">
        {member.membership_status} · {member.phone || "no phone"} · {member.email || "no email"}
      </p>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-[#4A0E52]" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-[#E9E2CC] p-4">
              <p className="text-xs text-[#9CA3AF]">Total Services Attended</p>
              <p className="text-2xl font-display text-[#4A0E52]">{records.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-[#E9E2CC] p-4">
              <p className="text-xs text-[#9CA3AF]">Member Since</p>
              <p className="text-2xl font-display text-[#4A0E52]">{member.date_joined || "—"}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E9E2CC] p-6 mb-6">
            <h2 className="font-display text-base mb-3">Attendance by Service Type</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byService}>
                <CartesianGrid stroke="#F1ECDE" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#4A0E52" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg border border-[#E9E2CC] p-6">
            <h2 className="font-display text-base mb-3">Attendance History</h2>
            {records.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No attendance recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[#F1ECDE]">
                {[...records].reverse().map((r) => (
                  <li key={r.id} className="py-2 flex justify-between text-sm">
                    <span>{r.service_type}</span>
                    <span className="text-[#9CA3AF]">{r.service_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  const { session, profile, loading, signOut, isAdmin } = useAuth();
  const [view, setView] = useState("attendance");
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const refreshMembers = useCallback(async () => {
    const { data } = await supabase.from("members").select("*").order("full_name", { ascending: true });
    setMembers(data || []);
  }, []);

  useEffect(() => {
    if (session) refreshMembers();
  }, [session, refreshMembers]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F3E9]">
        <Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <Shell view={view} setView={setView} isAdmin={isAdmin} signOut={signOut}>
      {view === "attendance" && <AttendanceView members={members} />}
      {view === "members" && (
        <MembersView
          members={members}
          refresh={refreshMembers}
          isAdmin={isAdmin}
          onSelectMember={(id) => { setSelectedMemberId(id); setView("member-report"); }}
        />
      )}
      {view === "member-report" && (
        <MemberReportView
          memberId={selectedMemberId}
          members={members}
          onBack={() => setView("members")}
        />
      )}
      {view === "reports" && <ReportsView members={members} />}
      {view === "staff" && <StaffView />}
    </Shell>
  );
}
