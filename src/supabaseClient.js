import { createClient } from "@supabase/supabase-js";

// These come from your Supabase project (already created for you):
// Project ref: jpevyhcxcivlrznaebmk
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://jpevyhcxcivlrznaebmk.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwZXZ5aGN4Y2l2bHJ6bmFlYm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzOTA3MTcsImV4cCI6MjA5OTk2NjcxN30.Lg96UhRZcbH-Bs959lI4lGoOwAGOizPD2XlDT9tMagA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
