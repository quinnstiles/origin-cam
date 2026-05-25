import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from "ws";


// =====================================================
// ADMIN CLIENT
// Used ONLY by backend secure routes
// Bypasses RLS safely through service_role
// =====================================================
export const supabaseAdmin = createClient(
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
// PUBLIC CLIENT
// Optional: use for public/authenticated operations
// Subject to RLS
// =====================================================
export const supabasePublic = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
        realtime: {
            transport: ws
        }
    }
);