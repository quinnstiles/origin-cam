// ========================================
// FILE:
// api/start-session.js
// ========================================

import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabase.js';

import { authenticateUser } from '../lib/auth.js';
import { createDecartSession } from '../lib/decart.js';

import {
    canStartSession,
    createSession,
    forceCloseSession
} from '../lib/sessions.js';

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

        const { token } = req.body;

        // ====================================
        // AUTH USER
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
        // CHECK IF USER CAN START
        // ====================================

        const check =
            await canStartSession(user.id);

        if (!check.ok) {

            sendJson(res, 403, {
                error: check.reason
            });

            return;
        }

        // ====================================
        // SAFETY: FORCE CLOSE OLD SESSION IF EXISTS (RECOVERY)
        // ====================================

        await forceCloseSession(user.id, 'auto_cleanup');

        // ====================================
        // CREATE DECart SESSION
        // ====================================

        const decart =
            await createDecartSession({
                durationSeconds: check.remaining,
                userId: user.id
            });

        if (!decart.success) {

            sendJson(res, 500, {
                error: decart.error
            });

            return;
        }

        // ====================================
        // STORE SESSION IN DB
        // ====================================

        await createSession({
            userId: user.id,
            decartSessionId: decart.sessionId,
            duration: check.remaining
        });

        // ====================================
        // RESPONSE TO CLIENT
        // ====================================

        sendJson(res, 200, {

            success: true,

            sessionId: decart.sessionId,

            token: decart.clientToken,

            remaining_seconds: check.remaining,

            expiresAt: decart.expiresAt || null
        });

    } catch (err) {

        console.error(
            'START SESSION ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });
    }
}