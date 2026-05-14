import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// ========================================
// END SESSION
// ========================================
router.post("/", async (req, res) => {

    try {

        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Missing sessionId"
            });
        }

        // ========================================
        // GET SESSION
        // ========================================
        const { data: session, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (error || !session) {

            console.log("❌ Session not found");

            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        // ========================================
        // FIXED BILLING
        // ========================================
        const debitAmount = 20;

        const currentSeconds =
            session.total_seconds || 0;

        const remainingSeconds =
            Math.max(
                0,
                currentSeconds - debitAmount
            );

        // ========================================
        // UPDATE SESSION
        // ========================================
        const { error: updateError } = await supabase
            .from("sessions")
            .update({
                used_seconds: debitAmount,
                remaining_seconds_after: remainingSeconds,
                ended_at: new Date().toISOString(),
                status: "ended",
                end_reason: "manual"
            })
            .eq("id", sessionId);

        if (updateError) {

            console.log(
                "❌ DB update error:",
                updateError.message
            );

            return res.status(500).json({
                success: false,
                message: "DB update failed"
            });
        }

        console.log("💰 SESSION DEBITED:", {
            sessionId,
            debitAmount,
            remainingSeconds
        });

        return res.json({
            success: true,
            sessionId,
            debited: debitAmount,
            remainingSeconds
        });

    } catch (err) {

        console.log(
            "❌ END SESSION ERROR:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

export default router;