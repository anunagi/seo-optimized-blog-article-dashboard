import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set");
}

const genAI = new GoogleGenerativeAI(apiKey || "dummy-key");

export async function generateCompletion(prompt: string, modelName: string = "gemini-2.0-flash"): Promise<string> {
    if (!apiKey) {
        console.warn("Skipping generation: GEMINI_API_KEY missing");
        return "";
    }

    try {
        const model = genAI.getGenerativeModel({ model: modelName });

        // Gemini expects a simple string or parts.
        // We can add system instruction if needed, but for now let's keep it simple.
        // Note: System instructions are supported in newer models, but we can also just prepend to prompt.

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return text || "";
    } catch (error) {
        console.error("Gemini generation error:", error);
        throw error;
    }
}
