import express from "express";

import {
    createSession,
    getUserSession
} from "../lib/session-store.js";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        console.log("🟢 START SESSION HIT");

        // ====================================
        // GET TOKEN
        // ====================================

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
        // DUPLICATE SESSION CHECK
        // ====================================

        const existingSession =
            getUserSession(userId);

        if (existingSession) {

            console.log(
                "⚠️ USER ALREADY ACTIVE"
            );

            return res.status(409).json({
                success: false,
                message: "Session already running"
            });
        }

        // ====================================
        // SESSION CONFIG
        // ====================================

        const dbSeconds = 60;

        const graceSeconds = 5;

        const sessionDuration =
            dbSeconds + graceSeconds;

        const sessionId =
            `session_${Date.now()}`;

        // ====================================
        // STORE SESSION
        // ====================================

        createSession({

            sessionId,
            userId,
            closed: false
        });

        console.log(
            "💾 SESSION STORED:",
            sessionId
        );

        // ====================================
        // DE CART API KEY
        // ====================================

        const decartApiKey =
            process.env.DECART_API_KEY;

        if (!decartApiKey) {

            return res.status(500).json({
                success: false,
                message: "Missing DE CART key"
            });
        }

        // ====================================
        // CREATE CLIENT TOKEN
        // ====================================

        const decartResponse = await fetch(
            "https://api.decart.ai/v1/client/tokens",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "x-api-key":
                        decartApiKey
                },

                body: JSON.stringify({

                    expiresIn: 60,

                    allowedModels: [
                        "lucy-2"
                    ],

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
            "🧠 DE CART RESPONSE:",
            decartJson
        );

        if (!decartResponse.ok) {

            return res.status(500).json({
                success: false,
                message:
                    "Failed creating DE CART token"
            });
        }

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({

            success: true,

            sessionId,

            decartToken:
                decartJson.apiKey
        });

    } catch (err) {

        console.log(
            "❌ START SESSION ERROR:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;