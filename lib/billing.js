// ========================================
// IMPORTS
// ========================================

import supabase
    from './supabase.js';

import {
    elapsedSeconds
} from './time.js';

import {
    removeSession
} from './session-store.js';

import {
    closeDecartSession
} from './decart.js';

// ========================================
// FINALIZE SESSION
// ========================================

export async function finalizeSession({

    sessionId,
    reason = 'unknown'
}) {

    try {

        // ====================================
        // GET SESSION
        // ====================================

        const {
            getSession
        } = await import(
            './session-store.js'
        );

        const session =
            getSession(sessionId);

        if (!session) {

            return {
                success: false,
                error: 'Session not found'
            };
        }

        // ====================================
        // ELAPSED TIME
        // ====================================

        const elapsed =
            elapsedSeconds(
                session.startedAt
            );

        // ====================================
        // REMOVE GRACE
        // ====================================

        let usedSeconds =
            elapsed -
            session.graceSeconds;

        if (usedSeconds < 0) {
            usedSeconds = 0;
        }

        // ====================================
        // AUTO FINISH
        // ====================================

        const sessionFinished =

            elapsed >=
            session.totalSeconds;

        // ====================================
        // REMAINING
        // ====================================

        let remainingSeconds = 0;

        if (!sessionFinished) {

            remainingSeconds =

                session.originalSeconds -
                usedSeconds;

            if (remainingSeconds < 0) {
                remainingSeconds = 0;
            }
        }

        // ====================================
        // UPDATE DB
        // ====================================

        const { error } =
            await supabase
                .from('profiles')
                .update({

                    remaining_seconds:
                        remainingSeconds
                })
                .eq(
                    'id',
                    session.userId
                );

        if (error) {

            return {
                success: false,
                error: error.message
            };
        }

        // ====================================
        // CLOSE DECart SESSION
        // ====================================

        await closeDecartSession(
            session.decartSessionId
        );

        // ====================================
        // REMOVE MEMORY SESSION
        // ====================================

        removeSession(sessionId);

        // ====================================
        // SUCCESS
        // ====================================

        console.log(

            '🔥 SESSION FINALIZED',

            {
                reason,
                usedSeconds,
                remainingSeconds
            }
        );

        return {

            success: true,

            usedSeconds,

            remainingSeconds
        };

    } catch (err) {

        return {
            success: false,
            error: err.message
        };
    }
}