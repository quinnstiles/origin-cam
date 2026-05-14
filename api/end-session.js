import express from "express";
import { endSession } from "../lib/sessionStore.js";

const router = express.Router();

router.post("/", async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false
        });
    }

    const session = endSession(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false
        });
    }

    console.log("💰 BILLING:", {
        userId: session.userId,
        seconds: session.billedSeconds
    });

    return res.json({
        success: true,
        billedSeconds: session.billedSeconds
    });
});

export default router;