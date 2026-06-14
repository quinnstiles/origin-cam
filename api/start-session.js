import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession } from "../lib/session-store.js";
import { closeSession } from "../lib/session-manager.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🚀 AUTHORITATIVE START SESSION HIT");

        const { token, duration_limit_sec } = req.body;
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

        // 3. PULL ACCOUNT BALANCES SECURELY FROM THE DB Snapshot
        const { data: profile, error: dbError } = await supabase
            .from("users")
            .select("remaining_seconds, grace_seconds")
            .eq("id", userId)
            .single();

        if (dbError || !profile) {
            return res.json({ success: "false", message: "Failed resolving core account limits." });
        }

        const dbSeconds = profile.remaining_seconds;
        const graceSeconds = profile.grace_seconds || 0;

        if (dbSeconds <= 0) {
            return res.json({ success: "false", message: "Insufficient account balance remaining." });
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
                duration_limit_sec: Math.min(dbSeconds, duration_limit_sec || 3600)
            })
        });

        if (!decartRes.ok) {
            const errTxt = await decartRes.text();
            throw new Error(`Upstream allocation failure: ${errTxt}`);
        }

        const decartJson = await decartRes.json();

        // 5. REGISTER SESSION ENTRY TO IN-MEMORY STORAGE STORE
        const newSession = {
            sessionId: sessionId,
            userId: userId,
            decartToken: decartJson.apiKey,
            dbSeconds: dbSeconds,
            graceSeconds: graceSeconds,
            createdAt: Date.now(),
            isLive: false,
            isEnding: false,
            lastStreamPulse: Date.now() // 🌟 Monitored directly by cloud data loops
        };

        createSession(newSession);
        console.log(`✅ Pending Session ${sessionId} generated safely.`);

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