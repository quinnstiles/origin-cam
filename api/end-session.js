import express from 'express';
import { getSession, removeSession } from '../lib/sessionStore.js';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

const GRACE_MS = Number(process.env.GRACE_TIME || 10000);

// ========================================
// END SESSION (STRICT BILLING)
// ========================================
router.post('/', async (req, res) => {

    try {

        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'Missing sessionId'
            });
        }

        // ====================================
        // GET SESSION (SERVER MEMORY STATE)
        // ====================================
        const session = getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        const now = Date.now();

        // ====================================
        // TIME SPENT
        // ====================================
        const timeSpentMs = now - session.startedAt;

        const timeSpentSec = Math.floor(timeSpentMs / 1000);

        // ====================================
        // TOTAL AVAILABLE TIME
        // ====================================
        const totalAvailableSec =
            session.dbSeconds + Math.floor(GRACE_MS / 1000);

        // ====================================
        // REMAINING TIME (STRICT)
        // ====================================
        let remainingSeconds =
            totalAvailableSec - timeSpentSec;

        // ====================================
        // SAFETY CLAMPS (NO FREE MONEY)
        // ====================================
        if (remainingSeconds > session.dbSeconds) {
            remainingSeconds = session.dbSeconds;
        }

        if (remainingSeconds < 0) {
            remainingSeconds = 0;
        }

        // ====================================
        // FINAL BILL = USED TIME
        // ====================================
        const billedSeconds =
            session.dbSeconds - remainingSeconds;

        console.log("💰 STRICT BILL:", {
            sessionId,
            timeSpentSec,
            remainingSeconds,
            billedSeconds
        });

        // ====================================
        // UPDATE SUPABASE
        // ====================================
        const { error } = await supabase
            .from('sessions')
            .update({
                ended_at: now,
                remaining_seconds: remainingSeconds,
                billed_seconds: billedSeconds,
                status: 'closed',
                close_reason: 'manual_end'
            })
            .eq('id', sessionId);

        if (error) {
            console.log("DB error:", error.message);
        }

        // ====================================
        // CLEAN MEMORY
        // ====================================
        removeSession(sessionId);

        // ====================================
        // RESPONSE TO CLIENT
        // ====================================
        return res.json({
            success: true,
            sessionId,
            remainingSeconds,
            billedSeconds
        });

    } catch (err) {

        console.log('END SESSION ERROR:', err.message);

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;