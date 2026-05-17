import express from "express";
import { createSession, getUserSession } from "../lib/session-store.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🟢 START SESSION HIT");

        const { token } = req.body;

        // ❌ MUST HAVE TOKEN
        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Missing token"
            });
        }

        // ====================================
        // DECODE USER
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

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Missing userId"
            });
        }

        // ====================================
        // SIMPLE SESSION CHECK
        // ====================================
        const existing = getUserSession(userId);

        if (existing) {
            console.log("⚠️ USER HAS ACTIVE SESSION");
            return res.status(409).json({
                success: false,
                message: "Session already running"
            });
        }

        // ====================================
        // MINIMAL SESSION DATA
        // ====================================
        const sessionId = `session_${Date.now()}`;

        const session = {
            sessionId,
            userId,
            createdAt: Date.now(),
            closed: false
        };

        createSession(session);

        console.log("💾 SESSION CREATED:", sessionId);

        // ====================================
        // DE CART TOKEN (ONLY WHAT WE NEED)
        // ====================================
        const decartApiKey = process.env.DECART_API_KEY;

        if (!decartApiKey) {
            return res.status(500).json({
                success: false,
                message: "Missing Decart key"
            });
        }

        const decartResponse = await fetch(
            "https://api.decart.ai/v1/client/tokens",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": decartApiKey
                },
                body: JSON.stringify({
                    expiresIn: 120,
                    allowedModels: ["lucy-2"]
                })
            }
        );

        const decartJson = await decartResponse.json();

        if (!decartResponse.ok || !decartJson.apiKey) {
            console.log("❌ DE CART ERROR:", decartJson);

            return res.status(500).json({
                success: false,
                message: "Failed to create Decart token"
            });
        }

        console.log("🧠 DE CART TOKEN READY");

        // ====================================
        // RESPONSE (CLEAN)
        // ====================================
        return res.json({
            success: true,
            sessionId,
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