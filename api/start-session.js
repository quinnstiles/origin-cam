import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession } from "../lib/session-store.js";
import { closeSession } from "../lib/session-manager.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🚀 AUTHORITATIVE START SESSION HIT");

        const { token } = req.body;
        if (!token) {
            return res.json({ success: "false", message: "Missing authorization token." });
        }

        // 1. AUTHENTICATE USER WITH SUPABASE JWT
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            console.log("❌ Token authentication rejected:", authError?.message);
            return res.json({ success: "false", message: "Unauthorized token status." });
        }
        const userId = user.id;

        // 2. FORCE CLEAN SLATE (TEARDOWN PREVIOUS OVERLAPPING SESSIONS)
        const existingSession = getUserSession(userId);
        if (existingSession) {
            console.log(`⚠️ Conflict detected for user ${userId}. Active session ID: ${existingSession.sessionId}`);
            await closeSession(existingSession.sessionId, "manual");
        }

        // 3. PULL ACCOUNT BALANCES SECURELY FROM THE DB SCHEMA
        const { data: profile, error: dbError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        if (dbError || !profile) {
            console.log("❌ DB Query failed:", dbError?.message);
            return res.json({ success: "false", message: "Failed resolving core account limits." });
        }

        const dbSeconds = profile ? profile.remaining_seconds : 0;
        console.log(`💳 User Account Balance Retrieved: ${dbSeconds}s`);

        if (dbSeconds < 11) {
            console.log(`❌ [START DENIED] User ${userId} has insufficient balance: ${dbSeconds}s. Minimum 11s required.`);
            return res.json({
                success: "false",
                message: "Insufficient balance. You need at least 11 seconds remaining to start a session."
            });
        }

        const sessionId = "session_" + Date.now();

        // 4. PROVISION UPSTREAM INFRASTRUCTURE TICKETS (DECART)
        const decartRes = await fetch("https://api.decart.ai/v1/client/tokens", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.DECART_API_KEY
            },
            body: JSON.stringify({
                expiresIn: 300, // Token can be used to connect within 5 minutes
                constraints: {
                    realtime: {
                        maxSessionDuration: dbSeconds // 🌟 THIS IS THE OFFICIAL DECART FIELD (Minimum 10)
                    }
                }
            })
        });

        if (!decartRes.ok) {
            const errTxt = await decartRes.text();
            throw new Error(`Upstream allocation failure: ${errTxt}`);
        }

        const decartJson = await decartRes.json();
        const now = Date.now();

        // 5. REGISTER SESSION ENTRY 
        const newSession = {
            sessionId: sessionId,
            userId: userId,
            decartToken: decartJson.apiKey, // Keep this! Your local bridge needs it to connect.
            dbSeconds: dbSeconds,
            createdAt: now,
            isLive: false,
            isEnding: false,
            lastHeartbeat: now,
            lastStreamPulse: now
        };

        createSession(newSession);
        console.log(`✅ Session ${sessionId} provisioned. Awaiting activation frame...`);

        return res.json({
            success: "true",
            sessionId: sessionId,
            decartToken: decartJson.apiKey,
            remainingSeconds: dbSeconds
        });

    } catch (err) {
        console.log("❌ START SESSION ERROR:", err.message);
        return res.json({ success: "false", message: err.message });
    }
});

export default router;