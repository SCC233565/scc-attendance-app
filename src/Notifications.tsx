import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import {
  Category,
  Message,
  Pastor,
  categoryFromTags,
  pickCover,
} from '../data/mockData';

const SERMONS_BUCKET = 'sermons';
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

export interface SiteSettings {
  address: string;
  phone: string;
  website: string;
  socials: { platform: string; handle: string; url?: string }[];
}

export interface PrayerRequestRow {
  id: string;
  name: string | null;
  contact: string | null;
  request: string;
  createdAt: string;
}

export interface NewMessageInput {
  title: string;
  pastorId: string | null;
  pastorName: string;
  seriesTags: string[];
  series?: string;
  description?: string;
  messageDate: string;
  audioFile: File | null;
  thumbnailFile?: File | null;
}

export interface UpdateMessageInput {
  id: string;
  title: string;
  pastorId: string | null;
  pastorName: string;
  seriesTags: string[];
  series?: string;
  description?: string;
  messageDate: string;
  audioFile?: File | null;
  thumbnailFile?: File | null;
  removeThumbnail?: boolean;
}

export interface UploadStatus {
  stage: 'uploading' | 'success' | 'error';
  message: string;
}

interface DataState {
  loading: boolean;
  messages: Message[];
  pastors: Pastor[];
  siteSettings: SiteSettings | null;

  session: Session | null;
  isAdmin: boolean;
  authReady: boolean;

  // Listener-facing auth (any signed-in user, no admin role required)
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName?: string) => Promise<string | null>;
  signOut: () => Promise<void>;

  refetch: () => Promise<void>;

  addMessage: (input: NewMessageInput) => Promise<string | null>;
  updateMessage: (input: UpdateMessageInput) => Promise<string | null>;
  deleteMessage: (id: string) => Promise<string | null>;

  upsertPastor: (
    p: { id?: string; slug: string; name: string; bio: string; photoUrl?: string; sortOrder?: number }
  ) => Promise<string | null>;
  deletePastor: (id: string) => Promise<string | null>;

  saveSiteSettings: (s: SiteSettings) => Promise<string | null>;

  submitPrayerRequest: (name: string, contact: string, request: string) => Promise<string | null>;
  fetchPrayerRequests: () => Promise<PrayerRequestRow[]>;
  deletePrayerRequest: (id: string) => Promise<string | null>;

  getSignedAudioUrl: (path: string, download?: boolean) => Promise<string | null>;

  // Global upload status — survives navigating away from the admin form
  // that started the upload, since this state lives at the app root.
  uploadStatus: UploadStatus | null;
  clearUploadStatus: () => void;
}

const DataContext = createContext<DataState | null>(null);

function mapPastor(row: any): Pastor {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    bio: row.bio ?? '',
    photoUrl: row.photo_url ?? '',
    sortOrder: row.sort_order ?? 0,
  };
}

function mapMessage(row: any): Message {
  const tags: string[] = row.series_tags ?? [];
  return {
    id: row.id,
    title: row.title,
    pastorName: row.pastor ?? '',
    pastorId: row.pastor_id ?? null,
    series: row.series ?? undefined,
    seriesTags: tags,
    category: categoryFromTags(tags),
    date: row.message_date,
    durationSeconds: 0,
    description: row.description ?? '',
    coverColor: pickCover(row.id),
    audioPath: row.audio_path ?? null,
    audioUrl: row.audio_url ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    thumbnailPath: row.thumbnail_path ?? null,
  };
}

