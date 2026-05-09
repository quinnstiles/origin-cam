import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';

import {
    createClient
} from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        realtime: {
            transport: ws
        }
    }
);

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {

        const {
            type,
            email,
            password,
            name
        } = req.body;

        if (!type || !email || !password) {
            return res.status(400).json({
                error: 'Missing fields'
            });
        }

        // ====================================
        // REGISTER
        // ====================================

        if (type === 'register') {

            if (!name) {
                return res.status(400).json({
                    error: 'Name required'
                });
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
                return res.status(400).json({
                    error: error.message
                });
            }

            // create profile
            await supabase
                .from('profiles')
                .insert({
                    id: data.user.id,
                    full_name: name,
                    remaining_seconds: 0,
                    total_used_seconds: 0
                });

            return res.status(200).json({
                success: true
            });
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
                return res.status(401).json({
                    error: 'Invalid login'
                });
            }

            const user = data.user;

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
                return res.status(404).json({
                    error: 'Profile not found'
                });
            }

            return res.status(200).json({
                sessionToken:
                    data.session.access_token,

                profile: {
                    id: profile.id,
                    name: profile.full_name || '',
                    seconds:
                        profile.remaining_seconds
                }
            });
        }

        return res.status(400).json({
            error: 'Invalid auth type'
        });

    }
    catch (err) {

        console.error(err);

        return res.status(500).json({
            error: err.message
        });
    }
}