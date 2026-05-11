// ========================================
// FILE:
// lib/auth.js
// ========================================

import supabase from './supabase.js';

// ========================================
// VERIFY USER TOKEN
// ========================================

export async function authenticateUser(token) {

    // ====================================
    // TOKEN CHECK
    // ====================================

    if (!token) {

        return {
            success: false,
            error: 'Missing token'
        };
    }

    // ====================================
    // VALIDATE TOKEN
    // ====================================

    const {
        data: { user },
        error
    } =
        await supabase.auth.getUser(token);

    // ====================================
    // INVALID TOKEN
    // ====================================

    if (error || !user) {

        return {
            success: false,
            error: 'Invalid token'
        };
    }

    // ====================================
    // SUCCESS
    // ====================================

    return {
        success: true,
        user
    };
}