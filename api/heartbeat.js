import express from "express";
import { getUserSession } from "../lib/session-store.js";

const router = express.Router();

router.post("/", (req, res) => {
    const userId = req.user.id; // Secure identity extraction

    const session = getUserSession(userId);
    if (!session) {
        return res.status(404).json({ success: false, message: "No active session found. Stop streaming." });
    }

    // Refresh ping timestamp
    session.lastHeartbeat = Date.now();
    return res.json({ success: true });
});

export default router;