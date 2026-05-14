import {
    getSession,
    removeSession
} from './sessionStore.js';

// ========================================
// FINALIZE SESSION
// ========================================

export async function finalizeSession(
    sessionId,
    fullyConsumed = false
) {

    const session =
        getSession(sessionId);

    if (!session) {
        return;
    }

    // ====================================
    // TIME USED
    // ====================================

    const now =
        Date.now();

    const elapsed =
        Math.floor(
            (now - session.startedAt) / 1000
        );

    // ====================================
    // FULLY CONSUMED
    // ====================================

    let remainingSeconds = 0;

    if (!fullyConsumed) {

        remainingSeconds =
            session.sessionDuration -
            elapsed;

        // ================================
        // REMOVE GRACE LEAK
        // ================================

        if (
            remainingSeconds >
            session.dbSeconds
        ) {
            remainingSeconds =
                session.dbSeconds;
        }

        if (remainingSeconds < 0) {
            remainingSeconds = 0;
        }
    }

    // ====================================
    // DEBUG
    // ====================================

    console.log('💰 BILLING RESULT');

    console.log({
        sessionId,
        userId: session.userId,
        elapsed,
        remainingSeconds
    });

    // ====================================
    // TODO:
    // UPDATE SUPABASE HERE
    // ====================================

    /*
    await supabase
        .from('profiles')
        .update({
            seconds: remainingSeconds
        })
        .eq('id', session.userId);
    */

    // ====================================
    // CLEANUP
    // ====================================

    removeSession(sessionId);
}