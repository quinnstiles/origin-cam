import express from "express";
import { supabase } from "../lib/supabase.js";
import { getUserSession } from "../lib/session-store.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        // ====================================
        // SECURE TOKEN EXTRACTION & VALIDATION
        // ====================================
        let token = null;
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.body.token) {
            token = req.body.token;
        }

        if (!token) {
            return res.status(401).json({ success: false, message: "Missing tracking credentials" });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ success: false, message: "Session authorization expired" });
        }

        const userId = user.id;

        // Pull active session memory block
        const session = getUserSession(userId);
        if (!session) {
            console.log(`⏰ Heartbeat hit for user ${userId}, but session memory block is dead. Telling Node to drop connection.`);
            return res.status(404).json({ success: false, message: "No active session found. Stop streaming." });
        }

        // Refresh authoritative internal timestamp tracking loop
        session.lastHeartbeat = Date.now();

        return res.json({ success: true });
    } catch (err) {
        // Drop network error responses silently to keep log streams clean from polling loops
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;