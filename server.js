import express from "express";
import start from "./api/start-session.js";
import heartbeat from "./api/heartbeat.js";
import end from "./api/end-session.js";

const app = express();
app.use(express.json());

app.post("/api/start-session", start);
app.post("/api/heartbeat", heartbeat);
app.post("/api/end-session", end);

const PORT = 8080;

app.listen(PORT, () => {
    console.log("🚀 Server running on", PORT);
});