// ========================================
// FILE:
// lib/supabase.js
// ========================================

import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';

import {
    createClient
} from '@supabase/supabase-js';

// ========================================
// SUPABASE ADMIN CLIENT
// ========================================

const supabase = createClient(

    process.env.SUPABASE_URL,

    process.env.SUPABASE_SERVICE_ROLE_KEY,

    {
        realtime: {
            transport: ws
        }
    }
);

// ========================================
// EXPORT
// ========================================

export default supabase;