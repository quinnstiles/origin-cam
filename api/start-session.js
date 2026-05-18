import express from "express";
import { supabase } from "../lib/supabase.js";
import {
    createSession,
    clearUserSession
} from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

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
        // CHECK EXISTING SESSION (CLEAN STALE FIRST)
        // ====================================
        const existing = getUserSession(userId);

        if (existing) {

            const now = Date.now();

            // safety fallback: if expired but still in memory → force cleanup
            if (now >= existing.expiresAt) {
                console.log("🧹 CLEANING STALE SESSION:", existing.sessionId);

                await finalizeSession(existing.sessionId, "auto-cleanup");

                deleteSession(existing.sessionId);
            } else {
                return res.status(409).json({
                    success: false,
                    message: "Session already running"
                });
            }
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

        // ====================================
        // GRACE TIME (SERVER ONLY - NOT DECART)
        // ====================================
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 0);

        const createdAt = Date.now();

        const sessionDuration = dbSeconds + graceSeconds;

        const expiresAt =
            createdAt + sessionDuration * 1000;

        const sessionId = `session_${createdAt}`;

        // ====================================
        // CREATE SESSION (SOURCE OF TRUTH)
        // ====================================
        const session = {
            sessionId,
            userId,

            dbSeconds,
            graceSeconds,

            sessionDuration,
            createdAt,
            expiresAt,

            isEnding: false
        };

        createSession(session);

        console.log("💾 SESSION CREATED:", sessionId);

        // ====================================
        // HARD TIMEOUT (GUARANTEED CLEANUP)
        // ====================================
        const timeoutMs = Math.max(0, expiresAt - Date.now());

        setTimeout(() => {
            finalizeSession(sessionId, "timeout");
        }, timeoutMs);

        // ====================================
        // DECART TOKEN (DB TIME ONLY)
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
                            maxSessionDuration: dbSeconds
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

        // ====================================
        // RESPONSE
        // ====================================
        return res.json({
            success: true,
            sessionId,
            sessionDuration: dbSeconds,
            graceSeconds,
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