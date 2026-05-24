import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession, clearUserSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🚀 AUTHORITATIVE START SESSION HIT");

        const { token, duration_limit_sec } = req.body;
        if (!token) {
            return res.json({ success: "false", message: "Missing authorization token." });
        }

        // ====================================
        // 1. AUTHENTICATE USER WITH SUPABASE JWT
        // ====================================
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log("❌ Token authentication rejected:", authError?.message);
            return res.json({ success: "false", message: "Unauthorized token status." });
        }
        const userId = user.id;

        // ====================================
        // 2. FORCE CLEAN SLATE (NO MORE HANGING AWAITS)
        // ====================================
        const existingSession = getUserSession(userId);

        if (existingSession) {
            console.log(`⚠️ Conflict detected for user ${userId}. Active session ID: ${existingSession.sessionId}`);

            finalizeSession(existingSession.sessionId, "manual", false)
                .then(() => console.log(`🔄 Background auto-cleanup of ${existingSession.sessionId} finished.`))
                .catch(err => console.log(`⚠️ Background cleanup notice:`, err.message));

            clearUserSession(userId);
        }

        // ====================================
        // 3. FETCH & VERIFY BALANCE FROM DATABASE
        // ====================================
        const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("remaining_seconds, status")
            .eq("id", userId)
            .single();

        if (dbError || !dbUser) {
            console.log("❌ Database balance lookup failed:", dbError?.message);
            return res.json({ success: "false", message: "Could not fetch user billing data." });
        }

        // Verify account restriction status gates cleanly
        if (dbUser.status !== true && dbUser.status !== "true") {
            console.log(`🚫 Denied restricted account execution for user ${userId}`);
            return res.json({ success: "false", message: "Account restriction active. Access denied." });
        }

        const dbSeconds = Number(dbUser.remaining_seconds || 0);
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

        // Minimum 10-Second Balance Gate Check
        if (dbSeconds <= 10) {
            console.log(`❌ Denied user ${userId}: Insufficient balance (${dbSeconds}s available).`);
            return res.json({
                success: "false",
                message: `Cannot start session. A minimum of 11 seconds is required to initialize Origin-Cam AI.`
            });
        }

        const targetedDurationCeiling = duration_limit_sec ? Number(duration_limit_sec) : dbSeconds;

        // ====================================
        // 4. REQUEST DECART CLIENT TOKEN
        // ====================================
        if (!process.env.DECART_API_KEY) {
            console.log("❌ CONFIG ERROR: Missing DECART_API_KEY.");
            return res.json({ success: "false", message: "Infrastructure token configuration error." });
        }

        console.log(`🧠 Requesting Decart token with dynamic duration: ${targetedDurationCeiling}s`);

        let decartJson;
        try {
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
                            maxSessionDuration: targetedDurationCeiling
                        }
                    }
                })
            });

            decartJson = await decartResponse.json();

            if (!decartResponse.ok || !decartJson?.apiKey) {
                console.log("❌ Decart token generation rejected:", decartJson);
                return res.json({ success: "false", message: "AI stream authorization rejected by host provider." });
            }
        } catch (fetchErr) {
            console.log("❌ DECART NETWORK FAILURE:", fetchErr.message);
            return res.json({ success: "false", message: "Network connection timeout to stream cluster broker." });
        }

        // ====================================
        // 5. MEMORY STATE REGISTRATION
        // ====================================
        const sessionId = `session_${Date.now()}`;

        const newSession = {
            sessionId: sessionId,
            userId: userId,
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
            dbSeconds: dbSeconds,
            graceSeconds: graceSeconds,
            timeoutHandle: null
        };

        const totalAllowedMs = (newSession.dbSeconds + newSession.graceSeconds) * 1000;

        newSession.timeoutHandle = setTimeout(async () => {
            console.log(`🚨 CRASH DETECTED: Session ${newSession.sessionId} went dark for ${newSession.dbSeconds}s.`);
            await finalizeSession(newSession.sessionId, "timeout", false);
        }, totalAllowedMs);

        createSession(newSession);

        // ====================================
        // 6. RETURN TO BRIDGE
        // ====================================
        console.log(`✅ Session ${sessionId} generated successfully.`);

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