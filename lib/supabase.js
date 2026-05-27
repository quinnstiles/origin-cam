import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

// =====================================================
// MAIN DATABASE CLIENT
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
// DATABASE ADMIN CLIENT
// PURE DATABASE OPERATIONS
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
// AUTH VERIFICATION CLIENT
// USED ONLY FOR:
// auth.getUser(token)
// =====================================================
export const supabaseAuth =
    createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        }
    );