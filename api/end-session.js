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

        // ========================================
        // GET SESSION
        // ========================================
        const { data: session, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (error || !session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        // ========================================
        // GET USER (IMPORTANT FIX HERE)
        // ========================================
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", session.user_id)
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // ========================================
        // SIMPLE DEDUCT 20
        // ========================================
        const debitAmount = 20;

        const remainingSeconds =
            Math.max(0, user.remaining_seconds - debitAmount);

        // ========================================
        // UPDATE USERS TABLE (REAL BILLING)
        // ========================================
        const { error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: remainingSeconds
            })
            .eq("id", session.user_id);

        if (updateError) {
            return res.status(500).json({
                success: false,
                message: "Failed to update user balance"
            });
        }

        // ========================================
        // UPDATE SESSION (optional tracking)
        // ========================================
        await supabase
            .from("sessions")
            .update({
                used_seconds: debitAmount,
                status: "ended",
                ended_at: new Date().toISOString()
            })
            .eq("id", sessionId);

        console.log("💰 DEBIT SUCCESS:", {
            userId: session.user_id,
            debited: debitAmount,
            remainingSeconds
        });

        return res.json({
            success: true,
            debited: debitAmount,
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