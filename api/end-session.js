import express from "express";

import {
    getSession,
    closeSession
} from "../lib/session-store.js";

import {
    clearSessionTimeout
} from "../lib/session-monitor.js";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        console.log(
            "🛑 END SESSION HIT"
        );

        const { sessionId } =
            req.body;

        if (!sessionId) {

            return res.status(400).json({
                success: false,
                message: "Missing sessionId"
            });
        }

        const session =
            getSession(sessionId);

        if (!session) {

            return res.json({
                success: true,
                message: "Already closed"
            });
        }

        session.closed = true;

        clearSessionTimeout(
            sessionId
        );

        removeSession(
            sessionId
        );

        return res.json({
            success: true
        });

    }
    catch (err) {

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