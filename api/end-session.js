import express from "express";
import { supabase } from "../lib/supabase.js";

import {
    getSession,
    updateSession,
    deleteSession
} from "../lib/session-store.js";

import {
    calculateDuration,
    calculateRemainingSeconds
} from "../lib/billing.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {

        console.log("🛑 END SESSION HIT");

        const { sessionId } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "Missing sessionId"
            });
        }

        // ====================================
        // GET SESSION
        // ====================================
        const session = getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        // ====================================
        // DOUBLE STOP GUARD (ATOMIC STYLE)
        // ====================================
        if (session.isEnding) {
            console.log("⚠️ ALREADY ENDING:", sessionId);

            return res.json({
                success: true,
                message: "Already ending"
            });
        }

        updateSession(sessionId, { isEnding: true });

        console.log("🔒 SESSION LOCKED:", sessionId);

        // ====================================
        // CALCULATE DURATION (RAW)
        // ====================================
        const rawDuration = calculateDuration(session);

        console.log("⏱ RAW DURATION:", rawDuration);

        // ====================================
        // GET USER
        // ====================================
        const { data: user, error } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", session.userId)
            .single();

        if (error || !user) {
            console.log("❌ USER FETCH FAILED");

            return res.status(500).json({
                success: false,
                message: "Failed to fetch user"
            });
        }

        // ====================================
        // APPLY BILLING (IMPORTANT FIX)
        // ====================================

        const graceSeconds = session.graceSeconds || 0;

        const billableDuration =
            Math.max(0, rawDuration - graceSeconds);

        const updatedRemaining =
            calculateRemainingSeconds(
                user.remaining_seconds,
                billableDuration
            );

        console.log("💰 BILLING CALC:", {
            before: user.remaining_seconds,
            rawDuration,
            graceSeconds,
            billableDuration,
            after: updatedRemaining
        });

        // ====================================
        // UPDATE DB
        // ====================================
        const { error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: updatedRemaining
            })
            .eq("id", session.userId);

        if (updateError) {
            console.log("❌ DB UPDATE FAILED");

            return res.status(500).json({
                success: false,
                message: "DB update failed"
            });
        }

        console.log("✅ DB UPDATED");

        // ====================================
        // CLEAN SESSION
        // ====================================
        deleteSession(sessionId);

        console.log("🗑 SESSION DELETED");

        // ====================================
        // RESPONSE
        // ====================================
        return res.json({
            success: true,
            duration: billableDuration,
            remainingSeconds: updatedRemaining
        });

    } catch (err) {
        console.log("❌ END SESSION ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;