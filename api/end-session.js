import express from "express";

import {
    getSession
} from "../lib/session-store.js";

import {
    closeSession
} from "../lib/session-manager.js";

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

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            });
        }

        if (session.isEnding) {
            return res.json({
                success: true,
                message: "Already ending"
            });
        }

        // ✅ SINGLE SOURCE OF TRUTH
        await closeSession(sessionId, "manual");

        return res.json({
            success: true,
            message: "Session closed"
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