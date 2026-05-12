// ========================================
// IMPORTS
// ========================================

import express from 'express';

import supabase
    from '../lib/supabase.js';

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
// LOGIN
// ========================================

router.post(
    '/',
    async (req, res) => {
        try {

            const {
                email,
                password
            } = req.body;

            // ====================================
            // VALIDATION
            // ====================================

            if (
                !email ||
                !password
            ) {
                return fail(
                    res,
                    400,
                    'Missing email or password'
                );
            }

            // ====================================
            // LOGIN
            // ====================================

            const {
                data,
                error
            } =
                await supabase.auth
                    .signInWithPassword({

                        email,
                        password
                    });

            if (
                error ||
                !data?.session
            ) {
                return fail(
                    res,
                    401,
                    'Invalid credentials'
                );
            }

            // ====================================
            // USER PROFILE
            // ====================================

            const user =
                data.user;

            const {
                data: profile,
                error: profileError
            } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (
                profileError ||
                !profile
            ) {
                return fail(
                    res,
                    500,
                    'Profile not found'
                );
            }

            // ====================================
            // RESPONSE
            // ====================================

            return ok(res, {

                token:
                    data.session.access_token,

                profile: {

                    id:
                        profile.id,

                    name:
                        profile.name,

                    seconds:
                        profile.remaining_seconds
                }
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