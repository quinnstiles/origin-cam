import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession, clearUserSession, deleteSession } from "../lib/session-store.js";
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

        if (dbUser.status !== true && dbUser.status !== "true") {
            console.log(`🚫 Denied restricted account execution for user ${userId}`);
            return res.json({ success: "false", message: "Account restriction active. Access denied." });
        }

        const dbSeconds = Number(dbUser.remaining_seconds || 0);
        const graceSeconds = Number(process.env.SESSION_GRACE_SECONDS || 5);

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

        const decartSafeDuration = Math.min(3600, targetedDurationCeiling);

        console.log(`🧠 Requesting Decart token with dynamic duration: ${decartSafeDuration}s (Original Ceiling: ${targetedDurationCeiling}s)`);

        let decartJson;
        try {
            const decartResponse = await fetch("https://api.decart.ai/v1/client/tokens", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": process.env.DECART_API_KEY
                },
                body: JSON.stringify({
                    expiresIn: Math.max(300, decartSafeDuration),
                    allowedModels: ["lucy-2"],
                    constraints: {
                        realtime: {
                            maxSessionDuration: decartSafeDuration
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
            decartToken: decartJson.apiKey, // Save the token here so we can revoke it if needed
            isLive: false,                  // Set to false initially. Starts at $0 billable.
            createdAt: null,                // Handled dynamically when streaming actually starts
            lastHeartbeat: Date.now(),
            dbSeconds: dbSeconds,
            graceSeconds: graceSeconds,
            timeoutHandle: null
        };

        // 🛑 INITIAL HANDSHAKE SAFETY TIMEOUT:
        // If Decart does not hit our webhook/heartbeat within 15 seconds, cancel everything safely.
        newSession.timeoutHandle = setTimeout(async () => {
            const currentSession = getUserSession(userId);
            if (currentSession && !currentSession.isLive) {
                console.log(`🚨 HANDSHAKE TIMEOUT: Session ${sessionId} failed to connect within 15s. Invalidating token.`);

                // Opt out of Decart infrastructure immediately via their token endpoint
                try {
                    await fetch(`https://api.decart.ai/v1/client/tokens/${currentSession.decartToken}`, {
                        method: "DELETE",
                        headers: { "x-api-key": process.env.DECART_API_KEY }
                    });
                } catch (err) {
                    console.log("⚠️ Error notifying Decart of token termination:", err.message);
                }

                deleteSession(sessionId);
            }
        }, 15000);

        createSession(newSession);

        // ====================================
        // 6. RETURN TO BRIDGE
        // ====================================
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