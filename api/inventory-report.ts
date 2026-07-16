import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "No API key configured." });
    }

    const { materials } = req.body;
    
    if (!materials || !Array.isArray(materials)) {
      return res.status(400).json({ error: "Invalid materials data" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `Eres un experto analista de inventarios de logística.
Analiza la siguiente lista de materiales y su estado actual:
${JSON.stringify(materials, null, 2)}

Tu objetivo es dar un resumen para el equipo de almacén.
Sigue estas reglas:
- Comienza el mensaje saludando explícitamente al "equipo MCI".
- Genera un resumen directo, profesional pero amigable del inventario.
- Resalta qué cosas están Agotadas o Por agotarse, pidiendo atención inmediata.
- Incluye explícitamente una sección llamada "Sugerencias de Compra" donde recomiendes qué materiales deberían comprarse pronto, basándote en la tasa de agotamiento actual (estado "Agotado" y "Por agotarse").
- Menciona brevemente lo que está en buen estado ("Hay").
- Usa de 1 a 3 párrafos y listas viñetas para las sugerencias.
- Usa negritas (Markdown **) para resaltar los nombres de los materiales y estados importantes.
- Usa emojis industriales/logísticos para mejor formato visual.
- Si no hay materiales, menciona que el inventario está vacío de forma educada.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.status(200).json({ summary: response.text });
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "No se pudo contactar a la inteligencia artificial." });
  }
}
