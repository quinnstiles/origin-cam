import express from "express";
import { getSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js"; // Match exact file layout

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🛑 END SESSION HIT FROM NODE BRIDGE");
        const { sessionId } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Missing sessionId" });
        }

        const session = getSession(sessionId);

        // If the server-side auto fallback timeout already stripped it, simply return true safely
        if (!session) {
            return res.json({ success: true, message: "Session already resolved or expired" });
        }

        // Execute unified transactional routine 
        await finalizeSession(sessionId, "manual");

        return res.json({ success: true });
    } catch (err) {
        console.log("❌ END SESSION ROUTE ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;