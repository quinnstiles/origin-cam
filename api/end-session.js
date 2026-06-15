// api/end-session.js
import express from "express";
import { getSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";
import { supabase } from "../lib/supabase.js"; // 🌟 Import your database client

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.json({ success: false, message: "Missing sessionId." });
        }

        console.log(`📡 [Server] Manual end request received for Session ID: ${sessionId}`);

        // 1. Run authoritative finalization check
        const result = await finalizeSession(sessionId, "manual", false);

        // 2. 🌟 FALLBACK RECOVERY: If memory cache already evicted it, get live state from database
        if (result.message === "Already finalized" || !result.success) {
            console.log("⚠️ Session absent from memory cache. Syncing directly from database profile...");

            // Extract the user token passed along headers or body to pull database parameters securely
            const { token } = req.body;
            if (token) {
                const { data: { user } } = await supabase.auth.getUser(token);
                if (user) {
                    const { data: profile } = await supabase
                        .from("users")
                        .select("remaining_seconds")
                        .eq("id", user.id)
                        .single();

                    if (profile) {
                        return res.json({
                            success: true,
                            remainingSeconds: profile.remaining_seconds
                        });
                    }
                }
            }
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