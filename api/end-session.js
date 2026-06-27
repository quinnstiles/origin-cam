// api/end-session.js
import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId, token } = req.body;
        if (!sessionId) {
            return res.json({ success: false, message: "Missing sessionId." });
        }

        console.log(`📡 [Server] End request received for Session ID: ${sessionId}`);

        // 1. Run authoritative finalization check (wipes memory cache, updates DB if active)
        const result = await finalizeSession(sessionId, "manual", false);

        // 2. 🌟 FALLBACK RECOVERY: If memory cache already evicted it (or server restarted),
        // use the provided token to securely pull the clean balance from the database profile.
        if (result.message === "Already finalized" || !result.success) {
            console.log("⚠️ Session absent from memory cache. Syncing directly from database profile...");

            if (!token) {
                return res.json({
                    success: false,
                    message: "Session not in memory cache and no auth token provided for fallback verification."
                });
            }

            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                console.log("❌ Fallback authentication rejected:", authError?.message);
                return res.json({ success: false, message: "Unauthorized token status." });
            }

            const { data: profile, error: dbError } = await supabase
                .from("users")
                .select("remaining_seconds")
                .eq("id", user.id)
                .single();

            if (dbError || !profile) {
                console.log("❌ Fallback DB Query failed:", dbError?.message);
                return res.json({ success: false, message: "Failed resolving fallback profile balance." });
            }

            return res.json({
                success: true,
                remainingSeconds: profile.remaining_seconds
            });
        }

        if (result.success) {
            return res.json({
                success: true,
                remainingSeconds: result.remainingSeconds
            });
        } else {
            return res.json({ success: false, message: "Failed finalizing session calculations." });
        }
    } catch (err) {
        console.log("❌ END SESSION ROUTE ERROR:", err.message);
        return res.json({ success: false, message: err.message });
    }
});

export default router;