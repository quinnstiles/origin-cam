import {
    getSession,
    removeSession
} from './sessionStore.js';

import { supabase } from './supabase.js';

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
        console.log(
            "❌ Session not found:",
            sessionId
        );
        return;
    }

    // ====================================
    // TIME CALCULATION
    // ====================================

    const now =
        Date.now();

    const elapsedMs =
        now - session.startedAt;

    const elapsedSeconds =
        Math.floor(elapsedMs / 1000);

    // ====================================
    // REMOVE GRACE FROM BILLING
    // ====================================

    let billedSeconds =
        elapsedSeconds - session.graceSeconds;

    if (billedSeconds < 0) {
        billedSeconds = 0;
    }

    // ====================================
    // FULL CONSUME
    // ====================================

    if (fullyConsumed) {
        billedSeconds =
            session.dbSeconds;
    }

    // ====================================
    // NEVER OVERCHARGE
    // ====================================

    if (billedSeconds > session.dbSeconds) {
        billedSeconds =
            session.dbSeconds;
    }

    // ====================================
    // FINAL REMAINING
    // ====================================

    const remainingSeconds =
        Math.max(
            0,
            session.dbSeconds - billedSeconds
        );

    console.log("💰 BILLING RESULT");

    console.log({
        sessionId,
        userId: session.userId,
        elapsedSeconds,
        billedSeconds,
        remainingSeconds
    });

    // ====================================
    // UPDATE USERS TABLE
    // ====================================

    const { error } =
        await supabase
            .from("users")
            .update({
                remaining_seconds:
                    remainingSeconds
            })
            .eq(
                "id",
                session.userId
            );

    if (error) {

        console.log(
            "❌ Supabase billing error:",
            error.message
        );

        return;
    }

    console.log(
        "✅ Billing updated"
    );

    // ====================================
    // CLEANUP
    // ====================================

    removeSession(sessionId);
}