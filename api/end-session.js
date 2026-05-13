import { getSession, deleteSession } from "../lib/session-store.js";
import { calculateUsedTime, calculateRemaining } from "../lib/billing.js";

export default function handler(req, res) {
    const { userId } = req.body;

    const session = getSession(userId);

    if (!session) {
        return res.status(404).json({ error: "session not found" });
    }

    const used = calculateUsedTime(session);
    const remaining = calculateRemaining(session);

    deleteSession(userId);

    return res.json({
        success: true,
        used_seconds: used,
        remaining_seconds: remaining
    });
}