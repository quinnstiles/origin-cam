import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        console.log("🟢 START SESSION HIT");

        const { token } = req.body;

        // =========================
        // VALIDATE TOKEN
        // =========================
        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Missing token"
            });
        }

        let userId;

        try {
            const payload = JSON.parse(
                Buffer.from(token.split(".")[1], "base64").toString()
            );

            userId = payload.sub;
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid token"
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "Missing userId"
            });
        }

        // =========================
        // DE CART KEY
        // =========================
        const decartApiKey = process.env.DECART_API_KEY;

        if (!decartApiKey) {
            return res.status(500).json({
                success: false,
                message: "Missing Decart API key"
            });
        }

        // =========================
        // CREATE DECART TOKEN ONLY
        // =========================
        const decartResponse = await fetch(
            "https://api.decart.ai/v1/client/tokens",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": decartApiKey
                },
                body: JSON.stringify({
                    expiresIn: 120,
                    allowedModels: ["lucy-2"]
                })
            }
        );

        const decartJson = await decartResponse.json();

        console.log("🧠 DE CART RESPONSE:", decartJson);

        if (!decartResponse.ok || !decartJson.apiKey) {
            return res.status(500).json({
                success: false,
                message: "Failed to create Decart token"
            });
        }

        // =========================
        // RETURN ONLY TOKEN
        // =========================
        return res.json({
            success: true,
            decartToken: decartJson.apiKey
        });

    } catch (err) {
        console.log("❌ START ERROR:", err.message);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;