import { now } from "./time.js";
import { getAllSessions, updateSession } from "./session-store.js";
import { calculateUsedTime } from "./billing.js";

export function startMonitor(onEnd) {
    setInterval(() => {
        const sessions = getAllSessions();

        for (const [id, session] of sessions) {
            if (!session.active) continue;

            const diff = now() - session.lastBeat;

            // CRASH DETECTION
            if (diff > 3000) {
                session.active = false;

                onEnd(id, {
                    reason: "timeout",
                    used: calculateUsedTime(session)
                });
            }

            // AUTO END (time finished)
            const used = calculateUsedTime(session);

            if (used >= session.totalTime) {
                session.active = false;

                onEnd(id, {
                    reason: "completed",
                    used: session.totalTime
                });
            }

            updateSession(id, session);
        }
    }, 1000);
}