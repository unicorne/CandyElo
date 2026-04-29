import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SECRET_KEY!;

export const supabaseAdmin = () =>
  createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
