import express from "express";
import { createSession, getAllSessions } from "../lib/session-store.js";
import { supabase } from "../lib/supabase.js";
import {
    startSessionTimeout
} from "../lib/session-monitor.js";

import {
    finalizeSession
} from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Missing auth token"
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
        // GRACE TIME (SAFE + CONFIG)
        // ====================================
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS);

        // total session window (informational only)
        const sessionDuration = dbSeconds + graceSeconds;

        // ====================================
        // CREATE SESSION
        // ====================================
        const sessionId = `session_${Date.now()}`;

        const sessions = Array.from(getAllSessions().values());

        const active = sessions.find(
            s => s.userId === userId && !s.isEnding
        );

        if (active) {
            return res.status(409).json({
                success: false,
                message: "Session already running"
            });
        }

        createSession(sessionId, {
            sessionId,
            userId,
            dbSeconds,
            graceSeconds,
            sessionDuration,
            createdAt: Date.now(),
            isEnding: false
        });

        console.log("💾 SESSION CREATED:", sessionId);

        startSessionTimeout(
            sessionId,
            sessionDuration * 1000,
            async () => {

                console.log(
                    "🛑 AUTO END:",
                    sessionId
                );

                await finalizeSession(
                    sessionId,
                    true
                );
            }
        );

        // ====================================
        // CREATE DE CART CLIENT TOKEN
        // ====================================

        const decartApiKey = process.env.DECART_API_KEY;

        const decartResponse = await fetch(
            "https://api.decart.ai/v1/client/tokens",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",

                    // IMPORTANT:
                    // correct auth header

                    "x-api-key": decartApiKey
                },

                body: JSON.stringify({

                    // short token lifetime
                    expiresIn: 60,

                    // allowed realtime models
                    allowedModels: [
                        "lucy-2"
                    ],

                    // IMPORTANT:
                    // hard realtime session limit

                    constraints: {
                        realtime: {
                            maxSessionDuration:
                                sessionDuration
                        }
                    }
                })
            }
        );

        const decartJson =
            await decartResponse.json();

        console.log(
            "🧠 DE CART TOKEN RESPONSE:",
            decartJson
        );

        const decartToken =
            decartJson?.apiKey;

        if (!decartResponse.ok) {
            return res.status(500).json({
                success: false,
                message: "Decart token request failed"
            });
        }

        if (!decartToken) {

            return res.status(500).json({
                success: false,
                message:
                    "Failed creating Decart token"
            });
        }
        // ====================================
        // RESPONSE
        // ====================================
        return res.json({
            success: true,
            sessionId,
            sessionDuration,
            decartToken: decartToken
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