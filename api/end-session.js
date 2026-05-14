import express from "express";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// ========================================
// END SESSION
// ========================================
router.post("/", async (req, res) => {

    try {

        const { sessionId } = req.body;

        // ========================================
        // VALIDATION
        // ========================================
        if (!sessionId) {

            return res.status(400).json({
                success: false,
                message: "Missing sessionId"
            });
        }

        // ========================================
        // GET SESSION
        // ========================================
        const {
            data: session,
            error: sessionError
        } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (sessionError || !session) {

            console.log(
                "❌ Session not found"
            );

            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        // ========================================
        // GET USER PROFILE
        // ========================================
        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select("seconds")
            .eq("id", session.user_id)
            .single();

        if (profileError || !profile) {

            console.log(
                "❌ Profile not found"
            );

            return res.status(404).json({
                success: false,
                message: "Profile not found"
            });
        }

        // ========================================
        // FIXED BILLING
        // ========================================
        const debitAmount = 20;

        const currentSeconds =
            profile.seconds || 0;

        const remainingSeconds =
            Math.max(
                0,
                currentSeconds - debitAmount
            );

        // ========================================
        // UPDATE USER BALANCE
        // ========================================
        const {
            error: balanceError
        } = await supabase
            .from("profiles")
            .update({
                seconds: remainingSeconds
            })
            .eq("id", session.user_id);

        if (balanceError) {

            console.log(
                "❌ Balance update failed:",
                balanceError.message
            );

            return res.status(500).json({
                success: false,
                message: "Balance update failed"
            });
        }

        // ========================================
        // UPDATE SESSION
        // ========================================
        const {
            error: updateError
        } = await supabase
            .from("sessions")
            .update({
                used_seconds: debitAmount,
                remaining_seconds_after:
                    remainingSeconds,
                ended_at:
                    new Date().toISOString(),
                status: "ended",
                end_reason: "manual"
            })
            .eq("id", sessionId);

        if (updateError) {

            console.log(
                "❌ Session update failed:",
                updateError.message
            );

            return res.status(500).json({
                success: false,
                message: "Session update failed"
            });
        }

        // ========================================
        // SUCCESS
        // ========================================
        console.log(
            "💰 SESSION DEBITED:",
            {
                sessionId,
                debitAmount,
                remainingSeconds
            }
        );

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