// ========================================
// CREATE DECart SESSION
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

    } catch (err) {

        return {
            success: false,
            error: err.message
        };
    }
}

// ========================================
// CLOSE SESSION
// ========================================

export async function closeDecartSession(
    sessionId
) {

    try {

        const response =
            await fetch(

                `https://api.decart.ai/v1/realtime/session/${sessionId}`,

                {
                    method: 'DELETE',

                    headers: {

                        'Authorization':
                            `Bearer ${process.env.DECART_API_KEY}`
                    }
                }
            );

        return response.ok;

    } catch {

        return false;
    }
}