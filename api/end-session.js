import express from "express";
import { finalizeSession } from "../lib/finalizeSession.js";
// Import your token authentication middleware here as well

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { sessionId } = req.body;
        console.log(`🛑 END SESSION HIT FOR: ${sessionId}`);

        // 1. Run finalizer and grab the precise remaining seconds
        const remainingSeconds = await finalizeSession(sessionId, "manual");

        // 2. Send it back to Node
        return res.json({
            success: true,
            remainingSeconds: remainingSeconds // <-- Sending the raw balance integer
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;