import { supabase } from "./supabase.js";

// ========================================
// DEBUG BILLING ONLY (NO GRACE, NO FILTERS)
// ========================================
export async function endSession(sessionId, meta = {}) {

    const now = Date.now();

    const { data: session, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

    if (error || !session) {
        console.log("❌ Session not found:", sessionId);
        return null;
    }

    if (session.ended_at) {
        console.log("⚠️ Already billed session:", sessionId);
        return session;
    }

    // ========================================
    // PURE RAW BILLING (NO GRACE, NO LOGIC)
    // ========================================
    const startedAt = session.started_at;

    const rawSeconds = Math.floor(
        (now - startedAt) / 1000
    );

    console.log("💰 RAW BILLING DEBUG:", {
        sessionId,
        startedAt,
        now,
        rawSeconds
    });

    // ========================================
    // FORCE UPDATE DB
    // ========================================
    const { data, error: updateError } = await supabase
        .from("sessions")
        .update({
            ended_at: now,
            billed_seconds: rawSeconds,
            status: "closed",
            close_reason: meta.reason || "debug_close"
        })
        .eq("id", sessionId)
        .select()
        .single();

    if (updateError) {
        console.log("❌ Billing update error:", updateError.message);
        return null;
    }

    console.log("✅ BILLING SAVED:", data);

    return data;
}