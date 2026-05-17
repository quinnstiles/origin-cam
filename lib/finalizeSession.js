import { supabase } from './supabase.js';

export async function finalizeSession(sessionId, fullyConsumed = false) {

    const session = global.__SESSION_STORE__?.get(sessionId);

    if (!session) {
        console.log("❌ Session not found:", sessionId);
        return;
    }

    const now = Date.now();

    const elapsedSeconds =
        Math.floor((now - session.createdAt) / 1000);

    let billedSeconds = elapsedSeconds - session.graceSeconds;

    if (billedSeconds < 0) billedSeconds = 0;

    if (fullyConsumed) {
        billedSeconds = session.dbSeconds;
    }

    if (billedSeconds > session.dbSeconds) {
        billedSeconds = session.dbSeconds;
    }

    const remainingSeconds =
        Math.max(0, session.dbSeconds - billedSeconds);

    console.log("💰 BILLING RESULT:", {
        sessionId,
        billedSeconds,
        remainingSeconds
    });

    const { error } = await supabase
        .from("users")
        .update({
            remaining_seconds: remainingSeconds
        })
        .eq("id", session.userId);

    if (error) {
        console.log("❌ Billing error:", error.message);
        return;
    }

    console.log("✅ Billing updated");
}