// ========================================
// FILE:
// api/end-session.js
// ========================================

import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabase.js';

import { authenticateUser } from '../lib/auth.js';
import { getDecartSession } from '../lib/decart.js';
import { getActiveSession } from '../lib/sessions.js';

// ========================================
// RESPONSE HELPER
// ========================================

function sendJson(res, status, data) {

    if (res.headersSent) return;

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(JSON.stringify(data));
}

// ========================================
// HANDLER
// ========================================

export default async function handler(req, res) {

    if (req.method !== 'POST') {

        sendJson(res, 405, {
            error: 'Method not allowed'
        });

        return;
    }

    try {

        const { token, sessionId } = req.body;

        // ====================================
        // AUTH
        // ====================================

        const auth =
            await authenticateUser(token);

        if (!auth.success) {

            sendJson(res, 401, {
                error: auth.error
            });

            return;
        }

        const user = auth.user;

        // ====================================
        // GET ACTIVE SESSION (SERVER TRUTH)
        // ====================================

        const session =
            await getActiveSession(user.id);

        if (!session) {

            sendJson(res, 404, {
                error: 'No active session'
            });

            return;
        }

        // Optional safety check (extra validation)
        if (sessionId && session.decart_session_id !== sessionId) {

            sendJson(res, 400, {
                error: 'Session mismatch'
            });

            return;
        }

        // ====================================
        // GET DECart USAGE (TRUTH SOURCE)
        // ====================================

        const decart =
            await getDecartSession(
                session.decart_session_id
            );

        let usedSeconds = 0;

        if (decart.success) {

            usedSeconds =
                decart.session?.usage_seconds ||
                decart.session?.duration ||
                0;
        }

        // ====================================
        // CALCULATE REMAINING
        // ====================================

        const remaining =
            Math.max(
                0,
                session.remaining_at_start - usedSeconds
            );

        // ====================================
        // UPDATE PROFILE (FINAL BILLING STATE)
        // ====================================

        await supabase
            .from('profiles')
            .update({
                remaining_seconds: remaining
            })
            .eq('id', user.id);

        // ====================================
        // CLOSE SESSION
        // ====================================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',
                end_time: new Date().toISOString(),
                used_seconds: usedSeconds,
                remaining_at_end: remaining,
                stop_reason: 'manual_stop'
            })
            .eq('id', session.id);

        // ====================================
        // RESPONSE
        // ====================================

        sendJson(res, 200, {
            success: true,
            used_seconds: usedSeconds,
            remaining_seconds: remaining
        });

    } catch (err) {

        console.error('END SESSION ERROR:', err);

        sendJson(res, 500, {
            error: err.message
        });
    }
}