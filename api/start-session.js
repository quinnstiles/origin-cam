import express from "express";
import crypto from "crypto";

import { supabase } from "../lib/supabase.js";

import {
    createSession
} from "../lib/session-store.js";

const router = express.Router();

// ========================================
// START SESSION
// ========================================

router.post("/", async (req, res) => {

    try {

        console.log(
            "🔥 START SESSION HIT"
        );

        const { token } = req.body || {};

        // ====================================
        // VALIDATE TOKEN
        // ====================================

        if (!token) {

            console.log(
                "❌ Missing token"
            );

            return res.status(400).json({
                success: false,
                message: "Missing token"
            });
        }

        // ====================================
        // DECODE TOKEN
        // ====================================

        let payload;

        try {

            payload = JSON.parse(
                Buffer
                    .from(
                        token.split(".")[1],
                        "base64"
                    )
                    .toString()
            );

        } catch {

            console.log(
                "❌ Token decode failed"
            );

            return res.status(400).json({
                success: false,
                message: "Invalid token"
            });
        }

        const userId = payload.sub;

        if (!userId) {

            console.log(
                "❌ Missing userId"
            );

            return res.status(400).json({
                success: false,
                message: "Invalid token payload"
            });
        }

        console.log(
            "👤 USER:",
            userId
        );

        // ====================================
        // GET USER
        // ====================================

        const {
            data: user,
            error
        } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();

        if (error || !user) {

            console.log(
                "❌ User not found"
            );

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // ====================================
        // VALIDATE TIME
        // ====================================

        if (
            user.remaining_seconds <= 0
        ) {

            console.log(
                "❌ No remaining time"
            );

            return res.status(400).json({
                success: false,
                message: "No remaining time"
            });
        }

        // ====================================
        // CREATE SESSION
        // ====================================

        const sessionId =
            crypto.randomUUID();

        const now =
            Date.now();

        const graceSeconds =
            Number(
                process.env
                    .SESSION_GRACE_SECONDS
            );

        if (
            Number.isNaN(graceSeconds)
        ) {

            throw new Error(
                "Invalid SESSION_GRACE_SECONDS"
            );
        }

        createSession(
            sessionId,
            {
                sessionId,
                userId,

                startTime: now,

                firstHeartbeat: null,
                lastHeartbeat: null,

                remainingSeconds:
                    user.remaining_seconds,

                graceSeconds,

                isEnding: false,
                isActive: true
            }
        );

        console.log(
            "✅ SESSION CREATED:",
            sessionId
        );

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({
            success: true,

            sessionId,

            remainingSeconds:
                user.remaining_seconds
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