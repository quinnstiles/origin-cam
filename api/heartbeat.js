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
// HEARTBEAT
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

        const { session_id } = req.body;

        // ====================================
        // VALIDATE
        // ====================================

        if (!session_id) {

            sendJson(res, 400, {
                error: 'Missing session_id'
            });

            return;
        }

        // ====================================
        // GET SESSION
        // ====================================

        const session =
            global.activeSessions?.[
            session_id
            ];

        if (!session) {

            sendJson(res, 404, {
                error: 'Session not found'
            });

            return;
        }

        // ====================================
        // UPDATE HEARTBEAT
        // ====================================

        session.lastHeartbeat =
            Date.now();

        // ====================================
        // RESPONSE
        // ====================================

        sendJson(res, 200, {
            success: true
        });

        return;

    }
    catch (err) {

        console.error(
            'HEARTBEAT ERROR:',
            err
        );

        sendJson(res, 500, {
            error: err.message
        });

        return;
    }
}