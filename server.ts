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
