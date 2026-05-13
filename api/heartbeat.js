import express from "express";
import { updateHeartbeat, isAlive, getSession } from "../lib/sessions.js";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        const { sessionId, token } = req.body;

        if (!sessionId || !token) {
            return res.json({ success: false });
        }

        const session = getSession(sessionId);

        if (!session) {
            return res.json({
                success: false,
                reason: "session_not_found"
            });
        }

        // =====================================
        // UPDATE HEARTBEAT TIME
        // =====================================

        updateHeartbeat(sessionId);

        // =====================================
        // CHECK IF SESSION IS STILL VALID
        // =====================================

        const alive = isAlive(sessionId);

        if (!alive) {
            return res.json({
                success: false,
                reason: "session_timeout"
            });
        }

        return res.json({
            success: true,
            status: "alive"
        });

    } catch (err) {

        console.log("HEARTBEAT ERROR:", err);

        return res.json({
            success: false
        });
    }
});

export default router;