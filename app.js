import 'dotenv/config';

import express from 'express';
import cors from 'cors';

import authRoute from './api/auth.js';
import startSessionRoute from './api/start-session.js';
import endSessionRoute from './api/end-session.js';

import { startBillingWatcher } from './lib/billing.js';


import {
    sessions,
    removeSession
} from "./lib/sessionStore.js";

const app = express();

// ========================================
// MIDDLEWARE
// ========================================
app.use(cors());

app.use(express.json({
    limit: '10mb'
}));

// ========================================
// ROUTES
// ========================================
app.use('/api/auth', authRoute);
app.use('/api/start-session', startSessionRoute);
app.use('/api/end-session', endSessionRoute);

// ========================================
// HEALTH
// ========================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Origin Server Online'
    });
});

// ========================================
// BILLING ENGINE START
// (CRITICAL ADDITION)
// ========================================
startBillingWatcher();


setInterval(async () => {

    const now = Date.now();

    for (const [sessionId, session] of sessions.entries()) {

        if (!session.active)
            continue;

        // ====================================
        // HEARTBEAT LOST
        // ====================================

        const heartbeatDiff =
            now - session.lastHeartbeat;

        if (heartbeatDiff > 15000) {

            console.log(
                "💀 Heartbeat lost:",
                sessionId
            );

            await finalizeSession(
                sessionId,
                false
            );

            continue;
        }

        // ====================================
        // FULL SESSION TIME REACHED
        // ====================================

        const elapsed =
            Math.floor(
                (now - session.startTime) / 1000
            );

        if (
            elapsed >= session.fullDuration
        ) {

            console.log(
                "⏱ Session fully consumed:",
                sessionId
            );

            await finalizeSession(
                sessionId,
                true
            );
        }

    }

}, 1000);

// ========================================
// START SERVER
// ========================================
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`🚀 Origin Server running on port ${PORT}`);
});