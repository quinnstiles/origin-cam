import express from "express";
import { createSession } from "../lib/session-store.js";
import { supabase } from "../lib/supabase.js";

const router = express.Router();

// ========================================
// START SESSION
// ========================================
router.post("/", async (req, res) => {
    try {
        const { token } = req.body;

        // ====================================
        // VALIDATE TOKEN
        // ====================================
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Missing auth token"
            });
        }

        // ====================================
        // DECODE USER ID FROM TOKEN
        // ====================================
        let userId;

        try {
            const payload = JSON.parse(
                Buffer.from(token.split(".")[1], "base64").toString()
            );

            userId = payload.sub;
        } catch (err) {
            return res.status(400).json({
                success: false,
                message: "Invalid token"
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Missing userId"
            });
        }

        // ====================================
        // GET USER TIME FROM DATABASE
        // ====================================
        const { data: user, error } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        if (error || !user) {
            return res.status(500).json({
                success: false,
                message: "Failed to fetch user time"
            });
        }

        const dbSeconds = user.remaining_seconds;

        if (dbSeconds <= 0) {
            return res.status(403).json({
                success: false,
                message: "No remaining time"
            });
        }

        // ====================================
        // GRACE TIME (CONFIG SAFE)
        // ====================================
        const GRACE_SECONDS = 10;
        const sessionDuration = dbSeconds + GRACE_SECONDS;

        // ====================================
        // CREATE SESSION ID
        // ====================================
        const sessionId = `session_${Date.now()}`;

        // ====================================
        // STORE SESSION IN MEMORY
        // ====================================
        createSession(sessionId, {
            sessionId,
            userId,
            dbSeconds,
            graceSeconds: GRACE_SECONDS,
            sessionDuration,
            createdAt: Date.now(),
            isEnding: false
        });

        console.log("💾 SESSION CREATED:", sessionId);

        // ====================================
        // GET DE CART KEY
        // ====================================
        const decartApiKey = process.env.DECART_API_KEY;

        if (!decartApiKey) {
            return res.status(500).json({
                success: false,
                message: "Missing DECart API key"
            });
        }

        // ====================================
        // RESPONSE (MINIMAL + STABLE)
        // ====================================
        return res.json({
            success: true,
            sessionId,
            decartToken: decartApiKey
        });

    } catch (err) {
        console.log("START SESSION ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

export default router;