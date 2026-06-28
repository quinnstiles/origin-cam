import express from "express";
import { activeControlSessions } from "../app.js";
import { finalizeSession } from "../lib/finalizeSession.js";
import { supabase } from "../lib/supabase.js"; // 🌟 Bring in database to read true balance safely

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.json({ success: false, remainingSeconds: 0, message: "Missing sessionId parameters." });
        }

        // 🛡️ THE ANTI-FRAUD SWITCH: Is the real streaming pipe still active?
        if (activeControlSessions.has(sessionId)) {
            console.log(`🚫 [FRAUD DEFLECTED] Prevented a client bypass attempt targeting active session: ${sessionId}`);
            return res.json({
                success: false,
                remainingSeconds: 0,
                message: "Security Error: Active streaming pipe pipeline is still live. Request denied."
            });
        }

        // Try finalizing through the normal memory-store routine
        let result = await finalizeSession(sessionId, "manual", false);

        // 🌟 FIX THE FALLBACK: If memory store already deleted the session object,
        // cross-verify straight against the database profile instead of returning 0.
        if (!result || !result.success || result.remainingSeconds === 0) {
            console.log(`ℹ️ [Session Sync] Memory state empty for ${sessionId}. Fetching authoritative DB record...`);

            // Extract the user associated with this session identifier directly from database
            const { data: userData, error } = await supabase
                .from("users")
                .select("remaining_seconds")
                .eq("active_session_id", sessionId)
                .single();

            if (!error && userData) {
                return res.json({
                    success: true,
                    remainingSeconds: Number(userData.remaining_seconds),
                    balance: Number(userData.remaining_seconds)
                });
            }

            // If the active_session_id was already nulled out by ws.on("close"), 
            // fallback to returning the current state of whoever hit the endpoint if validation passes
            // Or look up based on the token context.
        }

        // Standard response return layout matching C++ EndSessionResult struct
        return res.json({
            success: result.success,
            remainingSeconds: result.remainingSeconds || 0,
            balance: result.remainingSeconds || 0
        });

    } catch (err) {
        console.log("❌ END SESSION ROUTE ERROR:", err.message);
        return res.json({ success: false, remainingSeconds: 0, message: err.message });
    }
});

export default router;