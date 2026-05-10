import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';

import {
    createClient
} from '@supabase/supabase-js';

// ========================================
// SUPABASE
// ========================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        realtime: {
            transport: ws
        }
    }
);

// ========================================
// RESPONSE
// ========================================

function sendJson(res, status, data) {
    if (res.headersSent)
        return;

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(JSON.stringify(data));
}

// ========================================
// START SESSION
// ========================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        sendJson(res, 405, {
            error: 'Method not allowed'
        });

        return;
    }

    try {
        // ====================================
        // AUTH
        // ====================================

        const token =
            req.headers.authorization
                ?.split(' ')[1];

        if (!token) {
            sendJson(res, 401, {
                error: 'No token'
            });

            return;
        }

        const {
            data: { user },
            error
        } =
            await supabase.auth.getUser(token);

        if (error || !user) {
            sendJson(res, 401, {
                error: 'Invalid token'
            });

            return;
        }

        // ====================================
        // SUCCESS
        // ====================================

        sendJson(res, 200, {

            success: true,

            decartKey:
                process.env.DECART_API_KEY
        });

        return;
    }
    catch (err) {
        console.error(
            'START SESSION ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });

        return;
    }
}