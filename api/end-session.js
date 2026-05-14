import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Missing sessionId"
            });
        }

        // 🔥 GET FROM SUPABASE (NOT MEMORY)
        const { data: session, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (error || !session) {
            console.log("Session not found in DB:", sessionId);

            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        const now = Date.now();
        const started = new Date(session.started_at).getTime();

        const secondsUsed = Math.floor((now - started) / 1000);

        const remainingSeconds = Math.max(
            0,
            session.total_seconds - secondsUsed
        );

        // 🔥 UPDATE DB (THIS IS THE BILLING)
        const { error: updateError } = await supabase
            .from("sessions")
            .update({
                used_seconds: secondsUsed,
                remaining_seconds_after: remainingSeconds,
                ended_at: new Date().toISOString(),
                status: "ended",
                end_reason: "manual"
            })
            .eq("id", sessionId);

        if (updateError) {
            console.log("Update error:", updateError.message);
            return res.status(500).json({
                success: false,
                message: "DB update failed"
            });
        }

        return res.json({
            success: true,
            sessionId,
            secondsUsed,
            remainingSeconds
        });

    } catch (err) {
        console.log("END SESSION ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

export default router;