import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
const app = express();
app.use(cors());
app.use(express.json());

// ======================================
// SUPABASE (REAL PROD CONFIG)
// ======================================
const supabase = createClient(
    "https://ouvdvweltkgsldcufuyv.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dmR2d2VsdGtnc2xkY3VmdXl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg4MTY0NCwiZXhwIjoyMDkwNDU3NjQ0fQ.SlUn9QTre3UZV4DMsBHaob5bLAl3Hn55nVmgbjl3x8E",
    {
        realtime: {
            transport: ws
        }
    }
);
// ======================================
// HARD TEST USER (same as prod)
// ======================================
const USER_ID = "47db905a-6207-4b7c-bd4e-84842e000477";
const DEBIT = 20;

// ======================================
// SIMULATED END SESSION (PROD EXACT COPY)
// ======================================
app.post("/api/end-session", async (req, res) => {

    console.log("\n🔥 END SESSION TRIGGERED");
    console.log("BODY:", req.body);

    try {

        const userId = req.body.userId || USER_ID;

        console.log("➡️ USER ID:", userId);

        // =========================
        // FETCH USER
        // =========================
        const { data: user, error: fetchError } = await supabase
            .from("users")
            .select("remaining_seconds")
            .eq("id", userId)
            .single();

        console.log("FETCH RESULT:", { user, fetchError });

        if (fetchError || !user) {
            return res.json({
                success: false,
                step: "fetch",
                error: fetchError?.message
            });
        }

        const before = user.remaining_seconds;
        const after = Math.max(0, before - DEBIT);

        console.log("💡 CALC:", { before, after });

        // =========================
        // UPDATE USER
        // =========================
        const { data: updated, error: updateError } = await supabase
            .from("users")
            .update({
                remaining_seconds: after,
                updated_at: new Date().toISOString()
            })
            .eq("id", userId)
            .select("*");

        console.log("UPDATE RESULT:", { updated, updateError });

        if (updateError) {
            return res.json({
                success: false,
                step: "update",
                error: updateError.message
            });
        }

        console.log("💰 DEBIT SUCCESS");

        return res.json({
            success: true,
            before,
            debited: DEBIT,
            after
        });

    } catch (err) {

        console.log("❌ CRASH:", err.message);

        return res.json({
            success: false,
            error: err.message
        });
    }
});

// ======================================
app.listen(5050, () => {
    console.log("🚀 LOCAL PROD SIMULATOR RUNNING");
    console.log("POST http://localhost:5050/api/end-session");
});