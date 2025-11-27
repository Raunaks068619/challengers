import { createClient } from "@supabase/supabase-js";
import { auth } from "./firebase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        accessToken: async () => {
            const token = await auth.currentUser?.getIdToken();
            return token || '';
        },
    }
);