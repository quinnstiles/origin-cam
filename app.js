import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ========================================
// LOAD ENV
// ========================================

dotenv.config();

// ========================================
// ROUTES
// ========================================
import authRoute
    from "./api/auth.js";

import startSessionRoute
    from "./api/start-session.js";



import endSessionRoute
    from "./api/end-session.js";

// ========================================
// HEARTBEAT MONITOR
// ========================================


// ========================================
// APP
// ========================================

const app = express();

// ========================================
// MIDDLEWARE
// ========================================

app.use(cors());

app.use(express.json({
    limit: "10mb"
}));

// ========================================
// ROUTES
// ========================================


app.use(
    "/api/auth",
    authRoute
);


app.use(
    "/api/start-session",
    startSessionRoute
);



app.use(
    "/api/end-session",
    endSessionRoute
);

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message:
            "Origin server running"
    });
});

// ========================================
// START HEARTBEAT MONITOR
// ========================================


// ========================================
// SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `🚀 SERVER RUNNING ON ${PORT}`
    );
});