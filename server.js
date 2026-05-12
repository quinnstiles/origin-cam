import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';

// ========================================
// ROUTES
// ========================================

import authRoute from './api/auth.js';
import startSessionRoute from './api/start-session.js';
import heartbeatRoute from './api/heartbeat.js';
import endSessionRoute from './api/end-session.js';
import sessionStatusRoute from './api/session-status.js';

// ========================================
// HEARTBEAT MONITOR
// ========================================

import {
    startHeartbeatMonitor
} from './lib/heartbeat-monitor.js';

// ========================================
// APP
// ========================================

const app = express();

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());

app.use(express.json({
    limit: '10mb'
}));

// ========================================
// HEALTH CHECK
// ========================================

app.get('/', (req, res) => {

    res.json({
        success: true,
        service: 'origin-server',
        status: 'running'
    });
});

// ========================================
// API ROUTES
// ========================================

app.use('/api/auth', authRoute);

app.use(
    '/api/start-session',
    startSessionRoute
);

app.use(
    '/api/heartbeat',
    heartbeatRoute
);

app.use(
    '/api/end-session',
    endSessionRoute
);

app.use(
    '/api/session-status',
    sessionStatusRoute
);

// ========================================
// START SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `🚀 Origin Server Running On Port ${PORT}`
    );

    // ====================================
    // START HEARTBEAT ENGINE
    // ====================================

    startHeartbeatMonitor();
});