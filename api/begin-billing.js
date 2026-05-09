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
// GLOBAL MEMORY STORE
// ========================================

global.activeSessions =
    global.activeSessions || {};

global.watchdogStarted =
    global.watchdogStarted || false;

// ========================================
// FINALIZE SESSION
// ========================================

async function finalizeSession(session) {

    try {

        // already finalized
        if (!global.activeSessions[session.sessionId]) {
            return;
        }

        const now = Date.now();

        const usedSeconds =
            Math.floor(
                (now - session.startedAt) / 1000
            );

        let remaining =
            session.remainingAtStart -
            usedSeconds;

        if (remaining < 0) {
            remaining = 0;
        }

        // ====================================
        // UPDATE SESSION
        // ====================================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',
                used_seconds: usedSeconds,
                end_time: new Date().toISOString()
            })
            .eq('id', session.sessionId);

        // ====================================
        // UPDATE PROFILE
        // ====================================

        await supabase
            .from('profiles')
            .update({
                remaining_seconds: remaining
            })
            .eq('id', session.userId);

        // ====================================
        // REMOVE FROM MEMORY
        // ====================================

        delete global.activeSessions[
            session.sessionId
        ];

        console.log(
            'SESSION FINALIZED:',
            session.sessionId
        );

    }
    catch (err) {

        console.error(
            'FINALIZE ERROR:',
            err
        );
    }
}

// ========================================
// WATCHDOG
// ========================================

function startWatchdog() {

    if (global.watchdogStarted) {
        return;
    }

    global.watchdogStarted = true;

    setInterval(async () => {

        const now = Date.now();

        for (const id in global.activeSessions) {

            const session =
                global.activeSessions[id];

            if (!session) {
                continue;
            }

            const expired =
                now >= session.expiresAt;

            const heartbeatDead =
                now - session.lastHeartbeat >
                20000;

            if (expired || heartbeatDead) {

                console.log(
                    'AUTO TERMINATING:',
                    id
                );

                await finalizeSession(
                    session
                );
            }
        }

    }, 5000);
}

// ========================================
// API HANDLER
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
        // START WATCHDOG
        // ====================================

        startWatchdog();

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
        // END OLD ACTIVE SESSIONS
        // ====================================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',
                end_time: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('status', 'active');

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

        if (profile.remaining_seconds <= 0) {

            sendJson(res, 403, {
                error: 'No remaining time'
            });

            return;
        }

        // ====================================
        // CREATE SESSION
        // ====================================

        const now = Date.now();

        const expiresAt =
            now +
            (profile.remaining_seconds * 1000);

        const {
            data: session,
            error: sessionError
        } =
            await supabase
                .from('sessions')
                .insert([{
                    user_id: user.id,
                    status: 'active',
                    start_time:
                        new Date().toISOString(),
                    remaining_at_start:
                        profile.remaining_seconds,
                    expires_at:
                        new Date(expiresAt)
                            .toISOString()
                }])
                .select()
                .single();

        if (sessionError || !session) {

            sendJson(res, 500, {
                error: sessionError?.message ||
                    'Failed to create session'
            });

            return;
        }

        // ====================================
        // STORE MEMORY SESSION
        // ====================================

        global.activeSessions[
            session.id
        ] = {

            sessionId: session.id,

            userId: user.id,

            startedAt: now,

            lastHeartbeat: now,

            expiresAt,

            remainingAtStart:
                profile.remaining_seconds
        };

        console.log(
            'SESSION STARTED:',
            session.id
        );

        // ====================================
        // RESPONSE
        // ====================================

        sendJson(res, 200, {
            success: true,
            session_id: session.id,
            remaining_seconds:
                profile.remaining_seconds
        });

        return;

    }
    catch (err) {

        console.error(
            'BEGIN BILLING ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });

        return;
    }
}