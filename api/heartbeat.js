export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    try {
        const { session_id } = req.body;

        const session =
            global.activeSessions?.[
            session_id
            ];

        if (!session) {
            return res.status(404).json({
                error: 'Session not found'
            });
        }

        session.lastHeartbeat =
            Date.now();

        return res.status(200).json({
            success: true
        });
    }
    catch (err) {
        return res.status(500).json({
            error: err.message
        });
    }
}