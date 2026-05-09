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
// GLOBAL MEMORY
// ========================================

if (!global.activeSessions) {
    global.activeSessions = {};
}

// ========================================
// CLEANUP LOOP
// ========================================

const HEARTBEAT_TIMEOUT = 15000; // 15 sec

setInterval(async () => {
    const now = Date.now();

    const sessions =
        Object.values(global.activeSessions);

    for (const session of sessions) {
        try {
            const heartbeatAge =
                now - session.lastHeartbeat;

            const expired =
                now >= session.expiresAt;

            const deadHeartbeat =
                heartbeatAge > HEARTBEAT_TIMEOUT;

            if (!expired && !deadHeartbeat) {
                continue;
            }

            console.log(
                'ENDING SESSION:',
                session.sessionId
            );

            // ====================================
            // CALCULATE USED TIME
            // ====================================

            let usedSeconds =
                Math.floor(
                    (now - session.startTime) / 1000
                );

            if (usedSeconds < 0)
                usedSeconds = 0;

            if (
                usedSeconds >
                session.remainingAtStart
            ) {
                usedSeconds =
                    session.remainingAtStart;
            }

            let remainingSeconds =
                session.remainingAtStart -
                usedSeconds;

            if (remainingSeconds < 0)
                remainingSeconds = 0;

            // ====================================
            // GET PROFILE
            // ====================================

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from('profiles')
                .select(`
                    remaining_seconds,
                    total_used_seconds
                `)
                .eq('id', session.userId)
                .single();

            if (profileError || !profile) {
                console.error(
                    'PROFILE ERROR',
                    profileError
                );

                delete global.activeSessions[
                    session.sessionId
                ];

                continue;
            }

            // ====================================
            // UPDATE PROFILE
            // ====================================

            await supabase
                .from('profiles')
                .update({

                    remaining_seconds:
                        remainingSeconds,

                    total_used_seconds:
                        profile.total_used_seconds +
                        usedSeconds

                })
                .eq('id', session.userId);

            // ====================================
            // REMOVE SESSION
            // ====================================

            delete global.activeSessions[
                session.sessionId
            ];

            console.log(
                'SESSION CLOSED:',
                session.sessionId
            );
        }
        catch (err) {
            console.error(
                'SESSION MANAGER ERROR:',
                err
            );
        }
    }

}, 5000);