function mapSiteSettings(row: any): SiteSettings {
  return {
    address: row.address ?? '',
    phone: row.phone ?? '',
    website: row.website ?? '',
    socials: Array.isArray(row.socials) ? row.socials : [],
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pastors, setPastors] = useState<Pastor[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);

  const clearUploadStatus = useCallback(() => setUploadStatus(null), []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      if (!session?.user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    }
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [msgRes, pastorRes, settingsRes] = await Promise.all([
      supabase.from('messages').select('*').order('message_date', { ascending: false }),
      supabase.from('pastors').select('*').order('sort_order', { ascending: true }),
      supabase.from('site_settings').select('*').limit(1).maybeSingle(),
    ]);
    if (msgRes.data) setMessages(msgRes.data.map(mapMessage));
    if (pastorRes.data) setPastors(pastorRes.data.map(mapPastor));
    if (settingsRes.data) setSiteSettings(mapSiteSettings(settingsRes.data));
    else if (!settingsRes.error) setSiteSettings({ address: '', phone: '', website: '', socials: [] });
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signUp(email: string, password: string, fullName?: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    return error?.message ?? null;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function uploadToBucket(
    bucket: string,
    file: File,
    prefix = ''
  ): Promise<{ path: string; url: string } | { error: string }> {
    const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${prefix}${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) return { error: error.message };
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed) return { error: signErr?.message ?? 'Could not sign URL' };
    return { path, url: signed.signedUrl };
  }

  async function addMessage(input: NewMessageInput) {
    if (!input.audioFile) return 'An audio file is required.';
    setUploadStatus({ stage: 'uploading', message: `Uploading "${input.title}"…` });
    const uploaded = await uploadToBucket(SERMONS_BUCKET, input.audioFile);
    if ('error' in uploaded) {
      setUploadStatus({ stage: 'error', message: `Upload failed: ${uploaded.error}` });
      return uploaded.error;
    }
    let thumb: { path: string; url: string } | null = null;
    if (input.thumbnailFile) {
      const t = await uploadToBucket(SERMONS_BUCKET, input.thumbnailFile, 'thumb-');
      if ('error' in t) {
        setUploadStatus({ stage: 'error', message: `Upload failed: ${t.error}` });
        return t.error;
      }
      thumb = t;
    }
    const { error } = await supabase.from('messages').insert({
      title: input.title,
      pastor: input.pastorName,
      pastor_id: input.pastorId,
      series: input.series || null,
      series_tags: input.seriesTags,
      description: input.description || null,
      message_date: input.messageDate,
      audio_path: uploaded.path,
      audio_url: uploaded.url,
      thumbnail_path: thumb?.path ?? null,
      thumbnail_url: thumb?.url ?? null,
    });
    if (error) {
      setUploadStatus({ stage: 'error', message: `Upload failed: ${error.message}` });
      return error.message;
    }
    setUploadStatus({ stage: 'success', message: `"${input.title}" uploaded successfully.` });
    await refetch();
    return null;
  }

  async function updateMessage(input: UpdateMessageInput) {
    const patch: Record<string, any> = {
      title: input.title,
      pastor: input.pastorName,
      pastor_id: input.pastorId,
      series: input.series || null,
      series_tags: input.seriesTags,
      description: input.description || null,
      message_date: input.messageDate,
    };
    const hasFileWork = !!input.audioFile || !!input.thumbnailFile;
    if (hasFileWork) {
      setUploadStatus({ stage: 'uploading', message: `Updating "${input.title}"…` });
    }
    if (input.audioFile) {
      const uploaded = await uploadToBucket(SERMONS_BUCKET, input.audioFile);
      if ('error' in uploaded) {
        setUploadStatus({ stage: 'error', message: `Update failed: ${uploaded.error}` });
        return uploaded.error;
      }
      patch.audio_path = uploaded.path;
      patch.audio_url = uploaded.url;
    }
    if (input.thumbnailFile) {
      const t = await uploadToBucket(SERMONS_BUCKET, input.thumbnailFile, 'thumb-');
      if ('error' in t) {
        setUploadStatus({ stage: 'error', message: `Update failed: ${t.error}` });
        return t.error;
      }
      patch.thumbnail_path = t.path;
      patch.thumbnail_url = t.url;
    } else if (input.removeThumbnail) {
      patch.thumbnail_path = null;
      patch.thumbnail_url = null;
    }
    const { error } = await supabase.from('messages').update(patch as any).eq('id', input.id);
    if (error) {
      if (hasFileWork) setUploadStatus({ stage: 'error', message: `Update failed: ${error.message}` });
      return error.message;
    }
    if (hasFileWork) {
      setUploadStatus({ stage: 'success', message: `"${input.title}" updated successfully.` });
    }
    await refetch();
    return null;
  }

  async function deleteMessage(id: string) {
    const msg = messages.find((m) => m.id === id);
    const pathsToRemove = [msg?.audioPath, msg?.thumbnailPath].filter(Boolean) as string[];
    if (pathsToRemove.length > 0) {
      await supabase.storage.from(SERMONS_BUCKET).remove(pathsToRemove);
    }
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) return error.message;
    await refetch();
    return null;
  }

  async function upsertPastor(p: {
    id?: string;
    slug: string;
    name: string;
    bio: string;
    photoUrl?: string;
    sortOrder?: number;
  }) {
    const payload: any = {
      slug: p.slug,
      name: p.name,
      bio: p.bio,
      photo_url: p.photoUrl || null,
      sort_order: p.sortOrder ?? 0,
    };
    const { error } = p.id
      ? await supabase.from('pastors').update(payload).eq('id', p.id)
      : await supabase.from('pastors').insert(payload);
    if (error) return error.message;
    await refetch();
    return null;
  }

  async function deletePastor(id: string) {
    const { error } = await supabase.from('pastors').delete().eq('id', id);
    if (error) return error.message;
    await refetch();
    return null;
  }

  async function saveSiteSettings(s: SiteSettings) {
    const { data: existing } = await supabase.from('site_settings').select('id').limit(1).maybeSingle();
    if (existing?.id) {
      const { error } = await supabase
        .from('site_settings')
        .update({
          address: s.address,
          phone: s.phone,
          website: s.website,
          socials: s.socials as any,
        })
        .eq('id', existing.id);
      if (error) return error.message;
    } else {
      const { error } = await supabase.from('site_settings').insert({
        address: s.address,
        phone: s.phone,
        website: s.website,
        socials: s.socials as any,
      });
      if (error) return error.message;
    }
    await refetch();
    return null;
  }

  async function submitPrayerRequest(name: string, contact: string, request: string) {
    const { error } = await supabase.from('prayer_requests' as any).insert({
      name: name || null,
      contact: contact || null,
      request,
    });
    return error?.message ?? null;
  }

  async function fetchPrayerRequests(): Promise<PrayerRequestRow[]> {
    const { data, error } = await supabase
      .from('prayer_requests' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      contact: r.contact,
      request: r.request,
      createdAt: r.created_at,
    }));
  }

  async function deletePrayerRequest(id: string) {
    const { error } = await supabase.from('prayer_requests' as any).delete().eq('id', id);
    return error?.message ?? null;
  }

  async function getSignedAudioUrl(path: string, download = false) {
    const { data, error } = await supabase.storage
      .from(SERMONS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL, download ? { download: true } : undefined);
    if (error || !data) return null;
    return data.signedUrl;
  }

  const value = useMemo<DataState>(
    () => ({
      loading,
      messages,
      pastors,
      siteSettings,
      session,
      isAdmin,
      authReady,
      signIn,
      signUp,
      signOut,
      refetch,
      addMessage,
      updateMessage,
      deleteMessage,
      upsertPastor,
      deletePastor,
      saveSiteSettings,
      submitPrayerRequest,
      fetchPrayerRequests,
      deletePrayerRequest,
      getSignedAudioUrl,
      uploadStatus,
      clearUploadStatus,
    }),
    [loading, messages, pastors, siteSettings, session, isAdmin, authReady, refetch, uploadStatus, clearUploadStatus]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

// Re-export Category for convenience
export type { Category };
