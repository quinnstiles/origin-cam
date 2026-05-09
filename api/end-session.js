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
        // CALCULATE USED TIME
        // ====================================

        const now = Date.now();

        const startTime =
            new Date(
                session.start_time
            ).getTime();

        let usedSeconds =
            Math.floor(
                (now - startTime) / 1000
            );

        // ====================================
        // SAFETY
        // ====================================

        if (usedSeconds < 0) {
            usedSeconds = 0;
        }

        // ====================================
        // MAX DURATION CAP
        // ====================================

        if (
            session.max_duration_seconds &&
            usedSeconds >
            session.max_duration_seconds
        ) {

            usedSeconds =
                session.max_duration_seconds;
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
                    remaining_seconds,
                    total_used_seconds
                `)
                .eq('id', userId)
                .single();

        if (profileError || !profile) {

            sendJson(res, 404, {
                error: 'Profile not found'
            });

            return;
        }

        // ====================================
        // CALCULATE BALANCE
        // ====================================

        let newRemaining =
            session.remaining_at_start -
            usedSeconds;

        if (newRemaining < 0) {
            newRemaining = 0;
        }

        const expired =
            newRemaining <= 0;

        // ====================================
        // UPDATE SESSION
        // ====================================

        const {
            error: updateSessionError
        } =
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

        if (updateSessionError) {

            sendJson(res, 500, {
                error:
                    updateSessionError.message
            });

            return;
        }

        // ====================================
        // UPDATE PROFILE
        // ====================================

        const {
            error: updateProfileError
        } =
            await supabase
                .from('profiles')
                .update({

                    remaining_seconds:
                        newRemaining,

                    total_used_seconds:
                        (profile.total_used_seconds || 0)
                        + usedSeconds

                })
                .eq('id', userId);

        if (updateProfileError) {

            sendJson(res, 500, {
                error:
                    updateProfileError.message
            });

            return;
        }

        // ====================================
        // REMOVE MEMORY SESSION
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

            used_seconds:
                usedSeconds,

            remaining_seconds:
                newRemaining,

            expired

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