import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession } from "../lib/session-store.js";
import { closeSession } from "../lib/session-manager.js";

const router = express.Router();

// Global tracking object for session startup timeouts if not already initialized
if (!global.startupTimers) {
    global.startupTimers = new Map();
}

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

        const dbSeconds = profile.remaining_seconds;

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
        const now = Date.now();

        // 5. REGISTER SESSION ENTRY (Set isLive to false initially until Node checks in)
        const newSession = {
            sessionId: sessionId,
            userId: userId,
            decartToken: decartJson.apiKey,
            dbSeconds: dbSeconds,
            createdAt: now,
            isLive: false, // 🌟 False until the node reports first frame activity
            isEnding: false,
            lastHeartbeat: now,
            lastStreamPulse: now
        };

        createSession(newSession);

        // 6. ARM THE 15-SECOND STARTUP BOMB TIMER
        const timeoutId = setTimeout(async () => {
            console.log(`🚨 BOMB TIMER FIRED: Session ${sessionId} failed to activate within 15s. Force terminating...`);
            global.startupTimers.delete(sessionId);
            await closeSession(sessionId, "startup_timeout");
        }, 15000);

        global.startupTimers.set(sessionId, timeoutId);

        console.log(`✅ Session ${sessionId} generated safely. 15-second startup timer armed.`);

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