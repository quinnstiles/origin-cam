import { getSession, updateSession } from "../lib/session-store.js";
import { now } from "../lib/time.js";

export default function handler(req, res) {
    const { userId } = req.body;

    const session = getSession(userId);

    if (!session) {
        return res.status(404).json({ error: "session not found" });
    }

    session.lastBeat = now();

    updateSession(userId, session);

    return res.json({ ok: true });
}