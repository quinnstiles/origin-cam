import express from "express";

const app = express();
app.use(express.json());

// =========================
// START SESSION ROUTE
// =========================
app.post("/api/start-session", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.json({
                success: false,
                error: "missing token"
            });
        }

        // TEMP MOCK (replace with Supabase later)
        return res.json({
            success: true,
            token: token,
            sessionId: "temp-session-123"
        });

    } catch (e) {
        return res.json({
            success: false,
            error: e.message
        });
    }
});

// =========================
// END SESSION ROUTE
// =========================
app.post("/api/end-session", async (req, res) => {
    return res.json({
        success: true,
        remaining_seconds: 100,
        used_seconds: 0
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("🚀 Origin Server running on port 3000");
});