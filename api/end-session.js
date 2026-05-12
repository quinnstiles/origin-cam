// ========================================
// IMPORTS
// ========================================

import express from 'express';

import {
    authMiddleware
} from '../middleware/auth-middleware.js';

import {
    finalizeSession
} from '../lib/billing.js';

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
// END SESSION
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
            // FINALIZE
            // ====================================

            const result =
                await finalizeSession({

                    sessionId,

                    reason:
                        'manual_stop'
                });

            if (!result.success) {

                return fail(
                    res,
                    500,
                    result.error
                );
            }

            // ====================================
            // RESPONSE
            // ====================================

            return ok(res, {

                usedSeconds:
                    result.usedSeconds,

                remainingSeconds:
                    result.remainingSeconds
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