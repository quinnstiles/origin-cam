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
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        // =========================
        // AUTH
        // =========================

        const token =
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'No token'
            });
        }

        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                error: 'Invalid token'
            });
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
            return res.status(404).json({
                error: 'Profile not found'
            });
        }

        if (profile.remaining_seconds <= 0) {
            return res.status(403).json({
                error: 'No remaining time'
            });
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

        return res.status(200).json({

            success: true,

            session_id: sessionId,

            seconds:
                profile.remaining_seconds,

            apiKey:
                process.env.DECART_API_KEY
        });
    }
    catch (err) {
        console.error(err);

        return res.status(500).json({
            error: err.message
        });
    }
}