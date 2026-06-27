import express from "express";
import { getSession } from "../lib/session-store.js";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.json({ success: false, message: "Missing sessionId." });
        }

        const session = getSession(sessionId);

        // 1. 🛡️ ZERO-TRUST MEMORY CHECK
        // If the app.js watchdog timer already expired and penalized the account balance,
        // or if server memory cleared, block the delayed activation instantly.
        if (!session) {
            return res.json({
                success: false,
                message: "Session not found, expired, or balance tracking has been written down to 0."
            });
        }

        // 2. 🔍 CROSS-MACHINE SECURITY VERIFICATION
        // Query the database schema directly to ensure this specific machine/session still owns the active slot.
        const { data: profile, error: dbError } = await supabase
            .from("users")
            .select("active_session_id")
            .eq("id", session.userId)
            .single();

        if (dbError || !profile || profile.active_session_id !== sessionId) {
            console.log(`🚨 [ACTIVATE DENIED] Session mismatch. Expected ${sessionId}, DB shows: ${profile?.active_session_id}`);
            return res.json({
                success: false,
                message: "Security violation: This session has been superseded or invalidated by another instance."
            });
        }

        const now = Date.now();

        // 3. ENGAGE BILLING CLOCK FROM THIS EXACT MILLISECOND
        if (!session.isLive) {
            session.isLive = true;
            session.createdAt = now; // The local live billing countdown starts right now

            // 4. ATOMIC STATE UPDATE IN SUPABASE
            const { error: updateError } = await supabase
                .from("users")
                .update({ session_is_live: true })
                .eq("id", session.userId);

            if (updateError) {
                throw new Error(`Failed to update live streaming state flags in Supabase: ${updateError.message}`);
            }

            console.log(`🎥 Stream confirmed live. Billing engine and DB state engaged for: ${sessionId}`);
        }

        // Keep tracking pulse timestamps updated for the interval loop
        session.lastStreamPulse = now;

        return res.json({ success: true, message: "Session activated successfully." });

    } catch (err) {
        console.log("❌ ACTIVATE SESSION ERROR:", err.message);
        return res.json({ success: false, message: err.message });
    }
});

export default router;