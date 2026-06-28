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
        if (!session) {
            return res.json({
                success: false,
                message: "Session not found or expired tracking parameters."
            });
        }

        // 🔍 CROSS-MACHINE SECURITY VERIFICATION
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

        console.log(`🎥 Stream initialization sequence verified for: ${sessionId}. Client must connect to the control pipe socket.`);
        return res.json({ success: true, message: "Session verified for engine pipe link initialization mapping." });

    } catch (err) {
        console.log("❌ ACTIVATE SESSION ERROR:", err.message);
        return res.json({ success: false, message: err.message });
    }
});

export default router;