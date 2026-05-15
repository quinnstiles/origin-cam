import express from "express";

import {
    getSession,
    updateSession
} from "../lib/session-store.js";

const router = express.Router();

// ========================================
// HEARTBEAT
// ========================================

router.post("/", async (req, res) => {

    try {

        console.log(
            "💓 HEARTBEAT HIT"
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
        // VALIDATE SESSION STATE
        // ====================================

        if (!session.isActive) {

            console.log(
                "❌ Session inactive"
            );

            return res.status(400).json({
                success: false,
                message: "Session inactive"
            });
        }

        if (session.isEnding) {

            console.log(
                "❌ Session ending"
            );

            return res.status(400).json({
                success: false,
                message: "Session ending"
            });
        }

        // ====================================
        // HEARTBEAT TIME
        // ====================================

        const now =
            Date.now();

        // ====================================
        // FIRST HEARTBEAT
        // ====================================

        if (
            session.firstHeartbeat === null
        ) {

            console.log(
                "🔥 FIRST HEARTBEAT"
            );

            updateSession(
                sessionId,
                {
                    firstHeartbeat: now,
                    lastHeartbeat: now
                }
            );
        }

        // ====================================
        // NORMAL HEARTBEAT
        // ====================================

        else {

            updateSession(
                sessionId,
                {
                    lastHeartbeat: now
                }
            );
        }

        console.log(
            "✅ HEARTBEAT UPDATED:",
            sessionId
        );

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({
            success: true
        });

    } catch (err) {

        console.log(
            "❌ HEARTBEAT ERROR:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;