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
    if (res.headersSent)
        return;

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(JSON.stringify(data));
}

// ========================================
// END SESSION
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

        const userId = user.id;

        // ====================================
        // GET ACTIVE SESSION
        // ====================================

        const {
            data: session,
            error: sessionError
        } =
            await supabase
                .from('sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .single();

        if (sessionError || !session) {
            sendJson(res, 404, {
                error: 'No active session'
            });

            return;
        }

        // ====================================
        // MEMORY SESSION
        // ====================================

        const memorySession =
            global.activeSessions?.[
            session.id
            ];

        // ====================================
        // FALLBACK RECOVERY
        // ====================================

        const expiresAt =
            memorySession
                ? memorySession.expiresAt
                : new Date(
                    session.expires_at
                ).getTime();

        const fullDuration =
            memorySession
                ? memorySession.fullDuration
                : session.remaining_at_start;

        // ====================================
        // CALCULATE REMAINING
        // ====================================

        const now = Date.now();

        let remainingSeconds =
            Math.floor(
                (expiresAt - now) / 1000
            );

        if (remainingSeconds < 0) {
            remainingSeconds = 0;
        }

        // ====================================
        // CALCULATE USED
        // ====================================

        let usedSeconds =
            fullDuration -
            remainingSeconds;

        if (usedSeconds < 0) {
            usedSeconds = 0;
        }

        // ====================================
        // UPDATE SESSION
        // ====================================

        await supabase
            .from('sessions')
            .update({

                status: 'ended',

                end_time:
                    new Date(now)
                        .toISOString(),

                used_seconds:
                    usedSeconds,

                heartbeat_at:
                    new Date(now)
                        .toISOString()

            })
            .eq('id', session.id);

        // ====================================
        // UPDATE PROFILE
        // ====================================

        await supabase
            .from('profiles')
            .update({

                remaining_seconds:
                    remainingSeconds

            })
            .eq('id', userId);

        // ====================================
        // REMOVE MEMORY
        // ====================================

        if (
            global.activeSessions &&
            global.activeSessions[
            session.id
            ]
        ) {
            delete global.activeSessions[
                session.id
            ];
        }

        // ====================================
        // RESPONSE
        // ====================================

        sendJson(res, 200, {

            success: true,

            remaining_seconds:
                remainingSeconds,

            used_seconds:
                usedSeconds
        });

        return;
    }
    catch (err) {
        console.error(
            'END SESSION ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });

        return;
    }
}