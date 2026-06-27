import express from "express";
import { supabase } from "../lib/supabase.js";
import { createSession, getUserSession } from "../lib/session-store.js";
import { finalizeSession } from "../lib/finalizeSession.js";

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

        // 2. CONCURRENCY CONTROL: CHECK LOCAL MEMORY CACHE
        const existingLocalSession = getUserSession(userId);
        if (existingLocalSession) {
            console.log(`⚠️ Conflict detected in local cache for user ${userId}. Active local session ID: ${existingLocalSession.sessionId}`);
            await finalizeSession(existingLocalSession.sessionId, "manual", false);
        }

        // 3. SECURE CROSS-MACHINE GUARD: PULL PROFILE AND CHECK FOR OUT-OF-SYNC REMOTE SESSIONS
        const { data: profile, error: dbError } = await supabase
            .from("users")
            .select("remaining_seconds, active_session_id")
            .eq("id", userId)
            .single();

        if (dbError || !profile) {
            console.log("❌ DB Query failed:", dbError?.message);
            return res.json({ success: "false", message: "Failed resolving core account limits." });
        }

        // If a session was left unfinalized on another machine, run an authoritative finalization on it first
        if (profile.active_session_id && (!existingLocalSession || existingLocalSession.sessionId !== profile.active_session_id)) {
            console.log(`🛡️ [CROSS-MACHINE GUARD] Found unfinalized remote session ${profile.active_session_id} on database layout. Clearing...`);

            await finalizeSession(profile.active_session_id, "forced-cleanup", false);

            // Re-fetch clean wallet variables after finalization settlement
            const { data: refreshedProfile } = await supabase
                .from("users")
                .select("remaining_seconds")
                .eq("id", userId)
                .single();

            profile.remaining_seconds = refreshedProfile?.remaining_seconds || 0;
        }

        let dbSeconds = profile.remaining_seconds || 0;
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
                expiresIn: 300,
                constraints: {
                    realtime: {
                        maxSessionDuration: dbSeconds
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

        // 5. ATOMIC STATE SYNC TO SUPABASE
        const { error: stateUpdateError } = await supabase
            .from("users")
            .update({
                active_session_id: sessionId,
                session_is_live: false
            })
            .eq("id", userId);

        if (stateUpdateError) {
            throw new Error(`Failed to commit new active session tracking metadata to Supabase: ${stateUpdateError.message}`);
        }

        // 6. REGISTER SESSION ENTRY TO LOCAL MEMORY CACHE
        const newSession = {
            sessionId: sessionId,
            userId: userId,
            decartToken: decartJson.apiKey,
            dbSeconds: dbSeconds,
            createdAt: now,
            isLive: false,
            isEnding: false,
            lastHeartbeat: now,
            lastStreamPulse: now
        };

        createSession(newSession);
        console.log(`✅ Session ${sessionId} provisioned globally. Awaiting activation frame...`);

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