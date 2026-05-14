// origin-server/lib/billing.js

import { supabase } from "./supabase.js";

const GRACE_MS = 10000; // your 10s startup grace
const HEARTBEAT_TIMEOUT_MS = 15000; // match heartbeat server logic

// =====================================================
// CLOSE DEAD SESSIONS (AUTO CLEANUP)
// =====================================================
export async function closeDeadSessions() {
    const now = Date.now();

    const { data: sessions, error } = await supabase
        .from("sessions")
        .select("*")
        .is("ended_at", null);

    if (error || !sessions) {
        console.log("Billing fetch error:", error?.message);
        return;
    }

    for (const session of sessions) {

        const lastSeen = session.last_seen || session.started_at;
        const diff = now - lastSeen;

        // =========================================
        // SESSION IS DEAD
        // =========================================
        if (diff > HEARTBEAT_TIMEOUT_MS) {

            console.log("💀 Closing dead session:", session.id);

            await endSession(session.id, {
                reason: "heartbeat_timeout"
            });
        }
    }
}

// =====================================================
// END SESSION (CORE BILLING FUNCTION)
// =====================================================
export async function endSession(sessionId, meta = {}) {

    const now = Date.now();

    // =========================================
    // GET SESSION
    // =========================================
    const { data: session, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

    if (error || !session) {
        console.log("Session not found:", sessionId);
        return null;
    }

    if (session.ended_at) {
        return session; // already closed
    }

    // =========================================
    // BILLING CALCULATION
    // =========================================
    const startedAt = session.started_at;
    const rawDuration = now - startedAt;

    // apply grace ONCE (startup + connection delay)
    const billableMs = Math.max(0, rawDuration - GRACE_MS);

    const billableSeconds = Math.floor(billableMs / 1000);

    // =========================================
    // UPDATE SESSION
    // =========================================
    const { data, error: updateError } = await supabase
        .from("sessions")
        .update({
            ended_at: now,
            billed_seconds: billableSeconds,
            status: "closed",
            close_reason: meta.reason || "manual"
        })
        .eq("id", sessionId)
        .select()
        .single();

    if (updateError) {
        console.log("Billing update error:", updateError.message);
        return null;
    }

    console.log("💰 Session billed:", {
        sessionId,
        billableSeconds
    });

    return data;
}

// =====================================================
// OPTIONAL: AUTO BILLING LOOP (SAFE BACKEND WATCHER)
// =====================================================
export function startBillingWatcher() {

    setInterval(async () => {
        try {
            await closeDeadSessions();
        } catch (e) {
            console.log("Billing watcher error:", e.message);
        }
    }, 5000); // every 5s check

    console.log("💰 Billing watcher started");
}