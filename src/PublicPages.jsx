import React, { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Copy, Check, LogOut } from "lucide-react";
import { supabaseUrl, supabaseAnonKey } from "./supabaseClient";

/* ---- Public (no-login) pages: /r/<token> registration, /a/<token> attendance QR, /me member portal ----
   Everything goes through the `public-portal` Edge Function. These pages never touch the database directly. */

export function getPublicRoute() {
  const p = window.location.pathname.replace(/\/+$/, "");
  let m = p.match(/^\/r\/([a-f0-9]{32})$/i);
  if (m) return { page: "register", token: m[1].toLowerCase() };
  m = p.match(/^\/a\/([a-f0-9]{32})$/i);
  if (m) return { page: "attend", token: m[1].toLowerCase() };
  if (p === "/me") return { page: "portal" };
  return null;
}

async function api(body) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/public-portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({ error: "Something went wrong. Please try again." }));
    return { ok: res.ok && !data.error, data };
  } catch {
    return { ok: false, data: { error: "No internet connection. Please try again." } };
  }
}

const inputCls = "w-full border border-[#E9E2CC] rounded-md px-3 py-2.5 text-sm bg-white";
const btnCls = "w-full bg-[#4A0E52] hover:bg-[#63177A] text-white rounded-md py-2.5 text-sm text-center flex items-center justify-center gap-2 disabled:opacity-60";

function PublicShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#F7F3E9] flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-md">
        <div className="bg-[#4A0E52] rounded-t-lg px-5 py-4 flex items-center gap-3">
          <img src="/logo.png" alt="SCC" style={{ maxHeight: "44px", maxWidth: "130px", width: "auto", height: "auto" }} />
        </div>
        <div className="bg-white rounded-b-lg border border-[#E9E2CC] border-t-0 p-6">
          {title && <h1 className="font-display text-xl text-[#4A0E52] mb-1">{title}</h1>}
          {subtitle && <p className="text-sm text-gray-500 mb-5">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

function ErrorLine({ children }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 flex items-start gap-1.5 mb-3"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {children}</p>;
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* ignore */ } }}
      className="inline-flex items-center gap-1.5 text-xs border border-[#E9E2CC] rounded-md px-3 py-1.5 bg-white">
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {done ? "Copied" : "Copy code"}
    </button>
  );
}

function useProgram(kind, token) {
  const [state, setState] = useState({ loading: true, program: null, error: "" });
  useEffect(() => {
    (async () => {
      const { ok, data } = await api({ action: "program_info", kind, token });
      setState(ok ? { loading: false, program: data, error: "" } : { loading: false, program: null, error: data.error });
    })();
  }, [kind, token]);
  return state;
}

const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

