import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';

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
// GLOBAL SESSION MEMORY
// ========================================

if (!global.activeSessions) {
    global.activeSessions = {};
}

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
// START SESSION
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
        // AUTH
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

        if (
            profile.remaining_seconds <= 0
        ) {

            sendJson(res, 403, {
                error: 'No remaining time'
            });

            return;
        }

        // ====================================
        // CREATE SESSION
        // ====================================

        const sessionId =
            crypto.randomUUID();

        const now =
            Date.now();

        const expiresAt =
            now +
            (
                profile.remaining_seconds
                * 1000
            );

        // ====================================
        // STORE SESSION IN MEMORY
        // ====================================

        global.activeSessions[
            sessionId
        ] = {

            sessionId,

            userId:
                user.id,

            startTime:
                now,

            expiresAt,

            lastHeartbeat:
                now,

            remainingAtStart:
                profile.remaining_seconds
        };

        console.log(
            'SESSION STARTED:',
            sessionId
        );

        // ====================================
        // RESPONSE
        // ====================================

        sendJson(res, 200, {

            success: true,

            session_id:
                sessionId,

            seconds:
                profile.remaining_seconds,

            apiKey:
                process.env.DECART_API_KEY
        });

        return;

    }
    catch (err) {

        console.error(
            'START SESSION ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });

        return;
    }
}