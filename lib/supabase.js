import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing env: ${name}`);
    }
    return value;
}

const supabaseUrl =
    requireEnv('SUPABASE_URL');

const supabaseKey =
    requireEnv('SUPABASE_SERVICE_ROLE_KEY');

// ========================================
// FIX: NODE 20 realtime websocket issue
// ========================================

export const supabase =
    createClient(
        supabaseUrl,
        supabaseKey,
        {
            realtime: {
                transport: ws
            }
        }
    );

export default supabase;