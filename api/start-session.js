import express from "express";
import { supabase } from "../lib/supabase.js";

import {
    createSession,
    getUserSession,
    deleteSession
} from "../lib/session-store.js";

import {
    startSessionTimeout
} from "../lib/session-monitor.js";

import {
    finalizeSession
} from "../lib/finalizeSession.js";

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
        // DECODE USER
        // ====================================

        let userId = null;

        try {

            const payload = JSON.parse(
                Buffer
                    .from(
                        token.split(".")[1],
                        "base64"
                    )
                    .toString()
            );

            userId = payload.sub;

        } catch {

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
        // FORCE CLOSE EXISTING SESSION
        // ====================================

        const existingSession =
            getUserSession(userId);

        if (existingSession) {

            console.log(
                "⚠️ OVERRIDING OLD SESSION:",
                existingSession.sessionId
            );

            await finalizeSession(
                existingSession.sessionId,
                "override"
            );

            deleteSession(
                existingSession.sessionId
            );
        }

        // ====================================
        // GET USER TIME
        // ====================================

        const { data: user, error } =
            await supabase
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

        const dbSeconds =
            user.remaining_seconds || 0;

        if (dbSeconds <= 0) {

            return res.status(403).json({
                success: false,
                message: "No time left"
            });
        }

        // ====================================
        // TIME
        // ====================================

        const graceSeconds =
            Number(
                process.env
                    .SESSION_GRACE_SECONDS || 0
            );

        const sessionDuration =
            dbSeconds;

        const expiresAt =
            Date.now()
            + ((dbSeconds + graceSeconds) * 1000);

        // ====================================
        // SESSION
        // ====================================

        const sessionId =
            `session_${Date.now()}`;

        createSession({

            sessionId,
            userId,

            dbSeconds,
            graceSeconds,

            sessionDuration,

            createdAt: Date.now(),

            expiresAt,

            isEnding: false
        });

        console.log(
            "💾 SESSION CREATED:",
            sessionId
        );

        // ====================================
        // SERVER TIMEOUT
        // ====================================

        startSessionTimeout(

            sessionId,

            (dbSeconds + graceSeconds)
            * 1000,

            async () => {

                await finalizeSession(
                    sessionId,
                    "timeout"
                );
            }
        );

        // ====================================
        // DE CART TOKEN
        // ====================================

        const decartResponse =
            await fetch(
                "https://api.decart.ai/v1/client/tokens",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-api-key":
                            process.env
                                .DECART_API_KEY
                    },

                    body: JSON.stringify({

                        expiresIn: 60,

                        allowedModels: [
                            "lucy-2"
                        ],

                        constraints: {
                            realtime: {
                                maxSessionDuration:
                                    dbSeconds
                            }
                        }
                    })
                }
            );

        const decartJson =
            await decartResponse.json();

        if (
            !decartResponse.ok
            || !decartJson?.apiKey
        ) {

            return res.status(500).json({
                success: false,
                message:
                    "Decart token failed"
            });
        }

        console.log(
            "🧠 DE CART TOKEN READY"
        );

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({

            success: true,

            sessionId,

            sessionDuration,

            decartToken:
                decartJson.apiKey
        });

    } catch (err) {

        console.log(
            "❌ START ERROR:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;