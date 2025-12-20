"use server";

import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAvatarAction(userDescription: string) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key is not configured");
    }

    try {
        const stylePrompt = `A high-quality 3D CGI render in the distinct style of an Apple Memoji. The image is a head and shoulders portrait of a custom avatar designed based on the specific following details: ${userDescription} . The lighting is clean, soft studio lighting. The textures are smooth, polished, and cartoonish. The background is a clean, solid, neutral color.`;

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: stylePrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            response_format: "b64_json", // Get base64 to avoid temporary URL issues
        });

        if (!response.data || response.data.length === 0) {
            throw new Error("No image data returned from OpenAI");
        }
        const image = response.data[0];
        if (!image.b64_json) {
            throw new Error("Failed to generate image data");
        }

        return `data:image/png;base64,${image.b64_json}`;
    } catch (error: any) {
        console.error("Avatar generation error:", error);
        throw new Error(error.message || "Failed to generate avatar");
    }
}

export async function generateVisualDescriptionAction(bio: string, name: string) {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API Key is not configured");
    }

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert character designer. Create a short, concise physical visual description (max 30 words) for a 3D avatar's face based on the user's bio and name. Focus ONLY on facial features, hair, and head accessories (glasses, hats). Do not describe clothing below the neck. Infer facial traits, style, and vibe. Return ONLY the visual description."
                },
                {
                    role: "user",
                    content: `Name: ${name}\nBio: ${bio}`
                }
            ],
            model: "gpt-4o",
        });

        return completion.choices[0].message.content || "";
    } catch (error: any) {
        console.error("Visual description error:", error);
        throw new Error("Failed to generate description from bio");
    }
}
