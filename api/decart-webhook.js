// ========================================
// FILE:
// api/decart-webhook.js
// ========================================

import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabase.js';

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

        const {
            event,
            session_id,
            usage_seconds,
            reason
        } = req.body;

        // ====================================
        // ONLY HANDLE SESSION END EVENTS
        // ====================================

        if (event !== 'session.ended') {

            sendJson(res, 200, {
                ignored: true
            });

            return;
        }

        // ====================================
        // FIND SESSION
        // ====================================

        const { data: session } =
            await supabase
                .from('sessions')
                .select('*')
                .eq('decart_session_id', session_id)
                .eq('status', 'active')
                .single();

        if (!session) {

            sendJson(res, 200, {
                error: 'Session not found'
            });

            return;
        }

        // ====================================
        // CALCULATE REMAINING
        // ====================================

        const used =
            usage_seconds || 0;

        const remaining =
            Math.max(
                0,
                session.remaining_at_start - used
            );

        // ====================================
        // UPDATE PROFILE
        // ====================================

        await supabase
            .from('profiles')
            .update({
                remaining_seconds: remaining
            })
            .eq('id', session.user_id);

        // ====================================
        // UPDATE SESSION
        // ====================================

        await supabase
            .from('sessions')
            .update({
                status: 'ended',
                used_seconds: used,
                remaining_at_end: remaining,
                end_time: new Date().toISOString(),
                stop_reason: reason || 'decart_ended'
            })
            .eq('id', session.id);

        // ====================================
        // RESPONSE
        // ====================================

        sendJson(res, 200, {
            success: true
        });

    } catch (err) {

        console.error('DECart WEBHOOK ERROR:', err);

        sendJson(res, 500, {
            error: err.message
        });
    }
}