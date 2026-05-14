import express from 'express';

import {
    getSession,
    removeSession
} from '../lib/sessionStore.js';

const router = express.Router();

// ========================================
// END SESSION
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
        // GET SESSION
        // ====================================

        const session =
            getSession(sessionId);

        if (!session) {

            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        // ====================================
        // TIME USED
        // ====================================

        const now =
            Date.now();

        const secondsUsed =
            Math.floor(
                (now - session.startedAt) / 1000
            );

        // ====================================
        // REMAINING TIME
        // ====================================

        let remainingSeconds =
            session.sessionDuration -
            secondsUsed;

        // ====================================
        // REMOVE GRACE TIME
        // ====================================

        if (
            remainingSeconds >
            session.dbSeconds
        ) {
            remainingSeconds =
                session.dbSeconds;
        }

        if (remainingSeconds < 0) {
            remainingSeconds = 0;
        }

        // ====================================
        // TODO:
        // UPDATE SUPABASE HERE
        // ====================================

        console.log(
            'SESSION ENDED:',
            {
                sessionId,
                userId: session.userId,
                secondsUsed,
                remainingSeconds
            }
        );

        // ====================================
        // CLEANUP
        // ====================================

        removeSession(sessionId);

        // ====================================
        // RESPONSE
        // ====================================

        return res.json({
            success: true,
            remainingSeconds
        });

    } catch (err) {

        console.log(
            'END SESSION ERROR:',
            err.message
        );

        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;