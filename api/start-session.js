import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        console.log(
            "🟢 SIMPLE START SESSION HIT"
        );

        // ====================================
        // GET TOKEN
        // ====================================

        const { token } = req.body;

        if (!token) {

            return res.status(400).json({
                success: false,
                message: "Missing token"
            });
        }

        // ====================================
        // CREATE DE CART TOKEN
        // ====================================

        const decartResponse = await fetch(
            "https://api.decart.ai/v1/client/tokens",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "x-api-key":
                        process.env.DECART_API_KEY
                },

                body: JSON.stringify({

                    expiresIn: 60,

                    allowedModels: [
                        "lucy-2"
                    ]
                })
            }
        );

        const decartJson =
            await decartResponse.json();

        console.log(
            "🧠 DE CART RESPONSE:",
            decartJson
        );

        if (
            !decartResponse.ok ||
            !decartJson?.apiKey
        ) {

            return res.status(500).json({
                success: false,
                message:
                    "Failed creating DE CART token"
            });
        }

        // ====================================
        // SUCCESS
        // ====================================

        return res.json({

            success: true,

            sessionId:
                `session_${Date.now()}`,

            sessionDuration: 60,

            decartToken:
                decartJson.apiKey
        });

    }
    catch (err) {

        console.log(
            "❌ START SESSION ERROR:",
            err.message
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

export default router;