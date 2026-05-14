import {
    getSession,
    removeSession
} from './sessionStore.js';

import { endSession as finalizeBilling } from './billing.js';

// ========================================
// FINALIZE SESSION (WRAPPER ONLY)
// ========================================
export async function finalizeSession(
    sessionId,
    reason = "system_end"
) {

    const session = getSession(sessionId);

    if (!session) {
        console.log("⚠️ finalizeSession: session not found", sessionId);
        return null;
    }

    // ====================================
    // DELEGATE BILLING TO SINGLE ENGINE
    // ====================================
    const result = await finalizeBilling(sessionId, {
        reason
    });

    if (!result) {
        console.log("❌ Billing failed for session:", sessionId);
        return null;
    }

    // ====================================
    // CLEAN MEMORY
    // ====================================
    removeSession(sessionId);

    console.log("🧹 Session finalized:", sessionId);

    return {
        sessionId,
        billedSeconds: result.billed_seconds,
        status: result.status
    };
}