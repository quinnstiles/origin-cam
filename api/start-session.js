// ========================================
// IMPORTS
// ========================================

import express from 'express';

import supabase
    from '../lib/supabase.js';

import {
    authMiddleware
} from '../middleware/auth-middleware.js';

import {
    createDecartSession
} from '../lib/decart.js';

import {
    createSession
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
// CONFIG
// ========================================

const GRACE_SECONDS = 10;

// ========================================
// START SESSION
// ========================================

router.post(
    '/',
    authMiddleware,
    async (req, res) => {
        try {

            const user =
                req.user;

            // ====================================
            // GET PROFILE
            // ====================================

            const {
                data: profile,
                error
            } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (
                error ||
                !profile
            ) {
                return fail(
                    res,
                    404,
                    'Profile not found'
                );
            }

            // ====================================
            // CHECK TIME
            // ====================================

            const remaining =
                profile.remaining_seconds || 0;

            if (remaining <= 0) {

                return fail(
                    res,
                    403,
                    'No remaining time'
                );
            }

            // ====================================
            // TOTAL SESSION
            // ====================================

            const totalSeconds =
                remaining +
                GRACE_SECONDS;

            // ====================================
            // CREATE DECart SESSION
            // ====================================

            const decart =
                await createDecartSession({

                    durationSeconds:
                        totalSeconds,

                    userId:
                        user.id
                });

            if (!decart.success) {

                return fail(
                    res,
                    500,
                    decart.error
                );
            }

            // ====================================
            // STORE MEMORY SESSION
            // ====================================

            createSession(

                decart.sessionId,

                {
                    userId:
                        user.id,

                    startedAt:
                        now(),

                    lastHeartbeat:
                        now(),

                    totalSeconds,

                    graceSeconds:
                        GRACE_SECONDS,

                    originalSeconds:
                        remaining,

                    decartSessionId:
                        decart.sessionId
                }
            );

            // ====================================
            // RESPONSE
            // ====================================

            return ok(res, {

                sessionId:
                    decart.sessionId,

                clientToken:
                    decart.clientToken,

                totalSeconds,

                remainingSeconds:
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