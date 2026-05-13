import express from "express";

const app = express();
app.use(express.json());

// TEST ROUTE (IMPORTANT)
app.get("/", (req, res) => {
    res.send("Origin Server Alive");
});

// START SESSION
app.post("/api/start-session", (req, res) => {
    const { token } = req.body;

    console.log("START SESSION HIT:", token);

    return res.json({
        success: true,
        token,
        sessionId: "session_" + Date.now()
    });
});

// END SESSION
app.post("/api/end-session", (req, res) => {
    return res.json({
        success: true,
        remaining_seconds: 120,
        used_seconds: 0
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("🚀 Server running on", PORT);
});