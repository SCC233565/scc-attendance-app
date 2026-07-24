import { Link, useNavigate } from 'react-router-dom';
import {
  Moon,
  Download,
  Bell,
  Info,
  Mail,
  Facebook,
  Instagram,
  Youtube,
  FileText,
  ShieldCheck,
  LogOut,
  Gift,
  Heart,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

export default function Profile() {
  const { darkMode, toggleDarkMode } = useApp();
  const { session, signOut, authReady } = useData();
  const navigate = useNavigate();

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-muted">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-4 px-6 pb-40 pt-6 text-center">
        <p className="font-heading text-lg font-bold text-ink">You're not signed in</p>
        <p className="text-sm text-ink-muted">
          Sign in to save favorites, playlists, downloads, and your listening history.
        </p>
        <Link
          to="/auth"
          className="rounded-full bg-purple px-6 py-3 font-button font-semibold text-white"
        >
          Sign In
        </Link>
      </div>
    );
  }

  const displayName = (session.user.user_metadata as any)?.full_name || session.user.email || 'Listener';
  const initial = displayName.charAt(0).toUpperCase();

  const items = [
    { icon: Moon, label: 'Dark Mode', toggle: true },
    { icon: Download, label: 'Downloads', to: '/library' },
    { icon: Bell, label: 'Notifications', to: '/notifications' },
    { icon: Heart, label: 'Submit a Prayer Request', to: '/prayer-request' },
    { icon: Gift, label: 'Give / Donate', to: '/give' },
    { icon: Info, label: 'About Supernatural City Church', to: '/about' },
    { icon: Mail, label: 'Contact Us', to: '/contact' },
    { icon: FileText, label: 'Privacy Policy', to: '/privacy' },
    { icon: ShieldCheck, label: 'Terms & Conditions', to: '/terms' },
  ];

  return (
    <div className="animate-fade-in px-4 pb-40 pt-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple font-heading text-xl font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-lg font-bold text-ink">{displayName}</p>
          <p className="truncate text-sm text-ink-muted">{session.user.email}</p>
        </div>
      </div>

      <div className="flex flex-col divide-y divide-black/5 overflow-hidden rounded-card bg-white shadow-soft">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (item.toggle) toggleDarkMode();
              else if (item.to) navigate(item.to);
            }}
            className="flex items-center justify-between px-4 py-3.5 text-left"
          >
            <span className="flex items-center gap-3 text-sm font-medium text-ink">
              <item.icon size={18} className="text-purple" />
              {item.label}
            </span>
            {item.toggle && (
              <span
                className={`h-6 w-11 rounded-full transition-colors ${
                  darkMode ? 'bg-purple' : 'bg-black/10'
                } relative`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 flex justify-center gap-5 text-purple">
        <Facebook size={20} />
        <Instagram size={20} />
        <Youtube size={20} />
      </div>

      <button
        onClick={async () => {
          await signOut();
          navigate('/home');
        }}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-black/5 py-3 font-button font-semibold text-ink-muted"
      >
        <LogOut size={16} /> Logout
      </button>
      <p className="mt-4 text-center text-xs text-ink-muted">App Version 0.1.0</p>
    </div>
  );
}
