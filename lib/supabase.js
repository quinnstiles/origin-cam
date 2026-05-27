import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// =====================================================
// MAIN BACKEND CLIENT
// =====================================================
export const supabase =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            realtime: {
                transport: ws
            }
        }
    );

// =====================================================
// ADMIN DATABASE CLIENT
// SERVICE ROLE ONLY
// =====================================================
export const supabaseAdmin =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            },
            realtime: {
                transport: ws
            }
        }
    );

// =====================================================
// PUBLIC AUTH CLIENT
// ANON KEY ONLY
// USED FOR:
// - signInWithPassword()
// - getUser(token)
// - signOut()
// =====================================================
export const supabaseAuth =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            },
            realtime: {
                transport: ws
            }
        }
    );