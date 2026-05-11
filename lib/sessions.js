// ========================================
// FILE:
// lib/sessions.js
// ========================================

import supabase from './supabase.js';

// ========================================
// GET ACTIVE SESSION
// ========================================

export async function getActiveSession(userId) {

    const { data, error } =
        await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single();

    if (error || !data) {
        return null;
    }

    return data;
}

// ========================================
// CHECK IF USER CAN START SESSION
// ========================================

export async function canStartSession(userId) {

    const active = await getActiveSession(userId);

    // Already streaming
    if (active) {

        return {
            ok: false,
            reason: 'Session already active'
        };
    }

    // Check user credits
    const { data: profile } =
        await supabase
            .from('profiles')
            .select('remaining_seconds')
            .eq('id', userId)
            .single();

    if (!profile || profile.remaining_seconds <= 0) {

        return {
            ok: false,
            reason: 'No remaining time'
        };
    }

    return {
        ok: true,
        remaining: profile.remaining_seconds
    };
}

// ========================================
// FORCE CLOSE OLD SESSION (RECOVERY SAFETY)
// ========================================

export async function forceCloseSession(userId, reason = 'force_closed') {

    const active = await getActiveSession(userId);

    if (!active) return true;

    await supabase
        .from('sessions')
        .update({
            status: 'ended',
            end_time: new Date().toISOString(),
            stop_reason: reason
        })
        .eq('id', active.id);

    return true;
}

// ========================================
// CREATE SESSION RECORD
// ========================================

export async function createSession({
    userId,
    decartSessionId,
    duration
}) {

    const { error } =
        await supabase
            .from('sessions')
            .insert({
                user_id: userId,
                decart_session_id: decartSessionId,
                status: 'active',
                start_time: new Date().toISOString(),
                remaining_at_start: duration
            });

    if (error) {
        throw new Error(error.message);
    }

    return true;
}