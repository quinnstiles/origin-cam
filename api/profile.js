import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';

import {
    createClient
} from '@supabase/supabase-js';

// ========================================
// SUPABASE
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
// JSON RESPONSE HELPER
// ========================================

function sendJson(res, status, data) {

    if (res.headersSent) {
        return;
    }

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(JSON.stringify(data));
}

// ========================================
// PROFILE
// ========================================

export default async function handler(req, res) {

    // ====================================
    // METHOD CHECK
    // ====================================

    if (req.method !== 'POST') {

        sendJson(res, 405, {
            error: 'Method not allowed'
        });

        return;
    }

    try {

        const { token } = req.body;

        // ====================================
        // VALIDATE TOKEN INPUT
        // ====================================

        if (!token) {

            sendJson(res, 401, {
                success: false,
                error: 'No token'
            });

            return;
        }

        // ====================================
        // VALIDATE TOKEN
        // ====================================

        const {
            data: { user },
            error
        } =
            await supabase.auth.getUser(token);

        if (error || !user) {

            sendJson(res, 401, {
                success: false,
                error: 'Invalid token'
            });

            return;
        }

        // ====================================
        // GET PROFILE
        // ====================================

        const {
            data: profile,
            error: profileError
        } =
            await supabase
                .from('profiles')
                .select(`
                    full_name,
                    remaining_seconds
                `)
                .eq('id', user.id)
                .single();

        if (profileError || !profile) {

            sendJson(res, 404, {
                success: false,
                error: 'Profile not found'
            });

            return;
        }

        // ====================================
        // RESPONSE
        // ====================================

        sendJson(res, 200, {

            success: true,

            user:
                profile.full_name || '',

            seconds:
                profile.remaining_seconds || 0
        });

        return;

    }
    catch (err) {

        console.error(
            'PROFILE ERROR:',
            err
        );

        sendJson(res, 500, {
            success: false,
            error: err.message
        });

        return;
    }
}