/* ------------------------- Registration ------------------------- */
function RegisterPage({ token }) {
  const { loading, program, error } = useProgram("reg", token);
  const [answers, setAnswers] = useState({});
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  if (loading) return <PublicShell><div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div></PublicShell>;
  if (error) return <PublicShell title="Link not available"><ErrorLine>{error}</ErrorLine></PublicShell>;
  if (!program.open) return <PublicShell title={program.name} subtitle={fmtDate(program.date)}><ErrorLine>Registration for this program is closed.</ErrorLine></PublicShell>;

  const fields = (program.form_fields || []).filter(f => f.key !== "full_name" && f.key !== "phone");
  const set = (k, v) => setAnswers(a => ({ ...a, [k]: v }));

  const submit = async () => {
    setErr("");
    if (!answers.full_name?.trim()) return setErr("Please enter your full name.");
    if (!answers.phone?.trim()) return setErr("Please enter your phone number.");
    for (const f of fields) if (f.required && !answers[f.key]?.trim()) return setErr(`${f.label} is required.`);
    if (pin && !/^\d{4,6}$/.test(pin)) return setErr("PIN must be 4 to 6 digits, or leave it empty.");
    setBusy(true);
    const { ok, data } = await api({ action: "register", token, answers, pin: pin || undefined });
    setBusy(false);
    if (!ok) return setErr(data.error);
    setResult(data);
  };

  if (result?.status === "exists") {
    return <PublicShell title="Already registered" subtitle={program.name}><p className="text-sm text-gray-600 mb-4">{result.message}</p><a href="/me" className="text-sm text-[#4A0E52] underline">Open my profile</a></PublicShell>;
  }
  if (result?.status === "ok") {
    return (
      <PublicShell title="You are registered" subtitle={program.name}>
        <div className="text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-4">Welcome, {result.name}. This is your personal code. You will use it to mark attendance.</p>
          <div className="bg-[#F7F3E9] rounded-lg py-5 mb-3">
            <p className="text-xs text-gray-400 mb-1">Your code</p>
            <p className="text-3xl font-mono tracking-widest text-[#4A0E52]">{result.code}</p>
          </div>
          <CopyButton text={result.code} />
          <p className="text-xs text-gray-500 mt-4">Please screenshot or write it down. {result.pin_set ? "You can also log in any time with your phone number and PIN to see it again." : "To see it again later, activate your profile with your phone number, this code and a PIN."}</p>
          <a href="/me" className="inline-block mt-3 text-sm text-[#4A0E52] underline">Open my profile</a>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={program.name} subtitle={[fmtDate(program.date), program.description].filter(Boolean).join(" · ")}>
      <div className="space-y-3">
        <label className="block text-xs text-gray-500">Full name *
          <input className={inputCls + " mt-1"} value={answers.full_name || ""} onChange={e => set("full_name", e.target.value)} autoComplete="name" />
        </label>
        <label className="block text-xs text-gray-500">Phone number *
          <input className={inputCls + " mt-1"} type="tel" inputMode="tel" value={answers.phone || ""} onChange={e => set("phone", e.target.value)} autoComplete="tel" />
        </label>
        {fields.map(f => (
          <label key={f.key} className="block text-xs text-gray-500">{f.label}{f.required ? " *" : ""}
            {f.type === "select" ? (
              <select className={inputCls + " mt-1"} value={answers[f.key] || ""} onChange={e => set(f.key, e.target.value)}>
                <option value="">Select…</option>
                {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className={inputCls + " mt-1"} type={f.type === "date" ? "date" : "text"} value={answers[f.key] || ""} onChange={e => set(f.key, e.target.value)} />
            )}
          </label>
        ))}
        <label className="block text-xs text-gray-500">Choose a PIN (optional, 4 to 6 digits)
          <input className={inputCls + " mt-1"} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" />
          <span className="block mt-1 text-[11px] text-gray-400">With a PIN you can log in later to see your code and attendance.</span>
        </label>
        <ErrorLine>{err}</ErrorLine>
        <button type="button" disabled={busy} onClick={submit} className={btnCls}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Register</button>
      </div>
    </PublicShell>
  );
}

/* ------------------------- Attendance ------------------------- */
function AttendPage({ token }) {
  const { loading, program, error } = useProgram("att", token);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  if (loading) return <PublicShell><div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4A0E52]" /></div></PublicShell>;
  if (error) return <PublicShell title="Link not available"><ErrorLine>{error}</ErrorLine></PublicShell>;

  const submit = async () => {
    setErr("");
    if (!code.trim()) return setErr("Please enter your code.");
    setBusy(true);
    const { ok, data } = await api({ action: "mark_attendance", token, code });
    setBusy(false);
    if (!ok) return setErr(data.error);
    setResult(data);
  };

  if (result) {
    return (
      <PublicShell title={program.name} subtitle={fmtDate(program.date)}>
        <div className="text-center py-4">
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-3" />
          <p className="text-lg font-display text-[#4A0E52]">{result.status === "already" ? "Already marked" : "Attendance marked"}</p>
          <p className="text-sm text-gray-600 mt-1">{result.status === "already" ? `${result.name}, you were already marked present.` : `Thank you, ${result.name}. You are marked present.`}</p>
          <button type="button" onClick={() => { setResult(null); setCode(""); }} className="mt-5 text-sm text-[#4A0E52] underline">Mark another person</button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={program.name} subtitle={fmtDate(program.date)}>
      {!program.open ? <ErrorLine>Attendance for this program is closed.</ErrorLine> : (
        <div className="space-y-3">
          <label className="block text-xs text-gray-500">Enter your code
            <input className={inputCls + " mt-1 text-center font-mono text-xl tracking-widest uppercase"} placeholder={program.section === "special" ? "SP-XXXXXX" : "CH-XXXXXX"}
              value={code} onChange={e => setCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && submit()}
              autoCapitalize="characters" autoCorrect="off" autoComplete="off" />
          </label>
          <ErrorLine>{err}</ErrorLine>
          <button type="button" disabled={busy} onClick={submit} className={btnCls}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Mark me present</button>
          <p className="text-xs text-gray-400 text-center">Forgot your code? <a href="/me" className="underline">Open my profile</a></p>
        </div>
      )}
    </PublicShell>
  );
}

/* ------------------------- Member portal ------------------------- */
function MemberPortal() {
  const [mode, setMode] = useState("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [profile, setProfile] = useState(null);

  const login = async (p = phone, n = pin) => {
    setErr(""); setInfo("");
    if (!p.trim() || !n) return setErr("Please enter your phone number and PIN.");
    setBusy(true);
    const { ok, data } = await api({ action: "login", phone: p, pin: n });
    setBusy(false);
    if (!ok) return setErr(data.error);
    setProfile(data);
    setPin("");
  };

  const activate = async () => {
    setErr(""); setInfo("");
    if (!phone.trim() || !code.trim()) return setErr("Please enter your phone number and your code.");
    if (!/^\d{4,6}$/.test(pin)) return setErr("PIN must be 4 to 6 digits.");
    if (pin !== pin2) return setErr("The two PINs do not match.");
    setBusy(true);
    const { ok, data } = await api({ action: "activate", phone, code, pin });
    setBusy(false);
    if (!ok) return setErr(data.error);
    await login(phone, pin);
  };

  if (profile) {
    return (
      <PublicShell title={`Hello, ${profile.name}`} subtitle="Your codes and attendance">
        <div className="space-y-4">
          {profile.codes.map(c => (
            <div key={c.code} className="border border-[#E9E2CC] rounded-lg p-4">
              <p className="text-xs text-gray-400">{c.section === "special" ? "Special Program code" : "Church code"}</p>
              <p className="text-2xl font-mono tracking-widest text-[#4A0E52] my-1">{c.code}</p>
              <CopyButton text={c.code} />
              <p className="text-xs text-gray-500 mt-3">Times present: <b>{c.total}</b></p>
              {c.history.length > 0 && (
                <ul className="mt-2 text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
                  {c.history.map((h, i) => <li key={i} className="flex justify-between gap-3"><span>{h.title}</span><span className="text-gray-400 shrink-0">{h.date}</span></li>)}
                </ul>
              )}
            </div>
          ))}
          <button type="button" onClick={() => { setProfile(null); setPhone(""); }} className="text-sm text-gray-500 flex items-center gap-1.5 mx-auto"><LogOut className="w-4 h-4" /> Log out</button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title="My profile" subtitle="See your code and attendance.">
      <div className="flex mb-4 border border-[#E9E2CC] rounded-md overflow-hidden text-sm">
        {[["login", "Log in"], ["activate", "Activate (first time)"]].map(([id, label]) => (
          <button key={id} type="button" onClick={() => { setMode(id); setErr(""); setInfo(""); }} className={`flex-1 py-2 ${mode === id ? "bg-[#4A0E52] text-white" : "bg-white text-gray-600"}`}>{label}</button>
        ))}
      </div>
      <div className="space-y-3">
        <label className="block text-xs text-gray-500">Phone number
          <input className={inputCls + " mt-1"} type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" />
        </label>
        {mode === "activate" && (
          <label className="block text-xs text-gray-500">Your code (from the Secretariat or your registration)
            <input className={inputCls + " mt-1 font-mono uppercase"} value={code} onChange={e => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" />
          </label>
        )}
        <label className="block text-xs text-gray-500">{mode === "activate" ? "Choose a PIN (4 to 6 digits)" : "PIN"}
          <input className={inputCls + " mt-1"} type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={e => mode === "login" && e.key === "Enter" && login()} autoComplete={mode === "activate" ? "new-password" : "current-password"} />
        </label>
        {mode === "activate" && (
          <label className="block text-xs text-gray-500">Confirm PIN
            <input className={inputCls + " mt-1"} type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={e => setPin2(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" />
          </label>
        )}
        <ErrorLine>{err}</ErrorLine>
        {info && <p className="text-sm text-green-700 mb-3">{info}</p>}
        <button type="button" disabled={busy} onClick={mode === "login" ? () => login() : activate} className={btnCls}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {mode === "login" ? "Log in" : "Activate and log in"}
        </button>
        <p className="text-[11px] text-gray-400 text-center">Forgot your PIN? Ask the Secretariat to reset your code.</p>
      </div>
    </PublicShell>
  );
}

export default function PublicRouter({ route }) {
  if (route.page === "register") return <RegisterPage token={route.token} />;
  if (route.page === "attend") return <AttendPage token={route.token} />;
  return <MemberPortal />;
}
