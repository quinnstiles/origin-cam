import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';

import {
    createClient
} from '@supabase/supabase-js';

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
// START SESSION
// ========================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: 'Method not allowed'
        }));

        return;
    }

    try {
        // =========================
        // AUTH
        // =========================

        const token =
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            res.writeHead(401, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'No token'
            }));

            return;

        }

        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            res.writeHead(401, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'Invalid token'
            }));

            return;

        }

        // =========================
        // GET PROFILE
        // =========================

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from('profiles')
            .select('remaining_seconds')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {

            res.writeHead(404, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'Profile not found'
            }));

            return;
        }

        if (profile.remaining_seconds <= 0) {

            res.writeHead(403, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'No remaining time'
            }));

            return;
        }

        // =========================
        // CREATE SESSION ID
        // =========================

        const sessionId =
            crypto.randomUUID();

        const now = Date.now();

        const expiresAt =
            now +
            (profile.remaining_seconds * 1000);

        // =========================
        // STORE IN MEMORY
        // =========================

        global.activeSessions[sessionId] = {

            sessionId,

            userId: user.id,

            startTime: now,

            expiresAt,

            lastHeartbeat: now,

            remainingAtStart:
                profile.remaining_seconds
        };

        console.log(
            'SESSION STARTED:',
            sessionId
        );

        // =========================
        // RESPONSE
        // =========================

        res.writeHead(200, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({

            success: true,

            session_id: sessionId,

            seconds:
                profile.remaining_seconds,

            apiKey:
                process.env.DECART_API_KEY
        }));

        return;
    }
    catch (err) {
        console.error(err);

        res.writeHead(500, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: err.message
        }));

        return;
    }
}