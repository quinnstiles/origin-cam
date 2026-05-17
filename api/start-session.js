import express from "express";
import { supabase } from "../lib/supabase.js";
import {
    createSession,
    getUserSession,
    clearUserSession
} from "../lib/session-store.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {

        console.log("🟢 START SESSION HIT");

        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Missing token"
            });
        }

        // ====================================
        // DECODE USER ID
        // ====================================
        let userId;

        try {
            const payload = JSON.parse(
                Buffer.from(token.split(".")[1], "base64").toString()
            );

            userId = payload.sub;
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid token"
            });
        }

        // ====================================
        // GET USER TIME
        // ====================================
        const { data: user, error } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        if (error || !user) {
            return res.status(500).json({
                success: false,
                message: "User fetch failed"
            });
        }

        const dbSeconds = user.remaining_seconds || 0;

        if (dbSeconds <= 0) {
            return res.status(403).json({
                success: false,
                message: "No time left"
            });
        }

        const sessionDuration = dbSeconds + 5; // grace

        const sessionId = `session_${Date.now()}`;

        // ====================================
        // 🔥 FORCE CLEAR OLD SESSION (IMPORTANT)
        // ====================================
        clearUserSession(userId);

        console.log("🧹 OLD SESSION CLEARED (if existed)");

        // ====================================
        // CREATE NEW SESSION
        // ====================================
        const session = {
            sessionId,
            userId,
            dbSeconds,
            sessionDuration,
            createdAt: Date.now(),
            isEnding: false
        };

        createSession(session);

        console.log("💾 SESSION CREATED:", sessionId);

        // ====================================
        // DECART TOKEN
        // ====================================
        const decartResponse = await fetch(
            "https://api.decart.ai/v1/client/tokens",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.DECART_API_KEY
                },
                body: JSON.stringify({
                    expiresIn: 60,
                    allowedModels: ["lucy-2"],
                    constraints: {
                        realtime: {
                            maxSessionDuration: sessionDuration
                        }
                    }
                })
            }
        );

        const decartJson = await decartResponse.json();

        if (!decartResponse.ok || !decartJson?.apiKey) {
            return res.status(500).json({
                success: false,
                message: "Decart token failed"
            });
        }

        console.log("🧠 DE CART TOKEN READY");

        return res.json({
            success: true,
            sessionId,
            sessionDuration,
            decartToken: decartJson.apiKey
        });

    } catch (err) {
        console.log("❌ START ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;