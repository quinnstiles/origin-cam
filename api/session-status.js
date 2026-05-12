// ========================================
// IMPORTS
// ========================================

import express from 'express';

import {
    authMiddleware
} from '../middleware/auth-middleware.js';

import {
    getSession
} from '../lib/session-store.js';

import {
    elapsedSeconds
} from '../lib/time.js';

import {
    ok,
    fail
} from '../utils/response.js';

// ========================================
// ROUTER
// ========================================

const router =
    express.Router();

// ========================================
// STATUS
// ========================================

router.post(
    '/',
    authMiddleware,
    async (req, res) => {
        try {

            const {
                sessionId
            } = req.body;

            const session =
                getSession(
                    sessionId
                );

            if (!session) {

                return fail(
                    res,
                    404,
                    'Session not found'
                );
            }

            // ====================================
            // ELAPSED
            // ====================================

            const elapsed =
                elapsedSeconds(
                    session.startedAt
                );

            // ====================================
            // REMAINING
            // ====================================

            let remaining =

                session.totalSeconds -
                elapsed -
                session.graceSeconds;

            if (remaining < 0) {
                remaining = 0;
            }

            // ====================================
            // RESPONSE
            // ====================================

            return ok(res, {

                active: true,

                elapsed,

                remaining
            });

        } catch (err) {

            return fail(
                res,
                500,
                err.message
            );
        }
    });

// ========================================
// EXPORT
// ========================================

export default router;