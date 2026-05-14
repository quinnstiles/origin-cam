import {
    getSession,
    removeSession
} from "./sessionStore.js";

export async function finalizeSession(
    sessionId,
    fullyConsumed
) {

    const session =
        getSession(sessionId);

    if (!session) return;

    const now = Date.now();

    const elapsed =
        Math.floor(
            (now - session.startTime) / 1000
        );

    let remaining =
        session.fullDuration - elapsed;

    if (remaining < 0)
        remaining = 0;

    // ====================================
    // REMOVE GRACE CREDIT LEAK
    // ====================================

    if (
        remaining >= session.dbSeconds
    ) {
        remaining =
            session.dbSeconds;
    }

    // ====================================
    // FULLY CONSUMED
    // ====================================

    if (fullyConsumed) {
        remaining = 0;
    }

    // ====================================
    // UPDATE DATABASE
    // ====================================

    console.log("💰 FINAL BILLING:", {
        sessionId,
        dbBefore: session.dbSeconds,
        remaining,
        elapsed
    });

    // TODO:
    // UPDATE SUPABASE HERE

    removeSession(sessionId);
}