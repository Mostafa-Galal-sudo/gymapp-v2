import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini SDK lazily to prevent crashing on startup if key is missing
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined. Please configure it in Settings > Secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Expose API Endpoints first
app.post("/api/ai/coach", async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const systemInstruction = `You are OmniBody AI Coach, an expert fitness trainer, biomechanical coach, and nutrition specialist. 
Provide highly tailored, positive, actionable, science-based fitness and health advice, incorporating the user's specific goals, level, and logged injuries if provided. 
Keep responses concise, formatted cleanly in Markdown, and easy to read. Respond in the language used in the prompt or context (support both English and Arabic).`;

    const response = await getAI().models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { text: `User Profile & Context: ${JSON.stringify(context || {})}` },
        { text: prompt }
      ],
      config: {
        systemInstruction,
      }
    });

    res.json({ response: response.text });
  } catch (err: any) {
    console.error("AI Coach Error:", err);
    res.status(500).json({ error: err.message || "Failed to call Gemini API" });
  }
});

app.post("/api/ai/nutrition", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64" });
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: imageBase64,
      },
    };

    const textPart = {
      text: "Analyze this food image. Provide nutritional estimates and a breakdown of nutrients.",
    };

    const response = await getAI().models.generateContent({
      model: "gemini-2.0-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "English name of the food scanned" },
            nameAr: { type: Type.STRING, description: "Arabic name of the food scanned" },
            category: { type: Type.STRING, description: "Category (e.g., Protein, Dairy, Supermarket, Fruit, Cooked)" },
            calories: { type: Type.NUMBER, description: "Calories per 100g or per serving" },
            protein: { type: Type.NUMBER, description: "Protein in grams" },
            carbs: { type: Type.NUMBER, description: "Carbohydrates in grams" },
            fats: { type: Type.NUMBER, description: "Fats in grams" },
            fiber: { type: Type.NUMBER, description: "Fiber in grams" },
            sodium: { type: Type.NUMBER, description: "Sodium in milligrams" },
            potassium: { type: Type.NUMBER, description: "Potassium in milligrams" },
            servingSize: { type: Type.NUMBER, description: "Serving size in grams or mL" },
            servingUnit: { type: Type.STRING, description: "Serving unit, usually 'g'" },
            analysis: { type: Type.STRING, description: "A short 1-2 sentence nutritional analysis/coach comment about this food" }
          },
          required: ["name", "nameAr", "category", "calories", "protein", "carbs", "fats", "servingSize", "servingUnit", "analysis"]
        },
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    console.error("AI Nutrition Error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze food image" });
  }
});

app.post("/api/ai/workout-analysis", async (req, res) => {
  try {
    const { workoutDetails, context } = req.body;
    const systemInstruction = `You are OmniBody Workout Analyst. You analyze a finished workout session and provide biomechanical feedback, performance insights, sets/reps breakdown, and fatigue-management recommendations. Formulate your comments as brief, professional bullet points in clean Markdown. Translate response into user's preferred language (English or Arabic).`;

    const response = await getAI().models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { text: `User Profile: ${JSON.stringify(context || {})}` },
        { text: `Workout Session Details to analyze: ${JSON.stringify(workoutDetails || {})}` }
      ],
      config: {
        systemInstruction,
      }
    });

    res.json({ analysis: response.text });
  } catch (err: any) {
    console.error("Workout Analysis Error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze workout" });
  }
});

app.post("/api/ai/daily-plan", async (req, res) => {
  try {
    const { userProfile, historyLogs, dayClicked } = req.body;
    const systemInstruction = `You are OmniBody Smart Planner. Generate a single customized daily plan for the day: ${dayClicked || "today"}. 
Provide:
1. Targeted exercises with sets/reps (considering active injuries to avoid straining them).
2. Recommended meal guidelines to meet macro/micro goals.
Formulate the response in clean, concise Markdown, utilizing sections, and support both English and Arabic.`;

    const response = await getAI().models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { text: `User Profile: ${JSON.stringify(userProfile || {})}` },
        { text: `Recent Logs & History: ${JSON.stringify(historyLogs || [])}` }
      ],
      config: {
        systemInstruction,
      }
    });

    res.json({ plan: response.text });
  } catch (err: any) {
    console.error("Daily Plan Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate plan" });
  }
});

// Vite middleware for dev vs prod
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
