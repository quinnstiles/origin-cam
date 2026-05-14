import express from "express";
import { supabase } from "../lib/supabase.js";
import { getSession } from "../lib/sessionStore.js";
import { endSession as finalizeBilling } from "../lib/billing.js";

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
        // 1. GET MEMORY SESSION (SOURCE OF TRUTH)
        // ========================================
        const memorySession = getSession(sessionId);

        if (!memorySession) {
            return res.status(404).json({
                success: false,
                message: "Session not active in server memory"
            });
        }

        // ========================================
        // 2. FINALIZE BILLING (SERVER TRUTH)
        // ========================================
        const result = await finalizeBilling(sessionId, {
            reason: "manual_end"
        });

        if (!result) {
            return res.status(500).json({
                success: false,
                message: "Billing failed"
            });
        }

        // ========================================
        // 3. CLEAN MEMORY SESSION
        // ========================================
        memorySession.ended = true;

        return res.json({
            success: true,
            sessionId,
            billedSeconds: result.billed_seconds,
            status: result.status
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