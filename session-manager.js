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
// GLOBAL MEMORY
// ========================================

global.activeSessions =
    global.activeSessions || {};

global.watchdogStarted =
    global.watchdogStarted || false;

// ========================================
// FINALIZE SESSION
// ========================================

export async function finalizeSession(session) {
    try {
        const now = Date.now();

        // =========================
        // REMAINING TIME
        // =========================

        let remainingSeconds =
            Math.floor(
                (session.expiresAt - now) / 1000
            );

        if (remainingSeconds < 0) {
            remainingSeconds = 0;
        }

        // =========================
        // USED TIME
        // =========================

        let usedSeconds =
            session.fullDuration -
            remainingSeconds;

        if (usedSeconds < 0) {
            usedSeconds = 0;
        }

        // =========================
        // UPDATE SESSION
        // =========================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',

                used_seconds:
                    usedSeconds,

                end_time:
                    new Date()
                        .toISOString()
            })
            .eq('id', session.sessionId);

        // =========================
        // UPDATE PROFILE
        // =========================

        await supabase
            .from('profiles')
            .update({
                remaining_seconds:
                    remainingSeconds
            })
            .eq('id', session.userId);

        // =========================
        // REMOVE MEMORY
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

// ========================================
// WATCHDOG
// ========================================

export function startWatchdog() {
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
                    'AUTO FINALIZING:',
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
// RESTORE ACTIVE SESSIONS
// ========================================

export async function restoreSessions() {
    try {
        console.log(
            'RESTORING SESSIONS...'
        );

        const {
            data: sessions,
            error
        } = await supabase
            .from('sessions')
            .select('*')
            .eq('status', 'active');

        if (error) {
            console.error(error);
            return;
        }

        const now = Date.now();

        for (const session of sessions) {
            const expiresAt =
                new Date(
                    session.expires_at
                ).getTime();

            // =====================
            // EXPIRED WHILE OFFLINE
            // =====================

            if (now >= expiresAt) {
                await finalizeSession({
                    sessionId:
                        session.id,

                    userId:
                        session.user_id,

                    expiresAt,

                    fullDuration:
                        session.remaining_at_start
                });

                continue;
            }

            // =====================
            // RESTORE TO MEMORY
            // =====================

            global.activeSessions[
                session.id
            ] = {

                sessionId:
                    session.id,

                userId:
                    session.user_id,

                startedAt:
                    new Date(
                        session.start_time
                    ).getTime(),

                expiresAt,

                remainingAtStart:
                    session.remaining_at_start,

                fullDuration:
                    session.remaining_at_start,

                lastHeartbeat:
                    Date.now()
            };

            console.log(
                'RESTORED SESSION:',
                session.id
            );
        }

        startWatchdog();
    }
    catch (err) {
        console.error(
            'RESTORE ERROR:',
            err
        );
    }
}