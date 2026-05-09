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
// =====================================================
// GLOBAL MEMORY STORE
// =====================================================

global.activeSessions =
    global.activeSessions || {};

global.watchdogStarted =
    global.watchdogStarted || false;

// =====================================================
// FINALIZE SESSION
// =====================================================

async function finalizeSession(session) {
    try {
        const now = Date.now();

        const usedSeconds =
            Math.floor(
                (now - session.startedAt) / 1000
            );

        let remaining =
            session.remainingAtStart -
            usedSeconds;

        if (remaining < 0)
            remaining = 0;

        // =========================
        // UPDATE SESSION
        // =========================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',
                used_seconds: usedSeconds,
                end_time: new Date().toISOString()
            })
            .eq('id', session.sessionId);

        // =========================
        // UPDATE PROFILE
        // =========================

        await supabase
            .from('profiles')
            .update({
                remaining_seconds: remaining
            })
            .eq('id', session.userId);

        // =========================
        // REMOVE MEMORY SESSION
        // =========================

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

// =====================================================
// WATCHDOG
// =====================================================

function startWatchdog() {
    if (global.watchdogStarted)
        return;

    global.watchdogStarted = true;

    setInterval(async () => {
        const now = Date.now();

        for (const id in global.activeSessions) {
            const session =
                global.activeSessions[id];

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

// =====================================================
// API HANDLER
// =====================================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        // =========================
        // START WATCHDOG
        // =========================

        startWatchdog();

        // =========================
        // AUTH
        // =========================

        const token =
            req.headers.authorization
                ?.split(' ')[1];

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
        // END OLD ACTIVE SESSIONS
        // =========================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',
                end_time: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('status', 'active');

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
        // CREATE SESSION
        // =========================

        const expiresAt =
            Date.now() +
            (profile.remaining_seconds * 1000);

        const {
            data: session,
            error: sessionError
        } = await supabase
            .from('sessions')
            .insert([{
                user_id: user.id,
                status: 'active',
                start_time: new Date().toISOString(),
                remaining_at_start:
                    profile.remaining_seconds,
                expires_at:
                    new Date(expiresAt)
                        .toISOString()
            }])
            .select()
            .single();

        if (sessionError) {
            return res.status(500).json({
                error: sessionError.message
            });
        }

        // =========================
        // MEMORY SESSION
        // =========================

        global.activeSessions[
            session.id
        ] = {
            sessionId: session.id,
            userId: user.id,
            startedAt: Date.now(),
            lastHeartbeat: Date.now(),
            expiresAt,
            remainingAtStart:
                profile.remaining_seconds
        };

        console.log(
            'SESSION STARTED:',
            session.id
        );

        // =========================
        // RESPONSE
        // =========================

        return res.status(200).json({
            success: true,
            session_id: session.id,
            remaining_seconds:
                profile.remaining_seconds
        });
    }
    catch (err) {
        console.error(
            'BEGIN BILLING ERROR:',
            err
        );

        return res.status(500).json({
            error: err.message
        });
    }
}