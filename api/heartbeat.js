export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: 'Method not allowed'
        }));

        return;
    }

    try {
        const { session_id } = req.body;

        const session =
            global.activeSessions?.[
            session_id
            ];

        if (!session) {

            res.writeHead(404, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify({
                error: 'Session not found'
            }));

            return;
        }

        session.lastHeartbeat =
            Date.now();

        res.writeHead(200, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            success: true
        }));

        return;
    }
    catch (err) {
        res.writeHead(500, {
            'Content-Type': 'application/json'
        });

        res.end(JSON.stringify({
            error: err.message
        }));

        return;
    }
}