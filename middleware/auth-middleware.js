// ========================================
// IMPORTS
// ========================================

import {
    authenticateUser
} from '../lib/auth.js';

// ========================================
// AUTH MIDDLEWARE
// ========================================

export async function authMiddleware(
    req,
    res,
    next
) {

    try {

        const token =
            req.body.token;

        const auth =
            await authenticateUser(
                token
            );

        if (!auth.success) {

            return res.status(401).json({
                success: false,
                error: auth.error
            });
        }

        // ====================================
        // ATTACH USER
        // ====================================

        req.user =
            auth.user;

        next();

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}