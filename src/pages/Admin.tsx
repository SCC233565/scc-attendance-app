import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { messages as initialMessages, speakers, dailyDevotional, Category } from '../data/mockData';
import { useApp } from '../context/AppContext';
import { supabase } from '../integrations/supabase/client';

const CATEGORIES: Category[] = ['Sermon', 'Bible Study', 'Prayer Meeting', 'Worship', 'Podcast'];

type Tab = 'messages' | 'speakers' | 'devotional' | 'prayer-requests' | 'footer' | 'give-link';

export default function Admin() {
  const [tab, setTab] = useState<Tab>('messages');
  const [messages, setMessages] = useState(initialMessages);
  const { prayerRequests } = useApp();

  // New message form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('Sermon');
  const [series, setSeries] = useState('');
  const [scripture, setScripture] = useState('');
  const [description, setDescription] = useState('');

  function addMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setMessages((m) => [
      {
        id: `msg-${Date.now()}`,
        title: title.trim(),
        speakerId: speakers[0].id,
        series: series.trim() || undefined,
        category,
        date: new Date().toISOString().slice(0, 10),
        durationSeconds: 1800,
        description: description.trim() || 'No description provided.',
        scripture: scripture.trim() || undefined,
        coverColor: '#4A148C',
      },
      ...m,
    ]);
    setTitle('');
    setSeries('');
    setScripture('');
    setDescription('');
  }

  function deleteMessage(id: string) {
    setMessages((m) => m.filter((msg) => msg.id !== id));
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'messages', label: 'Messages' },
    { key: 'speakers', label: 'Speakers' },
    { key: 'devotional', label: 'Devotional' },
    { key: 'prayer-requests', label: 'Prayer Requests' },
    { key: 'footer', label: 'Footer / Contact' },
    { key: 'give-link', label: 'Give Link' },
  ];

  return (
    <div className="min-h-screen bg-surface-soft px-4 pb-16 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-ink">Admin Dashboard</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted shadow-soft"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-button font-semibold ${
              tab === t.key ? 'bg-purple text-white' : 'bg-white text-ink shadow-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'messages' && (
        <div className="flex flex-col gap-5">
          <form onSubmit={addMessage} className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft">
            <p className="font-heading text-sm font-semibold text-ink">Upload New Message</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
            />
            <div className="text-xs text-ink-muted">
              Audio file upload requires a storage backend (e.g. Supabase Storage) — wire this
              input up once connected.
            </div>
            <input type="file" accept="audio/*" disabled className="text-xs text-ink-muted" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              placeholder="Series (optional)"
              className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
            />
            <input
              value={scripture}
              onChange={(e) => setScripture(e.target.value)}
              placeholder="Bible reference (optional)"
              className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="rounded-2xl border border-black/10 p-3 text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-purple py-2.5 font-button font-semibold text-white"
            >
              Add Message
            </button>
          </form>

          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-card bg-white p-3 shadow-soft"
              >
                <div>
                  <p className="font-heading text-sm font-semibold text-ink">{m.title}</p>
                  <p className="text-xs text-ink-muted">
                    {m.category} {m.series ? `· ${m.series}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => deleteMessage(m.id)}
                  className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'speakers' && (
        <div className="flex flex-col gap-3">
          {speakers.map((s) => (
            <div key={s.id} className="rounded-card bg-white p-4 shadow-soft">
              <p className="font-heading text-sm font-semibold text-ink">{s.name}</p>
              <p className="mt-1 text-xs text-ink-muted">{s.bio}</p>
              <button className="mt-3 rounded-full bg-black/5 px-4 py-1.5 text-xs font-semibold text-ink">
                Edit Profile
              </button>
            </div>
          ))}
          <button className="rounded-full bg-purple py-2.5 font-button font-semibold text-white">
            + Add Another Speaker
          </button>
        </div>
      )}

      {tab === 'devotional' && (
        <div className="rounded-card bg-white p-4 shadow-soft">
          <p className="mb-2 font-heading text-sm font-semibold text-ink">Today's Devotional</p>
          <input
            defaultValue={dailyDevotional.title}
            className="mb-2 w-full rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
          />
          <textarea
            defaultValue={dailyDevotional.body}
            className="h-32 w-full rounded-2xl border border-black/10 p-3 text-sm outline-none"
          />
          <button className="mt-3 rounded-full bg-purple px-5 py-2 font-button font-semibold text-white">
            Save Devotional
          </button>
        </div>
      )}

      {tab === 'prayer-requests' && (
        <div className="flex flex-col gap-3">
          {prayerRequests.length === 0 && (
            <p className="text-sm text-ink-muted">No prayer requests submitted yet.</p>
          )}
          {prayerRequests.map((r) => (
            <div key={r.id} className="rounded-card bg-white p-4 shadow-soft">
              <p className="text-sm font-semibold text-ink">{r.name || 'Anonymous'}</p>
              {r.contact && <p className="text-xs text-ink-muted">{r.contact}</p>}
              <p className="mt-2 text-sm text-ink">{r.request}</p>
              <p className="mt-2 text-[10px] text-ink-muted">
                {new Date(r.submittedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === 'footer' && (
        <div className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft">
          <input
            defaultValue="123 Church Street, Your City"
            className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
          />
          <input
            defaultValue="(555) 123-4567"
            className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
          />
          <input
            defaultValue="supernaturalcitychurch.example"
            className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
          />
          <input
            defaultValue="@supernaturalcitychurch"
            placeholder="TikTok / Facebook / Instagram / YouTube handle"
            className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
          />
          <button className="rounded-full bg-purple py-2.5 font-button font-semibold text-white">
            Save Footer Info
          </button>
        </div>
      )}

      {tab === 'give-link' && (
        <div className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft">
          <p className="text-sm text-ink-muted">
            Paste your payment provider link (Stripe, Paystack, Flutterwave, etc.). This is used on
            the Give / Donate page.
          </p>
          <input
            defaultValue="https://example.com/give-placeholder"
            className="rounded-full border border-black/10 px-4 py-2 text-sm outline-none"
          />
          <button className="rounded-full bg-purple py-2.5 font-button font-semibold text-white">
            Save Give Link
          </button>
        </div>
      )}
    </div>
  );
}
