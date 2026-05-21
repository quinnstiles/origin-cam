import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession, getSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🚀 AUTHORITATIVE START SESSION HIT");

        // 🛠️ EXTRACT: Grab both the token and the proxy forwarded duration limit
        const { token, duration_limit_sec } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: "Missing token" });
        }

        // ====================================
        // 1. AUTHENTICATE USER WITH SUPABASE JWT
        // ====================================
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log("❌ Token authentication rejected:", authError?.message);
            return res.status(401).json({ success: false, message: "Unauthorized token" });
        }
        const userId = user.id;

        // ====================================
        // 2. AUTHORITATIVE SESSION CONFLICT CHECK (SERIALIZED CLEANUP)
        // ====================================
        const existingSession = getUserSession(userId);

        if (existingSession) {
            const now = Date.now();
            const totalAllowedDuration = (existingSession.dbSeconds + existingSession.graceSeconds) * 1000;
            const absoluteExpirationTime = existingSession.createdAt + totalAllowedDuration;

            if (now < absoluteExpirationTime) {
                console.log(`🔄 Active session ${existingSession.sessionId} interrupted by new start request. Force-finalizing sequentially.`);
                await finalizeSession(existingSession.sessionId, "manual");
            } else {
                console.log(`🧹 Stale session ${existingSession.sessionId} found during startup. Auto-finalizing.`);
                await finalizeSession(existingSession.sessionId, "timeout");
            }
        }

        // ====================================
        // 3. FETCH & VERIFY BALANCE FROM DATABASE
        // ====================================
        const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        if (dbError || !dbUser) {
            console.log("❌ Database balance lookup failed:", dbError?.message);
            return res.status(500).json({ success: false, message: "Could not fetch user billing data" });
        }

        const dbSeconds = Number(dbUser.remaining_seconds || 0);
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

        // 🚨 STRUCTURAL GUARDRAIL: Decart requires a minimum ceiling of 10s. Block sub-10 second requests.
        if (dbSeconds < 10) {
            console.log(`❌ Denied user ${userId}: Insufficient balance for initialization (${dbSeconds}s available). Minimum required is 10s.`);
            return res.status(403).json({
                success: false,
                message: `Insufficient balance. A minimum of 10 seconds is required to initialize a stream. You have ${dbSeconds}s.`
            });
        }

        // Use proxy duration parameter as secondary mapping, default back directly to dbSeconds balance
        const targetedDurationCeiling = duration_limit_sec ? Number(duration_limit_sec) : dbSeconds;

        // ====================================
        // 4. REQUEST DECART CLIENT TOKEN
        // ====================================
        // We now pack the constraint properties directly into the transient JWT configuration
        const decartResponse = await fetch("https://api.decart.ai/v1/client/tokens", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.DECART_API_KEY
            },
            body: JSON.stringify({
                expiresIn: Math.max(300, targetedDurationCeiling),
                allowedModels: ["lucy-2"],
                constraints: {
                    realtime: {
                        // 🌟 FIX: Decart will bake this value into the token. 
                        // Once this exact duration hits, Decart's WebRTC container shuts down automatically.
                        maxSessionDuration: targetedDurationCeiling
                    }
                }
            })
        });

        const decartJson = await decartResponse.json();
        if (!decartResponse.ok || !decartJson?.apiKey) {
            console.log("❌ Decart token generation failed:", decartJson);
            return res.status(500).json({ success: false, message: "Failed creating Decart token" });
        }

        // ====================================
        // 5. MEMORY STATE REGISTRATION
        // ====================================
        const sessionId = `session_${Date.now()}`;

        const newSession = {
            sessionId,
            userId,
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
            dbSeconds,
            graceSeconds
        };

        createSession(newSession);

        // ====================================
        // 6. AUTHORITATIVE TIMEOUT (SELF-AWARE SAFETY NET)
        // ====================================
        const serverTimeoutDuration = (dbSeconds + graceSeconds) * 1000;

        setTimeout(async () => {
            try {
                const verifySession = getSession(sessionId);

                if (!verifySession) {
                    console.log(`⏰ Safety timer woke up for ${sessionId}, but it was already closed. Ignoring task.`);
                    return;
                }

                console.log(`⏰ Server absolute cutoff limit reached for active session: ${sessionId}`);
                await finalizeSession(sessionId, "timeout", false);
            } catch (timeoutErr) {
                console.log(`❌ ERROR INSIDE TIMEOUT HANDLER FOR ${sessionId}:`, timeoutErr.message);
            }
        }, serverTimeoutDuration);

        // ====================================
        // 7. RETURN TO BACKUP BRIDGE.JS EXPLICIT LAYOUT
        // ====================================
        console.log(`✅ Session ${sessionId} generated successfully with dynamic maxSessionDuration restriction of ${targetedDurationCeiling}s.`);

        return res.json({
            success: true,
            sessionId: sessionId,
            decartToken: decartJson.apiKey,
            remainingSeconds: dbSeconds
        });

    } catch (err) {
        console.log("❌ START SESSION ERROR:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

export default router;