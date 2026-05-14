import express from "express";
import cors from "cors";

import authRoute from "./api/auth.js";
import startSessionRoute from "./api/start-session.js";
import endSessionRoute from "./api/end-session.js";

const app = express();

// =========================
// MUST BE FIRST
// =========================
app.use(cors());
app.use(express.json()); // 🔥 MUST BE HERE BEFORE ROUTES

// =========================
// ROUTES
// =========================
app.use("/api/auth", authRoute);
app.use("/api/start-session", startSessionRoute);
app.use("/api/end-session", endSessionRoute);

app.get("/", (req, res) => {
    res.json({ success: true, message: "Origin Server Online" });
});

app.listen(3000, () => {
    console.log("🚀 Origin Server running on port 3000");
});