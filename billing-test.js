import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";


const app = express();
app.use(cors());
app.use(express.json());

// ===============================
// SUPABASE DIRECT CLIENT
// ===============================
const supabase = createClient(
    "https://ouvdvweltkgsldcufuyv.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dmR2d2VsdGtnc2xkY3VmdXl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg4MTY0NCwiZXhwIjoyMDkwNDU3NjQ0fQ.SlUn9QTre3UZV4DMsBHaob5bLAl3Hn55nVmgbjl3x8E",
    {
        realtime: {
            transport: ws
        }
    }
);

// ===============================
// HARD TEST USER
// ===============================
const USER_ID = "47db905a-6207-4b7c-bd4e-84842e000477";
const DEBIT = 20;

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
    res.send(`
        <h2>Billing Test Server Running</h2>
        <a href="/test-debit">Run Debit Test</a>
    `);
});

// ===============================
// MAIN TEST ENDPOINT
// ===============================
app.get("/test-debit", async (req, res) => {
    try {
        console.log("\n🔥 TEST START");

        // STEP 1: FETCH USER
        const { data: user, error: getError } = await supabase
            .from("users")
            .select("*")
            .eq("id", USER_ID)
            .single();

        if (getError) {
            console.log("❌ FETCH ERROR:", getError.message);

            return res.json({
                success: false,
                step: "fetch",
                error: getError.message
            });
        }

        console.log("✅ USER FOUND:", user);

        // STEP 2: CALCULATE
        const before = user.remaining_seconds;
        const after = Math.max(0, before - DEBIT);

        // STEP 3: UPDATE
        const { data: updated, error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: after,
                updated_at: new Date().toISOString()
            })
            .eq("id", USER_ID)
            .select("*");

        if (updateError) {
            console.log("❌ UPDATE ERROR:", updateError.message);

            return res.json({
                success: false,
                step: "update",
                error: updateError.message
            });
        }

        console.log("💰 DEBIT SUCCESS");

        console.log({
            before,
            debited: DEBIT,
            after
        });

        return res.json({
            success: true,
            before,
            debited: DEBIT,
            after,
            updated
        });

    } catch (err) {
        console.log("❌ SERVER CRASH:", err.message);

        return res.json({
            success: false,
            error: err.message
        });
    }
});

// ===============================
const PORT = 5050;

app.listen(PORT, () => {
    console.log(`🚀 Billing test running on http://localhost:${PORT}`);
});