import "dotenv/config";
import { createSession } from "../lib/session-store.js";
import { now } from "../lib/time.js";

export default function handler(req, res) {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: "missing userId" });
    }

    const grace = Number(process.env.GRACE_TIME || 10);

    const session = {
        userId,
        startTime: now(),
        lastBeat: now(),
        totalTime: 30, // replace with DB later
        graceTime: grace,
        usedTime: 0,
        active: true
    };

    createSession(userId, session);

    return res.json({
        success: true,
        sessionId: userId,
        totalTime: session.totalTime
    });
}