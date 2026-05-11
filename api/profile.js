// ========================================
// FILE:
// api/profile.js
// ========================================

import dotenv from 'dotenv';
dotenv.config();

import supabase from '../lib/supabase.js';

import {
    authenticateUser
} from '../lib/auth.js';

// ========================================
// JSON RESPONSE
// ========================================

function sendJson(
    res,
    status,
    data
) {

    if (res.headersSent) {
        return;
    }

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(
        JSON.stringify(data)
    );
}

// ========================================
// HANDLER
// ========================================

export default async function handler(
    req,
    res
) {

    // ====================================
    // METHOD CHECK
    // ====================================

    if (req.method !== 'POST') {

        sendJson(res, 405, {
            error: 'Method not allowed'
        });

        return;
    }

    try {

        const { token } =
            req.body;

        // ====================================
        // AUTH
        // ====================================

        const auth =
            await authenticateUser(
                token
            );

        if (!auth.success) {

            sendJson(res, 401, {
                success: false,
                error: auth.error
            });

            return;
        }

        const user =
            auth.user;

        // ====================================
        // GET PROFILE
        // ====================================

        const {
            data: profile,
            error
        } =
            await supabase
                .from('profiles')
                .select(`
                    full_name,
                    remaining_seconds
                `)
                .eq('id', user.id)
                .single();

        // ====================================
        // PROFILE ERROR
        // ====================================

        if (
            error ||
            !profile
        ) {

            sendJson(res, 404, {

                success: false,

                error:
                    'Profile not found'
            });

            return;
        }

        // ====================================
        // SUCCESS
        // ====================================

        sendJson(res, 200, {

            success: true,

            profile: {

                id:
                    user.id,

                name:
                    profile.full_name || '',

                seconds:
                    profile.remaining_seconds || 0
            }
        });
    }
    catch (err) {

        console.error(
            'PROFILE ERROR:',
            err
        );

        sendJson(res, 500, {

            success: false,

            error:
                err.message
        });
    }
}