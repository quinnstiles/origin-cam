import express from 'express';
import { getSession, removeSession } from '../lib/sessionStore.js';
import { endSession as finalizeBilling } from '../lib/billing.js';

const router = express.Router();

// ========================================
// END SESSION (MANUAL OR HEARTBEAT CLOSE)
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
        // GET SESSION (AUTHORITATIVE)
        // ====================================
        const session = getSession(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found or already closed'
            });
        }

        // ====================================
        // PREVENT DOUBLE ENDING
        // ====================================
        if (session.ended) {
            return res.json({
                success: true,
                message: 'Already ended',
                remainingSeconds: session.remainingSeconds || 0
            });
        }

        // mark as ended immediately (prevents race condition)
        session.ended = true;
        session.active = false;

        // ====================================
        // STOP HEARTBEAT TIMER SAFELY
        // ====================================
        session.lastHeartbeat = Date.now();

        // ====================================
        // CALL BILLING ENGINE (SERVER AUTHORITY)
        // ====================================
        const result = await finalizeBilling(sessionId, {
            reason: 'manual_end'
        });

        // ====================================
        // CLEAN MEMORY SESSION
        // ====================================
        removeSession(sessionId);

        // ====================================
        // RESPONSE
        // ====================================
        return res.json({
            success: true,
            sessionId,
            billedSeconds: result?.billed_seconds || 0,
            remainingSeconds: 0
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