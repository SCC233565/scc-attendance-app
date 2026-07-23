import { useState } from 'react';
import { supabase } from '../integrations/supabase/client';

export default function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    onSignedIn();
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface-soft px-6">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-soft">
        <h1 className="mb-1 font-heading text-xl font-bold text-ink">Admin Sign In</h1>
        <p className="mb-5 text-sm text-ink-muted">
          Sign in with the admin account created in Supabase.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Admin email"
            className="rounded-full border border-black/10 px-4 py-2.5 text-sm outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-full border border-black/10 px-4 py-2.5 text-sm outline-none"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-full bg-purple py-2.5 font-button font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
