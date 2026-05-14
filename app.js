import 'dotenv/config';

import express from 'express';
import cors from 'cors';

import authRoute from './api/auth.js';
import startSessionRoute from './api/start-session.js';
import endSessionRoute from './api/end-session.js';
import heartbeatRoute from './api/heartbeat.js';

// import { startBillingWatcher } from './lib/billing.js';

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
// ROUTES
// ========================================

app.use(
    '/api/auth',
    authRoute
);

app.use(
    '/api/start-session',
    startSessionRoute
);

app.use(
    '/api/end-session',
    endSessionRoute
);

app.use(
    '/api/heartbeat',
    heartbeatRoute
);

// ========================================
// HEALTH
// ========================================

app.get('/', (req, res) => {

    return res.json({
        success: true,
        message: 'Origin Server Online'
    });
});

// ========================================
// BILLING WATCHER
// ========================================

// startBillingWatcher();

// ========================================
// START SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `🚀 Origin Server running on port ${PORT}`
    );
});