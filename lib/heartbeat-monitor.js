// ========================================
// IMPORTS
// ========================================

import {
    getAllSessions
} from './session-store.js';

import {
    finalizeSession
} from './billing.js';

import {
    elapsedSeconds,
    now
} from './time.js';

// ========================================
// CONFIG
// ========================================

const HEARTBEAT_TIMEOUT = 3000;

// ========================================
// START MONITOR
// ========================================

export function startHeartbeatMonitor() {
    console.log(
        '❤️ Heartbeat Monitor Started'
    );

    setInterval(async () => {

        const sessions =
            getAllSessions();

        for (const [
            sessionId,
            session
        ] of sessions.entries()) {

            try {

                // ============================
                // HEARTBEAT TIMEOUT
                // ============================

                const heartbeatAge =

                    now() -
                    session.lastHeartbeat;

                if (
                    heartbeatAge >
                    HEARTBEAT_TIMEOUT
                ) {

                    console.log(

                        '💀 HEARTBEAT LOST',

                        sessionId
                    );

                    await finalizeSession({

                        sessionId,

                        reason:
                            'heartbeat_timeout'
                    });

                    continue;
                }

                // ============================
                // SESSION TIME FINISHED
                // ============================

                const elapsed =
                    elapsedSeconds(
                        session.startedAt
                    );

                if (
                    elapsed >=
                    session.totalSeconds
                ) {

                    console.log(

                        '⏱ SESSION FINISHED',

                        sessionId
                    );

                    await finalizeSession({

                        sessionId,

                        reason:
                            'time_finished'
                    });

                    continue;
                }

            } catch (err) {

                console.log(

                    'MONITOR ERROR:',
                    err.message
                );
            }
        }

    }, 1000);
}
