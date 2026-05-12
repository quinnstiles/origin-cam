// ========================================
// IMPORTS
// ========================================

import supabase from './supabase.js';

// ========================================
// VERIFY TOKEN
// ========================================

export async function authenticateUser(
    token
) {

    try {

        if (!token) {

            return {
                success: false,
                error: 'Missing token'
            };
        }

        // ====================================
        // VERIFY USER
        // ====================================

        const {
            data,
            error
        } = await supabase.auth.getUser(
            token
        );

        if (error || !data?.user) {

            return {
                success: false,
                error:
                    error?.message ||
                    'Invalid token'
            };
        }

        // ====================================
        // SUCCESS
        // ====================================

        return {

            success: true,

            user: data.user
        };

    } catch (err) {

        return {
            success: false,
            error: err.message
        };
    }
}