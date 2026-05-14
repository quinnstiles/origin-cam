import express from "express";

import {
    updateHeartbeat,
    getSession
} from "../lib/sessionStore.js";

const router = express.Router();

router.post("/", (req, res) => {

    const { sessionId } = req.body;

    const session =
        getSession(sessionId);

    if (!session) {

        return res.status(404).json({
            success: false
        });
    }

    updateHeartbeat(sessionId);

    return res.json({
        success: true
    });
});

export default router;