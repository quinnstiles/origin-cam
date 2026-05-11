// ========================================
// FILE:
// lib/decart.js
// ========================================

import dotenv from 'dotenv';
dotenv.config();

// ========================================
// CREATE REALTIME SESSION
// ========================================

export async function createDecartSession({

    durationSeconds,
    userId

}) {

    try {

        // ====================================
        // REQUEST
        // ====================================

        const response =
            await fetch(

                'https://api.decart.ai/v1/realtime/session',

                {
                    method: 'POST',

                    headers: {

                        'Content-Type':
                            'application/json',

                        'Authorization':
                            `Bearer ${process.env.DECART_API_KEY}`
                    },

                    body: JSON.stringify({

                        metadata: {
                            user_id: userId
                        },

                        constraints: {

                            realtime: {

                                maxSessionDuration:
                                    durationSeconds
                            }
                        }
                    })
                }
            );

        // ====================================
        // RESPONSE
        // ====================================

        const data =
            await response.json();

        // ====================================
        // FAILED
        // ====================================

        if (!response.ok) {

            return {
                success: false,
                error:
                    data.error ||
                    'Failed to create Decart session'
            };
        }

        // ====================================
        // SUCCESS
        // ====================================

        return {

            success: true,

            sessionId:
                data.id,

            clientToken:
                data.client_token,

            expiresAt:
                data.expires_at || null
        };
    }
    catch (err) {

        console.error(
            'DECART SESSION ERROR:',
            err
        );

        return {
            success: false,
            error: err.message
        };
    }
}

// ========================================
// GET SESSION INFO
// ========================================

export async function getDecartSession(
    sessionId
) {

    try {

        const response =
            await fetch(

                `https://api.decart.ai/v1/realtime/session/${sessionId}`,

                {
                    method: 'GET',

                    headers: {

                        'Authorization':
                            `Bearer ${process.env.DECART_API_KEY}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            return {
                success: false,
                error:
                    data.error ||
                    'Failed to fetch session'
            };
        }

        return {
            success: true,
            session: data
        };
    }
    catch (err) {

        console.error(
            'DECART FETCH ERROR:',
            err
        );

        return {
            success: false,
            error: err.message
        };
    }
}