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
// JSON RESPONSE HELPER
// ========================================

function sendJson(res, status, data) {

    if (res.headersSent) {
        return;
    }

    res.writeHead(status, {
        'Content-Type': 'application/json'
    });

    res.end(JSON.stringify(data));
}

// ========================================
// HANDLER
// ========================================

export default async function handler(req, res) {

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

        const {
            type,
            email,
            password,
            name
        } = req.body;

        // ====================================
        // VALIDATION
        // ====================================

        if (!type || !email || !password) {

            sendJson(res, 400, {
                error: 'Missing fields'
            });

            return;
        }

        // ====================================
        // REGISTER
        // ====================================

        if (type === 'register') {

            if (!name) {

                sendJson(res, 400, {
                    error: 'Name required'
                });

                return;
            }

            const {
                data,
                error
            } =
                await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true
                });

            if (error) {

                sendJson(res, 400, {
                    error: error.message
                });

                return;
            }

            // ====================================
            // CREATE PROFILE
            // ====================================

            const {
                error: profileError
            } =
                await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        full_name: name,
                        remaining_seconds: 0,
                        total_used_seconds: 0
                    });

            if (profileError) {

                sendJson(res, 500, {
                    error: profileError.message
                });

                return;
            }

            sendJson(res, 200, {
                success: true
            });

            return;
        }

        // ====================================
        // LOGIN
        // ====================================

        if (type === 'login') {

            const {
                data,
                error
            } =
                await supabase.auth.signInWithPassword({
                    email,
                    password
                });

            if (error || !data.session) {

                sendJson(res, 401, {
                    error: 'Invalid login'
                });

                return;
            }

            const user = data.user;

            // ====================================
            // GET PROFILE
            // ====================================

            const {
                data: profile,
                error: profileError
            } =
                await supabase
                    .from('profiles')
                    .select(`
                        id,
                        full_name,
                        remaining_seconds
                    `)
                    .eq('id', user.id)
                    .single();

            if (profileError || !profile) {

                sendJson(res, 404, {
                    error: 'Profile not found'
                });

                return;
            }

            sendJson(res, 200, {

                sessionToken:
                    data.session.access_token,

                profile: {
                    id: profile.id,
                    name: profile.full_name || '',
                    seconds:
                        profile.remaining_seconds
                }
            });

            return;
        }

        // ====================================
        // INVALID TYPE
        // ====================================

        sendJson(res, 400, {
            error: 'Invalid auth type'
        });

        return;

    }
    catch (err) {

        console.error(
            'AUTH ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });

        return;
    }
}