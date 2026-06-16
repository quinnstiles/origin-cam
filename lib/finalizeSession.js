import { getUserSession, deleteSession, getSession } from "./session-store.js";
import { supabase } from "./supabase.js";

// ========================================================================
// SECURE AUTHORITATIVE LOCAL FINALIZATION AND DATABASE WRITE BACK
// ========================================================================
export async function finalizeSession(identifier, reason = "manual", isUserId = false) {

    // 1. RESOLVE ACTIVE SESSION OBJECT FROM MEMORY
    const session = isUserId ? getUserSession(identifier) : getSession(identifier);

    if (!session) {
        console.log(`⚠️ [FINALIZE] Target session already handled or dead. [Identifier: ${identifier}]`);
        return { success: true, message: "Already finalized" };
    }

    const currentSessionId = session.sessionId;
    const currentUserId = session.userId;
    const sessionCreatedAt = session.createdAt;
    const sessionWasLive = session.isLive; // Keep track of live flag state

    // ========================================================================
    // 🌟 NEW: THE TRUE AUTONOMOUS SERVER FORCE KILL
    // ========================================================================
    // If the watchdog killed it or it naturally timed out, drop the network feed 
    // at the infrastructure level immediately.
    if (reason === "balance-depleted" || reason === "stream-activity-lost" || reason === "manual") {
        console.log(`💥 [SERVER FORCE KILL] Evicting active streaming pipeline context for: ${currentSessionId}`);

        try {
            // Send the termination signal directly to Decart's cloud infrastructure.
            // Using currentSessionId since it matches the token identifier provisioned upstream.
            const decartRes = await fetch(`https://api.decart.ai/v1/realtime/sessions/${currentSessionId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${process.env.DECART_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (decartRes.ok) {
                console.log(`✅ [UPSTREAM] Decart streaming pipeline severed directly from Onrender for ${currentSessionId}.`);
            } else {
                const errTxt = await decartRes.text();
                console.log(`⚠️ [UPSTREAM] Decart responded with an execution warning: ${errTxt}`);
            }
        } catch (upstreamErr) {
            // Keeps the code resilient so billing updates still write to the database even if the external network call errors out
            console.error("❌ Failed terminating upstream Decart link directly:", upstreamErr.message);
        }
    }

    // 2. EVICT CACHE IMMEDIATELY TO PREVENT RACE CONDITION OVER-SUBTRACTIONS
    deleteSession(currentSessionId);

    try {
        // 3. AUTHORITATIVE LOCAL TIME CALCULATION
        const now = Date.now();
        const localElapsedMs = now - sessionCreatedAt;

        // Convert milliseconds to seconds and round up cleanly
        let elapsedSeconds = Math.ceil(localElapsedMs / 1000);

        // 🌟 SAFETY RATCHET: If the stream went live but closed instantly, charge a 1-second minimum
        if (sessionWasLive && elapsedSeconds <= 0) {
            elapsedSeconds = 1;
        }

        // If the stream never even went live (user cancelled before connecting), charge 0
        if (!sessionWasLive) {
            elapsedSeconds = 0;
        }

        // Safety cap: Clamp billing so they are never charged more than they had in their wallet
        const billedSeconds = Math.min(session.dbSeconds, elapsedSeconds);

        console.log(`🛡️ [LOCAL BILLING ENGINE] Calculated via server timestamps: ${billedSeconds}s`);

        // 4. FETCH CURRENT PROFILE BALANCE FROM SUPABASE
        const { data: userProfile, error: fetchError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", currentUserId)
            .single();

        if (fetchError || !userProfile) {
            console.log("❌ [FINALIZE] User profile balance resolution failed:", fetchError?.message);
            return { success: false, remainingSeconds: 0 };
        }

        const activeDbSeconds = userProfile.remaining_seconds;

        // Subtract what they used and ensure balance never drops below zero
        const theoreticalRemaining = activeDbSeconds - billedSeconds;
        const remainingSeconds = Math.max(0, theoreticalRemaining);

        console.log(`📊 [FINALIZE] PROCESSING LIFECYCLE [Reason: ${reason}]:`, {
            sessionId: currentSessionId,
            userId: currentUserId,
            elapsedSeconds,
            billedSeconds,
            remainingSeconds
        });

        // 5. COMMIT SECURELY TO THE PRODUCTION DATABASE
        const { error } = await supabase
            .from("users")
            .update({ remaining_seconds: remainingSeconds })
            .eq("id", currentUserId);

        if (error) {
            console.log("❌ [FINALIZE] Supabase Database transaction execution error:", error.message);
            return { success: false, remainingSeconds: activeDbSeconds };
        }

        console.log(`✅ [FINALIZE] Database updated successfully for user ${currentUserId}. Bal: ${remainingSeconds}s.`);
        return { success: true, remainingSeconds };

    } catch (globalErr) {
        console.log("❌ [FINALIZE] Critical unhandled internal exception:", globalErr.message);
        return { success: false, error: globalErr.message };
    }
}