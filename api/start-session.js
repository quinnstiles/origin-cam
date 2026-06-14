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

        // 3. PULL ACCOUNT BALANCES SECURELY FROM THE DB SCHEMA (Cleaned up grace_seconds)
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

        // 5. REGISTER SESSION ENTRY AS IMMEDIATELY LIVE (Decart token success triggered)
        const newSession = {
            sessionId: sessionId,
            userId: userId,
            decartToken: decartJson.apiKey,
            dbSeconds: dbSeconds,
            createdAt: now,
            isLive: true,           // Active immediately
            isEnding: false,
            lastHeartbeat: now,     // Satisfies background monitor dependencies
            lastStreamPulse: now
        };

        // 6. ESTABLISH THE MAXIMUM BALANCING CEILING TIMEOUT
        // Forces automatic server-side termination the millisecond the balance drains out
        const totalAllowedMs = dbSeconds * 1000;
        newSession.timeoutHandle = setTimeout(async () => {
            console.log(`🚨 RUNTIME EXPIRED: Session ${sessionId} reached its balance ceiling limit.`);
            await closeSession(sessionId, "timeout");
        }, totalAllowedMs);

        createSession(newSession);
        console.log(`✅ Live Session ${sessionId} generated and activated safely.`);

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