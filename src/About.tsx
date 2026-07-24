import { useEffect, useState } from 'react';

interface NotifPrefs {
  newSermons: boolean;
  liveBroadcasts: boolean;
  prayerReminders: boolean;
}

const STORAGE_KEY = 'scc-notification-prefs';

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed storage
  }
  return { newSermons: true, liveBroadcasts: true, prayerReminders: false };
}

export default function Notifications() {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadPrefs);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const items: { key: keyof NotifPrefs; label: string; hint: string }[] = [
    { key: 'newSermons', label: 'New sermons', hint: 'Get notified when a new message is uploaded' },
    { key: 'liveBroadcasts', label: 'Live broadcasts', hint: 'Get notified when a service goes live' },
    { key: 'prayerReminders', label: 'Prayer meeting reminders', hint: 'Reminders before scheduled prayer meetings' },
  ];

  return (
    <div className="animate-fade-in px-4 pb-40 pt-6">
      <h1 className="mb-1 font-heading text-xl font-bold text-ink">Notifications</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Choose what you'd like to be notified about. (Push delivery requires a notifications
        backend to be connected — these preferences are saved on this device for now.)
      </p>
      <div className="flex flex-col divide-y divide-black/5 overflow-hidden rounded-card bg-white shadow-soft">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between px-4 py-3.5">
            <div className="pr-3">
              <p className="text-sm font-semibold text-ink">{item.label}</p>
              <p className="text-xs text-ink-muted">{item.hint}</p>
            </div>
            <button
              onClick={() => setPrefs((p) => ({ ...p, [item.key]: !p[item.key] }))}
              className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
                prefs[item.key] ? 'bg-purple' : 'bg-black/10'
              } relative`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  prefs[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
