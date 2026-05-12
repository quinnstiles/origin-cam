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
    now
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
// HEARTBEAT
// ========================================

router.post(
    '/',
    authMiddleware,
    async (req, res) => {
        try {

            const {
                sessionId
            } = req.body;

            // ====================================
            // VALIDATION
            // ====================================

            if (!sessionId) {

                return fail(
                    res,
                    400,
                    'Missing sessionId'
                );
            }

            // ====================================
            // GET SESSION
            // ====================================

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
            // UPDATE HEARTBEAT
            // ====================================

            session.lastHeartbeat =
                now();

            // ====================================
            // RESPONSE
            // ====================================

            return ok(res, {
                alive: true
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