"use server";

import { openai } from "@/lib/openai";

export async function generateChallengeFromAI(prompt: string) {
    if (!process.env.OPENAI_API_KEY) {
        // Mock response for development if no key
        // return {
        //   title: "Morning Run",
        //   description: "Run every morning at 5 AM",
        //   depositAmount: 500,
        //   durationDays: 30,
        //   timeWindowStart: "05:00",
        //   timeWindowEnd: "06:00",
        //   allowedDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        // };
        throw new Error("OpenAI API Key not configured");
    }

    const systemPrompt = `
    You are a helpful assistant that generates challenge details from natural language.
    The user will describe a challenge (e.g., "Run 5km every morning at 5am for a month").
    You must return a JSON object with the following fields:
    - title: Short catchy title
    - description: Detailed description
    - depositAmount: Number (default 500 if not specified)
    - durationDays: Number of days
    - timeWindowStart: "HH:MM" (24h format)
    - timeWindowEnd: "HH:MM" (24h format)
    - allowedDays: Array of strings ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] (exclude if user says "weekdays only" etc)
    
    Current Date: ${new Date().toISOString()}
    
    Return ONLY the JSON.
  `;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
        });

        const content = response.choices[0].message.content;
        // Try to parse JSON
        const cleanContent = content?.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanContent || "{}");
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw new Error("Failed to generate challenge. Please try again.");
    }
}
