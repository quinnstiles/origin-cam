const sessions = new Map();

/*
session structure:
{
  userId,
  startTime,
  lastHeartbeat,
  firstFrameTime,
  usedSeconds,
  status: "active" | "ended"
}
*/

export function createSession(sessionId, data) {
    sessions.set(sessionId, {
        ...data,
        startTime: Date.now(),
        lastHeartbeat: Date.now(),
        firstFrameTime: null,
        usedSeconds: 0,
        status: "active"
    });
}

export function getSession(sessionId) {
    return sessions.get(sessionId);
}

export function updateHeartbeat(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return;

    s.lastHeartbeat = Date.now();
}

export function markFirstFrame(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return;

    if (!s.firstFrameTime) {
        s.firstFrameTime = Date.now();
    }
}

export function endSession(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return;

    s.status = "ended";

    const now = Date.now();

    const start = s.firstFrameTime || s.startTime;

    s.usedSeconds = Math.floor((now - start) / 1000);

    return s;
}

export function isAlive(sessionId) {
    const s = sessions.get(sessionId);
    if (!s) return false;

    return (Date.now() - s.lastHeartbeat) < 3000;
}

export default sessions;