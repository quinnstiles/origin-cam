// origin-server/api/heartbeat.js

import { supabase } from "../lib/supabase.js";
import { verifyAuth } from "../lib/auth.js";

const HEARTBEAT_TIMEOUT_MS = 15000; // must match node grace logic

export default async function handler(req, res) {
    // =========================================
    // ONLY POST ALLOWED
    // =========================================
    if (req.method !== "POST") {
        return res.status(405).json({
            success: false,
            error: "Method not allowed"
        });
    }

    try {
        // =========================================
        // AUTH CHECK (DO NOT SKIP)
        // =========================================
        const auth = await verifyAuth(req);

        if (!auth.valid) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: "Missing sessionId"
            });
        }

        // =========================================
        // FETCH SESSION
        // =========================================
        const { data: session, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (error || !session) {
            return res.status(404).json({
                success: false,
                error: "Session not found"
            });
        }

        // =========================================
        // VALIDATE OWNERSHIP
        // =========================================
        if (session.user_id !== auth.user.id) {
            return res.status(403).json({
                success: false,
                error: "Forbidden"
            });
        }

        // =========================================
        // SERVER TIME (TRUTH SOURCE)
        // =========================================
        const now = Date.now();

        // =========================================
        // UPDATE HEARTBEAT
        // =========================================
        const { error: updateError } = await supabase
            .from("sessions")
            .update({
                last_seen: now
            })
            .eq("id", sessionId);

        if (updateError) {
            return res.status(500).json({
                success: false,
                error: "Failed to update heartbeat"
            });
        }

        // =========================================
        // OPTIONAL: DETECT STALE SESSION EARLY
        // =========================================
        const lastSeen = session.last_seen || session.started_at;

        const diff = now - lastSeen;

        let status = "alive";

        if (diff > HEARTBEAT_TIMEOUT_MS) {
            status = "stale";
        }

        // =========================================
        // RESPONSE
        // =========================================
        return res.status(200).json({
            success: true,
            status,
            serverTime: now
        });

    } catch (err) {
        console.error("Heartbeat error:", err);

        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
}