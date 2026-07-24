import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

export default function Auth() {
  const { signIn, signUp } = useData();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedUp, setSignedUp] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err =
      mode === 'signin' ? await signIn(email.trim(), password) : await signUp(email.trim(), password, fullName.trim());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    if (mode === 'signup') {
      setSignedUp(true);
    } else {
      navigate('/profile');
    }
  }

  return (
    <div className="animate-fade-in flex h-screen flex-col justify-center px-6">
      <h1 className="mb-1 font-heading text-2xl font-bold text-ink">Welcome to SCC Streams</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {mode === 'signin'
          ? 'Sign in to save your favorites, playlists, downloads, and history.'
          : 'Create an account to save your favorites, playlists, downloads, and history.'}
      </p>

      {signedUp ? (
        <div className="rounded-card bg-white p-4 text-sm text-ink shadow-soft">
          Account created. If email confirmation is required, check your inbox, then sign in.
          <button
            onClick={() => {
              setSignedUp(false);
              setMode('signin');
            }}
            className="mt-3 block font-semibold text-purple"
          >
            Go to Sign In
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="rounded-full bg-white px-4 py-3 text-sm shadow-soft outline-none"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email address"
            className="rounded-full bg-white px-4 py-3 text-sm shadow-soft outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="rounded-full bg-white px-4 py-3 text-sm shadow-soft outline-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 rounded-full bg-purple py-3 font-button font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-center text-xs text-ink-muted"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </form>
      )}
    </div>
  );
}
