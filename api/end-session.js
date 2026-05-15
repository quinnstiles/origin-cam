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

// ========================================
// END SESSION
// ========================================

router.post("/", async (req, res) => {

    try {

        console.log(
            "🛑 END SESSION HIT"
        );

        const {
            sessionId
        } = req.body || {};

        // ====================================
        // VALIDATE SESSION ID
        // ====================================

        if (!sessionId) {

            console.log(
                "❌ Missing sessionId"
            );

            return res.status(400).json({
                success: false,
                message: "Missing sessionId"
            });
        }

        // ====================================
        // GET SESSION
        // ====================================

        const session =
            getSession(sessionId);

        if (!session) {

            console.log(
                "❌ Session not found"
            );

            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        // ====================================
        // PREVENT DOUBLE BILLING
        // ====================================

        if (session.isEnding) {

            console.log(
                "❌ Session already ending"
            );

            return res.status(400).json({
                success: false,
                message: "Session already ending"
            });
        }

        // ====================================
        // LOCK SESSION
        // ====================================

        updateSession(
            sessionId,
            {
                isEnding: true
            }
        );

        console.log(
            "🔒 SESSION LOCKED"
        );

        // ====================================
        // CALCULATE DURATION
        // ====================================

        const duration =
            calculateDuration(
                session
            );

        console.log(
            "⏱ DURATION:",
            duration
        );

        // ====================================
        // GET LATEST DB USER
        // ====================================

        const {
            data: user,
            error: fetchError
        } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", session.userId)
            .single();

        if (
            fetchError ||
            !user
        ) {
            throw new Error(
                "Failed to fetch user"
            );
        }

        // ====================================
        // CALCULATE NEW TIME
        // ====================================

        const updatedRemaining =
            calculateRemainingSeconds(
                user.remaining_seconds,
                duration
            );

        console.log(
            "💰 BILLING:",
            {
                before:
                    user.remaining_seconds,

                duration,

                after:
                    updatedRemaining
            }
        );

        // ====================================
        // UPDATE DATABASE
        // ====================================

        const {
            error: updateError
        } = await supabase
            .from("users")
            .update({
                remaining_seconds:
                    updatedRemaining
            })
            .eq(
                "id",
                session.userId
            );

        if (updateError) {
            throw new Error(
                "DB update failed"
            );
        }

        console.log(
            "✅ DB UPDATED"
        );

        // ====================================
        // DELETE SESSION
        // ====================================

        deleteSession(
            sessionId
        );

        console.log(
            "🗑 SESSION DELETED"
        );

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({
            success: true,

            duration,

            remainingSeconds:
                updatedRemaining
        });

    } catch (err) {

        console.log(
            "❌ END SESSION ERROR:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;