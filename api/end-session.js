import express from "express";

import {
    getSession,
    deleteSession,
    updateSession
} from "../lib/session-store.js";

import { finalizeSession } from "../lib/finalizeSession.js";

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

        const session = getSession(sessionId);

        // already gone
        if (!session) {
            return res.json({
                success: true,
                message: "Already closed"
            });
        }

        // prevent double execution
        if (session.isEnding) {
            return res.json({
                success: true,
                message: "Already ending"
            });
        }

        // mark as ending (prevents race conditions)
        updateSession(sessionId, {
            isEnding: true
        });

        // SINGLE SOURCE OF TRUTH
        await finalizeSession(sessionId, "manual");

        // ensure cleanup (safety fallback)
        deleteSession(sessionId);

        return res.json({
            success: true
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