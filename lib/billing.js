import { now } from "./time.js";

export function calculateUsedTime(session) {
    if (!session) return 0;

    const end = now();
    const start = session.startTime;

    const raw = end - start;

    // apply grace time (unbillable startup delay)
    const adjusted = raw - (session.graceTime * 1000);

    return Math.max(0, Math.floor(adjusted / 1000));
}

export function calculateRemaining(session) {
    const used = calculateUsedTime(session);
    return Math.max(0, session.totalTime - used);
}