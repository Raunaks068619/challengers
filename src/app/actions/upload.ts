'use server'

import { supabaseAdmin } from "@/lib/supabase-admin";

export async function uploadImageAction(formData: FormData) {
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const bucket = formData.get('bucket') as string || 'challengers';
    const path = formData.get('path') as string || 'avatars';

    if (!file || !userId) {
        throw new Error("Missing file or userId");
    }

    if (!supabaseAdmin) {
        throw new Error("Server configuration error: Admin Client initialization failed");
    }

    try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${userId}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(filePath, buffer, {
                contentType: file.type || 'image/png',
                upsert: true
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            throw new Error(error.message);
        }

        const { data } = supabaseAdmin.storage
            .from(bucket)
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error: any) {
        console.error("Upload Action Error:", error);
        throw new Error(error.message || "Failed to upload image");
    }
}
