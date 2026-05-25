import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from "ws";


// =====================================================
// MAIN BACKEND CLIENT
// =====================================================
export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        realtime: {
            transport: ws
        }
    }
);


// =====================================================
// ISOLATED AUTH CLIENT
// Used for registration/login auth flows
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