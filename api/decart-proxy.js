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
// JSON RESPONSE
// ========================================

function sendJson(res, status, data) {

    if (res.headersSent)
        return;

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(JSON.stringify(data));
}

// ========================================
// HANDLER
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

        // ====================================
        // AUTH TOKEN
        // ====================================

        const token =
            req.headers.authorization
                ?.split(' ')[1];

        if (!token) {

            sendJson(res, 401, {
                error: 'No token'
            });

            return;
        }

        // ====================================
        // VERIFY USER
        // ====================================

        const {
            data: { user },
            error: authError
        } =
            await supabase.auth.getUser(token);

        if (authError || !user) {

            sendJson(res, 401, {
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
                .select('remaining_seconds')
                .eq('id', user.id)
                .single();

        if (profileError || !profile) {

            sendJson(res, 404, {
                error: 'Profile not found'
            });

            return;
        }

        // ====================================
        // CHECK TIME
        // ====================================

        if (profile.remaining_seconds <= 0) {

            sendJson(res, 403, {
                error: 'No remaining time'
            });

            return;
        }

        // ====================================
        // RETURN DEcart KEY
        // ====================================

        sendJson(res, 200, {

            success: true,

            apiKey:
                process.env.DECART_API_KEY,

            remaining_seconds:
                profile.remaining_seconds
        });

        return;

    }
    catch (err) {

        console.error(
            'DECART PROXY ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });

        return;
    }
}