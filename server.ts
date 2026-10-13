/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: "25mb" }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // TTS API Endpoint with automatic model fallback for quota management
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceName = "Kore", model = "gemini-3.8-flash-lite-tts", style, language, gender, multiSpeaker, speakers, apiKey: clientApiKey } = req.body;
      const effectiveAi = clientApiKey ? new GoogleGenAI({ apiKey: clientApiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }) : ai;

      if (!text && (!speakers || speakers.length === 0)) {
        return res.status(400).json({ error: "Text or speakers dialogue is required" });
      }

      let response;
      if (multiSpeaker && speakers && Array.isArray(speakers) && speakers.length === 2) {
        response = await effectiveAi.models.generateContent({
          model: "gemini-3.8-flash-tts",
          contents: [
            {
              role: "user",
              parts: speakers.map((s: any) => ({
                text: `${s.name}: ${s.text}`,
                speechMetadata: {
                  speaker: s.name,
                  style: s.style || "Engaging podcast conversation tone",
                },
              })),
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakers.map((s: any) => ({
                  speaker: s.name,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: s.voice || "Kore" },
                  },
                })),
              },
            },
          },
        });
      } else {
        const comprehensiveStyle = [
          language ? `Langue: ${language}` : '',
          gender ? `Timbre: ${gender}` : '',
          style ? `Style: ${style}` : ''
        ].filter(Boolean).join('. ');

        // Automatic fallback chain between Gemini TTS models to bypass single-model quota limits
        const modelsChain = [model || "gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts"];
        const uniqueModels = Array.from(new Set(modelsChain));

        let lastError;
        for (const m of uniqueModels) {
          try {
            response = await effectiveAi.models.generateContent({
              model: m,
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: text,
                      speechMetadata: comprehensiveStyle ? { style: comprehensiveStyle } : undefined,
                    },
                  ],
                },
              ],
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName || "Kore" },
                  },
                },
              },
            });
            break; // Success!
          } catch (e: any) {
            lastError = e;
            console.warn(`Model ${m} encountered error/quota limit, trying fallback model...`, e.message);
          }
        }

        if (!response) {
          throw lastError || new Error("All Gemini TTS models exhausted quota.");
        }
      }

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("No audio data returned from Gemini TTS engine.");
      }

      res.json({ audio: base64Audio });
    } catch (err: any) {
      console.error("TTS Error:", err);
      const isQuota = err.status === 429 || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("quota");
      const statusCode = isQuota ? 429 : 500;
      res.status(statusCode).json({ 
        error: isQuota 
          ? "Quota dépassé (Free tier limit reached for all Gemini TTS models). Veuillez patienter ou vérifier vos détails de facturation sur ai.google.dev." 
          : (err.message || "Failed to generate speech audio") 
      });
    }
  });

  // Sentiment & Voice Style Analysis Endpoint powered by Gemini Flash
  app.post("/api/sentiment-analysis", async (req, res) => {
    try {
      const { text, apiKey: clientApiKey } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: "Text is required for sentiment analysis" });
      }

      const effectiveAi = clientApiKey
        ? new GoogleGenAI({ apiKey: clientApiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } })
        : ai;

      const prompt = `Tu es un expert ingénieur du son et directeur artistique vocal pour VoxArt (Studio RidiaLArt-Vision).
Analyse minutieusement la tonalité, le sentiment, les émotions et le rythme du texte ci-dessous pour recommander la configuration de style vocal la plus percutante.

Options de styles disponibles dans VoxArt :
1. Domaine "art" :
   - Label: "Poétique & Rythmé (Synesthésique)"
     Val: "prosodie artistique et musicale, variations de rythme, pauses expressives, grande chaleur humaine et phrasé vibrant"
   - Label: "Conte Traditionnel / Griot"
     Val: "interprétation de conteur traditionnel, voix vivante, imagée, chaleureuse, habitée par l'oralité et le souffle"
   - Label: "Slam & Performance Urbaine"
     Val: "déclamation scandée, percutante, pleine d'énergie, de nuances et d'émotion brute"

2. Domaine "cinema" :
   - Label: "Voix Off Documentaire / Court-métrage"
     Val: "voix de cinéma immersive, texturée, grave, posée et chargée d'émotion narrative"
   - Label: "Dramatique & Intense"
     Val: "tension dramatique palpable, intonation profonde, mystérieuse et captivante"

3. Domaine "education" :
   - Label: "Narratif & Pédagogique"
     Val: "voix claire, bienveillante, chaleureuse et très expressive"

4. Domaine "marketing" :
   - Label: "Pub & Podcast Dynamique"
     Val: "ton enthousiaste, accrocheur, moderne, vivant et percutant"
   - Label: "Corporate Élégant"
     Val: "voix posée, professionnelle, inspirante et convaincante"

5. Domaine "journalism" :
   - Label: "Reportage & Récit"
     Val: "ton journalistique vivant, incarné, sérieux mais doté d'une vraie présence humaine"

6. Domaine "general" :
   - Label: "Naturel & Expressif"
     Val: "voix naturelle, humaine, chaleureuse et équilibrée"

Texte à analyser :
"""
${text.slice(0, 3000)}
"""

Retourne impérativement un objet JSON strict avec :
- sentiment: "Positif / Enthousiaste" | "Dramatique / Sombre" | "Poétique / Méditatif" | "Éducatif / Explicatif" | "Énergique / Promotionnel" | "Informatif / Neutre"
- moodEmoji: emoji représentatif (ex: 🎭, ✨, 🔥, 📖, ⚡, 🎙️)
- explanation: une brève explication (max 1 phrase percutante en français) de pourquoi ce style sublime le texte.
- suggestedDomain: le domaine correspondant exactement ("art" | "cinema" | "education" | "marketing" | "journalism" | "general")
- suggestedStyleLabel: le label exact du style choisi
- suggestedStyleVal: la valeur textuelle exacte 'val' du style
- speechPaceTip: conseil expressif de tempo ("Tempo modéré avec pauses", "Rythme vif et soutenu", "Prosodie lente et solennelle", etc.)`;

      const response = await effectiveAi.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (err: any) {
      console.warn("Gemini Sentiment Analysis API error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze sentiment" });
    }
  });

  // Setup Vite middleware
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
