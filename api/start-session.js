import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {

    try {

        console.log("🟢 START SESSION HIT");

        const decartApiKey =
            process.env.DECART_API_KEY;

        if (!decartApiKey) {

            console.log("❌ Missing DE CART key");

            return res.status(500).json({
                success: false,
                message: "Missing DE CART key"
            });
        }

        // ====================================
        // CREATE SHORT-LIVED CLIENT TOKEN
        // ====================================

        const decartResponse = await fetch(
            "https://api.decart.ai/v1/client/tokens",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": decartApiKey
                },

                body: JSON.stringify({

                    expiresIn: 60,

                    allowedModels: [
                        "lucy-2"
                    ],

                    constraints: {
                        realtime: {
                            maxSessionDuration: 60
                        }
                    }
                })
            }
        );

        const decartJson =
            await decartResponse.json();

        console.log(
            "🧠 DE CART RESPONSE:",
            decartJson
        );

        if (!decartResponse.ok) {

            return res.status(500).json({
                success: false,
                message: "Failed creating token"
            });
        }

        return res.json({

            success: true,

            decartToken:
                decartJson.apiKey
        });

    } catch (err) {

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