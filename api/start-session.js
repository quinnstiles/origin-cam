import express from "express";

import {
    createSession,
    getUserSession
} from "../lib/session-store.js";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        console.log("🟢 START SESSION HIT");

        const { token } = req.body;

        // ====================================
        // TOKEN REQUIRED
        // ====================================

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
        // ACTIVE SESSION CHECK
        // ====================================

        const existingSession =
            getUserSession(userId);

        if (existingSession) {

            console.log(
                "⚠️ ACTIVE SESSION EXISTS"
            );

            return res.status(409).json({
                success: false,
                message: "Session already running"
            });
        }

        // ====================================
        // CREATE SESSION
        // ====================================

        const sessionId =
            `session_${Date.now()}`;

        createSession({

            sessionId,

            userId,

            createdAt: Date.now(),

            closed: false
        });

        console.log(
            "💾 SESSION CREATED:",
            sessionId
        );

        // ====================================
        // CREATE DE CART TOKEN
        // ====================================

        const decartApiKey =
            process.env.DECART_API_KEY;

        if (!decartApiKey) {

            return res.status(500).json({
                success: false,
                message:
                    "Missing DE CART key"
            });
        }

        const decartResponse =
            await fetch(
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

                        expiresIn: 120,

                        allowedModels: [
                            "lucy-2"
                        ]
                    })
                }
            );

        const decartJson =
            await decartResponse.json();

        console.log(
            "🧠 DE CART RESPONSE:",
            decartJson
        );

        if (
            !decartResponse.ok ||
            !decartJson.apiKey
        ) {

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

    }
    catch (err) {

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