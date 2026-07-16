import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.post("/api/ai-summary", async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "No API key configured." });
      }
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const { materials } = req.body;
      
      const prompt = `Actúa como un asistente inteligente de logística y almacén. Aquí está la lista actual de materiales de la empresa MCI:
${JSON.stringify(materials, null, 2)}
      
Instrucciones:
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
        model: "gemini-2.5-flash",
        contents: prompt
      });

      res.json({ summary: response.text });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "No se pudo generar el reporte con IA en este momento." });
    }
  });

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

startServer();
