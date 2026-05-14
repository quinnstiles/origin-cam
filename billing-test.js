import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import dotenv from "dotenv";
dotenv.config();
// =====================================================
// SUPABASE CLIENT (SERVICE ROLE ONLY)
// =====================================================

console.log("ENV CHECK:", {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY
});

const supabase = createClient(
    "https://ouvdvweltkgsldcufuyv.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dmR2d2VsdGtnc2xkY3VmdXl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg4MTY0NCwiZXhwIjoyMDkwNDU3NjQ0fQ.SlUn9QTre3UZV4DMsBHaob5bLAl3Hn55nVmgbjl3x8E",
    {
        realtime: {
            transport: ws
        }
    }
);

// HARD CODE USER (FOR TESTING ONLY)
const USER_ID = "47db905a-6207-4b7c-bd4e-84842e000477";

// =====================================================
// END SESSION TEST = SUBTRACT 20
// =====================================================
async function endSessionTest() {
    console.log("\n🔥 TEST START");

    // 1. GET USER
    const { data: user, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", USER_ID)
        .single();

    if (fetchError || !user) {
        console.log("❌ USER NOT FOUND", fetchError?.message);
        return;
    }

    console.log("✅ USER FOUND:", user);

    const before = user.remaining_seconds;
    const debited = 20;
    const after = Math.max(0, before - debited);

    // 2. UPDATE USER
    const { error: updateError } = await supabase
        .from("users")
        .update({
            remaining_seconds: after,
            updated_at: new Date().toISOString()
        })
        .eq("id", USER_ID);

    if (updateError) {
        console.log("❌ UPDATE FAILED:", updateError.message);
        return;
    }

    console.log("💰 DEBIT SUCCESS");
    console.log({ before, debited, after });
}

endSessionTest();