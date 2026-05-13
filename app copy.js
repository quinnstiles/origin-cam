import 'dotenv/config';

import express from 'express';
import cors from 'cors';

import authRoute from './api/auth.js';

const app = express();

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.json({
    limit: '10mb'
}));

// =====================================================
// ROUTES
// =====================================================

app.use('/api/auth', authRoute);

// =====================================================
// HEALTH
// =====================================================

app.get('/', (req, res) => {

    res.json({
        success: true,
        message: 'Origin Server Online'
    });
});

// =====================================================
// START
// =====================================================

const PORT = 3000;

app.listen(PORT, () => {

    console.log(
        `🚀 Origin Server running on port ${PORT}`
    );
});