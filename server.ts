/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { RIDIALART_DOCTRINE_PROMPT } from "./src/data/ridialartDoctrine.ts";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function isValidGeminiKey(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (
    trimmed.length < 10 ||
    trimmed === "MY_GEMINI_API_KEY" ||
    trimmed === "YOUR_GEMINI_API_KEY" ||
    trimmed.includes("dummy") ||
    trimmed.includes("your_api_key")
  ) {
    return false;
  }
  return true;
}

function extractEffectiveApiKey(req?: express.Request): string | null {
  if (req) {
    const authHeader = req.headers.authorization;
    let keyFromHeader = '';
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        keyFromHeader = authHeader.slice(7).trim();
      } else {
        keyFromHeader = authHeader.trim();
      }
      keyFromHeader = keyFromHeader.replace(/^["']|["']$/g, '').trim();
    }
    const xApiKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].replace(/^["']|["']$/g, '').trim() : '';
    const headerApiKey = typeof req.headers['apiKey'] === 'string' ? (req.headers['apiKey'] as string).replace(/^["']|["']$/g, '').trim() : '';
    const bodyKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.replace(/^["']|["']$/g, '').trim() : '';
    const queryKey = typeof req.query?.apiKey === 'string' ? (req.query.apiKey as string).replace(/^["']|["']$/g, '').trim() : '';

    const candidates = [keyFromHeader, xApiKey, headerApiKey, bodyKey, queryKey];
    for (const candidate of candidates) {
      if (candidate && isValidGeminiKey(candidate)) {
        return candidate;
      }
    }
  }

  if (process.env.GEMINI_API_KEY && isValidGeminiKey(process.env.GEMINI_API_KEY)) {
    return process.env.GEMINI_API_KEY.trim();
  }
  if (process.env.API_KEY && isValidGeminiKey(process.env.API_KEY)) {
    return process.env.API_KEY.trim();
  }
  return null;
}

const serverAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

function getEffectiveAi(effectiveKey: string | null): GoogleGenAI {
  if (effectiveKey && isValidGeminiKey(effectiveKey)) {
    return new GoogleGenAI({
      apiKey: effectiveKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  return serverAi;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: "25mb" }));

  // Auth health check & configuration status
  app.get("/api/auth/status", (req, res) => {
    const effectiveKey = extractEffectiveApiKey(req);
    const serverKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
    const hasServerEnvKey = !!(serverKey && isValidGeminiKey(serverKey));
    res.json({
      hasKey: !!effectiveKey,
      hasServerEnvKey,
      source: effectiveKey ? (effectiveKey === serverKey ? 'server_env' : 'client_request') : 'none'
    });
  });

function cleanTextForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\*{3,}([^*]+)\*{3,}/g, '$1')
    .replace(/\*{2}([^*]+)\*{2}/g, '$1')
    .replace(/\*([^*\n\r]+)\*/g, '$1')
    .replace(/_{2}([^_]+)_{2}/g, '$1')
    .replace(/_([^_\n\r]+)_/g, '$1')
    .replace(/^[\s]*[\*\-•\+]\s+/gm, '')
    .replace(/\*/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

  // TTS API Endpoint with automatic model fallback for quota management
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceName = "Kore", model = "gemini-3.8-flash-lite-tts", style, language, gender, multiSpeaker, speakers } = req.body;
      const sanitizedText = cleanTextForSpeech(text || "");
      const effectiveKey = extractEffectiveApiKey(req);

      if (!effectiveKey) {
        return res.status(200).json({ 
          fallback: true, 
          isKeyError: true, 
          message: "Clé API Gemini non configurée. Lecture vocale via synthèse locale." 
        });
      }
      const effectiveAi = getEffectiveAi(effectiveKey);

      if (!sanitizedText && (!speakers || speakers.length === 0)) {
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
                      text: sanitizedText,
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
      const errMsg = err?.message || "";
      const isKey = errMsg.includes("API key not valid") || errMsg.includes("API_KEY_INVALID") || err.status === 400;
      if (isKey) {
        return res.status(200).json({
          fallback: true,
          isKeyError: true,
          message: "Clé API Gemini non reconnue ou invalide. Utilisation de la voix de synthèse locale."
        });
      }
      const isQuota = err.status === 429 || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
      if (isQuota) {
        return res.status(429).json({ 
          error: "Quota journalier gratuit Gemini atteint. Veuillez patienter ou configurer votre clé API dans les Paramètres." 
        });
      }
      return res.status(200).json({
        fallback: true,
        error: errMsg || "Erreur TTS",
        message: "Lecture vocale locale activée."
      });
    }
  });

  // Server-side Embedding Endpoint for Knowledge Base RAG
  app.post("/api/embed", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: "Text is required for embedding" });
      }

      const effectiveKey = extractEffectiveApiKey(req);
      if (!effectiveKey) {
        return res.json({ embedding: new Array(768).fill(0.1), fallback: true });
      }

      const effectiveAi = getEffectiveAi(effectiveKey);
      const embedModels = ["gemini-embedding-2-preview", "text-embedding-004"];
      let values: number[] | null = null;
      let lastErr: any = null;

      for (const m of embedModels) {
        try {
          const embedRes = await effectiveAi.models.embedContent({
            model: m,
            contents: text.substring(0, 2000),
          });
          const resAny = embedRes as any;
          values = resAny?.embedding?.values || resAny?.embeddings?.[0]?.values || null;
          if (values && values.length > 0) break;
        } catch (e: any) {
          lastErr = e;
        }
      }

      if (!values) {
        console.warn("Embedding API warning, using fallback vector:", lastErr?.message || lastErr);
        return res.json({ embedding: new Array(768).fill(0.1), fallback: true });
      }

      res.json({ embedding: values });
    } catch (err: any) {
      console.error("Embedding server error:", err);
      res.json({ embedding: new Array(768).fill(0.1), fallback: true });
    }
  });

  // Sentiment & Voice Style Analysis Endpoint powered by Gemini Flash
  app.post("/api/sentiment-analysis", async (req, res) => {
    const fallbackResult = {
      sentiment: "Poétique / Méditatif",
      moodEmoji: "✨",
      explanation: "Style poétique et immersif adapté à l'oralité.",
      suggestedDomain: "ridialart",
      suggestedStyleLabel: "Synesthésie Plastique RidiaLArt",
      suggestedStyleVal: "prosodie artistique et synesthésique reliant le verbe à la matière, variations de dynamique, résonance de calebasse et de djembé",
      speechPaceTip: "Tempo modéré avec pauses"
    };

    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: "Text is required for sentiment analysis" });
      }

      const effectiveKey = extractEffectiveApiKey(req);

      if (!effectiveKey) {
        return res.json(fallbackResult);
      }

      const effectiveAi = getEffectiveAi(effectiveKey);

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

7. Domaine "ridialart" (Afrofuturisme Endogène & Oralité Africaine) :
   - Label: "Taasu & Scansion Oratoire"
     Val: "déclamation oratoire scandée dans la tradition du Taasu sénégalais, tempo percutant, verve poétique, assonances rythmées et souffle habité"
   - Label: "Griot & Épopée Ancestrale"
     Val: "voix de griot gardien des récits sacrés, louanges solennelles, voix texturée, habitée par l'oralité et les généalogies"
   - Label: "Synesthésie Plastique RidiaLArt"
     Val: "prosodie artistique et synesthésique reliant le verbe à la matière, variations de dynamique, résonance de calebasse et de djembé"
   - Label: "Dub Roots & Poésie Mystique"
     Val: "déclamation méditative, phrasé profond et posé, présence chaleureuse imprégnée d'écho spatial et de spiritualité"

Texte à analyser :
"""
${text.slice(0, 3000)}
"""

Retourne impérativement un objet JSON strict avec :
- sentiment: "Positif / Enthousiaste" | "Dramatique / Sombre" | "Poétique / Méditatif" | "Éducatif / Explicatif" | "Énergique / Promotionnel" | "Informatif / Neutre" | "Oralité Sacrée / Griot / Taasu"
- moodEmoji: emoji représentatif (ex: 🎭, ✨, 🔥, 📖, ⚡, 🎙️, 🥁)
- explanation: une brève explication (max 1 phrase percutante en français) de pourquoi ce style sublime le texte.
- suggestedDomain: le domaine correspondant exactement ("art" | "cinema" | "education" | "marketing" | "journalism" | "general" | "ridialart")
- suggestedStyleLabel: le label exact du style choisi
- suggestedStyleVal: la valeur textuelle exacte 'val' du style
- speechPaceTip: conseil expressif de tempo ("Tempo modéré avec pauses", "Rythme vif et soutenu", "Scansion cadencée avec silences habités", etc.)`;

      const sentimentModelsChain = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
      let response;

      for (const m of sentimentModelsChain) {
        try {
          response = await effectiveAi.models.generateContent({
            model: m,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          });
          if (response && response.text) break;
        } catch (e: any) {
          const eMsg = e?.message || "";
          if (eMsg.includes("API key not valid") || eMsg.includes("API_KEY_INVALID") || e.status === 400) {
            return res.json(fallbackResult);
          }
        }
      }

      if (!response || !response.text) {
        return res.json(fallbackResult);
      }

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText);
      res.json(parsed);
    } catch (_err: any) {
      res.json(fallbackResult);
    }
  });

  // AI Agent Chat Endpoint powered by Gemini Flash with multi-model fallback chain & media support
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, currentText } = req.body;
      const effectiveKey = extractEffectiveApiKey(req);

      if (!effectiveKey) {
        return res.status(200).json({ 
          reply: "Bonjour ! Pour activer toutes les capacités d'analyse et de génération de scénarios RidiaLArt avec Gemini, veuillez renseigner votre clé API Gemini (gratuite sur aistudio.google.com) dans les Paramètres ⚙️. En attendant, toutes les fonctions du Studio Vocal, des rythmes traditionnels et de la Bibliothèque fonctionnent librement !"
        });
      }
      const effectiveAi = getEffectiveAi(effectiveKey);

      const systemInstruction = `${RIDIALART_DOCTRINE_PROMPT}

Contexte actuel de l'éditeur :
---
${currentText || "(Aucun texte dans l'éditeur pour l'instant)"}
---`;

      const lastMessageObj = messages[messages.length - 1];
      const chatHistory = (messages || []).slice(0, -1).map((m: any) => {
        const parts: any[] = [{ text: m.content || "" }];
        if (m.attachment) {
          parts.push({
            inlineData: {
              mimeType: m.attachment.mimeType,
              data: m.attachment.data
            }
          });
        }
        return {
          role: m.role === 'user' ? 'user' : 'model',
          parts
        };
      });

      const lastParts: any[] = [{ text: lastMessageObj?.content || "Analyse ce média et propose un scénario, des prompts d'images fixes et des prompts Google Flow 9:16." }];
      if (lastMessageObj?.attachment) {
        lastParts.push({
          inlineData: {
            mimeType: lastMessageObj.attachment.mimeType,
            data: lastMessageObj.attachment.data
          }
        });
      }

      // Check if client requested streaming
      const wantsStream = Boolean(req.body?.stream || req.query?.stream === 'true' || req.headers.accept?.includes('text/event-stream'));

      // Automatic fallback chain between fast Gemini models to bypass single-model quota limits
      const chatModelsChain = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
      let result;
      let lastChatError;

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for (const m of chatModelsChain) {
          try {
            const chat = effectiveAi.chats.create({
              model: m,
              config: {
                systemInstruction: systemInstruction,
                temperature: 0.3,
              },
              history: chatHistory,
            });

            const streamResult = await chat.sendMessageStream({ message: lastParts });
            for await (const chunk of streamResult) {
              if (chunk.text) {
                res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
              }
            }
            res.write(`data: [DONE]\n\n`);
            return res.end();
          } catch (e: any) {
            lastChatError = e;
            console.warn(`Streaming chat model ${m} error, trying fallback:`, e?.message);
          }
        }
        res.write(`data: ${JSON.stringify({ error: lastChatError?.message || "Erreur lors du streaming de la réponse" })}\n\n`);
        return res.end();
      }

      for (const m of chatModelsChain) {
        try {
          const chat = effectiveAi.chats.create({
            model: m,
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.3,
            },
            history: chatHistory,
          });

          result = await chat.sendMessage({ message: lastParts });
          if (result && result.text) break; // Success!
        } catch (e: any) {
          lastChatError = e;
          const eMsg = e?.message || "";
          if (eMsg.includes("API key not valid") || eMsg.includes("API_KEY_INVALID") || e.status === 400) {
            return res.status(200).json({ 
              reply: "La clé API Gemini configurée semble invalide ou expirée. Veuillez vérifier votre clé API dans les Paramètres ⚙️ pour réactiver l'Agent IA." 
            });
          }
        }
      }

      if (!result || !result.text) {
        throw lastChatError || new Error("Tous les modèles Gemini ont épuisé leur quota disponible.");
      }

      res.json({ reply: result.text });
    } catch (err: any) {
      console.warn("AI Chat Warning:", err?.message || err);
      const errMsg = err.message || "";
      const isQuota = errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || err.status === 429;
      const isKeyError = errMsg.includes("API key") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("PERMISSION_DENIED");

      let userFriendlyError = "Erreur lors de la communication avec l'agent IA.";
      if (isQuota) {
        userFriendlyError = "Le quota journalier gratuit de l'API Google Gemini est temporairement atteint. Vous pouvez renseigner votre propre clé API Gemini (gratuite sur aistudio.google.com) dans les Paramètres pour continuer immédiatement.";
      } else if (isKeyError) {
        userFriendlyError = "Clé API Gemini invalide ou manquante. Veuillez vérifier votre clé API dans les Paramètres.";
      }

      res.status(200).json({ 
        reply: userFriendlyError,
        isQuota: isQuota
      });
    }
  });


  // Transcribe audio/video endpoint with 100MB video/audio support
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    console.log("Transcribe request received");
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const os = (await import('os')).default;
    
    let tempInputPath = path.join(os.tmpdir(), `input-${Date.now()}`);
    let tempOutputPath = path.join(os.tmpdir(), `output-${Date.now()}.mp3`);

    try {
      const file = req.file;
      console.log("File uploaded:", file ? `${file.originalname} (${(file.size / (1024 * 1024)).toFixed(2)} MB, type: ${file.mimetype})` : "No file");
      
      if (!file) return res.status(400).json({ error: "Aucun fichier téléversé" });

      fs.writeFileSync(tempInputPath, file.buffer);

      // Pre-process audio or video file: extract audio stream into lightweight mono MP3 for transcription
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempInputPath)
          .noVideo() // Demux: strip video stream, isolate audio
          .toFormat('mp3')
          .audioChannels(1)
          .audioBitrate('64k')
          .audioFrequency(16000)
          .on('end', () => resolve())
          .on('error', (err) => {
            console.warn("FFmpeg optimized conversion failed, trying standard fallback:", err.message);
            ffmpeg(tempInputPath)
              .toFormat('mp3')
              .audioChannels(1)
              .audioBitrate('64k')
              .on('end', () => resolve())
              .on('error', reject)
              .save(tempOutputPath);
          })
          .save(tempOutputPath);
      });

      const audioBuffer = fs.readFileSync(tempOutputPath);

      const effectiveKey = extractEffectiveApiKey(req);
      if (!effectiveKey) return res.status(401).json({ error: "Clé API invalide ou absente" });

      const effectiveAi = getEffectiveAi(effectiveKey);

      const transcriptionPrompt = `Tu es un transcripteur professionnel spécialisé dans le sous-titrage vidéo synchronisé.
Transcris fidèlement et intégralement toute la parole détectée dans cet enregistrement (extrait d'une vidéo ou d'un fichier audio).

Structure OBLIGATOIRE de ta réponse :
[TRANSCRIPTION_BRUTE]
<Insère ici la transcription intégrale continue, avec ponctuation, majuscules et orthographe soignées.>

### SRT ###
1
00:00:00,000 --> 00:00:03,500
<Texte premier sous-titre>

2
00:00:03,500 --> 00:00:06,800
<Texte deuxième sous-titre>

RÈGLES SRT STRICTES :
1. Les sous-titres doivent être découpés en segments courts et naturels de 2 à 5 secondes (1 à 2 lignes concises par sous-titre), parfaitement lisibles pour un montage vidéo (formats Reels, YouTube, TikTok, reportage).
2. Respecte scrupuleusement la syntaxe SubRip (.srt) :
   - Index numérique séquentiel (1, 2, 3...)
   - Ligne d'horodatage au format exact : 00:00:00,000 --> 00:00:03,500
   - Ligne(s) de texte du sous-titre
   - Ligne vide de séparation entre chaque bloc
3. Sois le plus précis possible sur les timecodes par rapport au timing réel de la voix dans l'audio.
4. Ne mets aucun texte explicatif en dehors de ces deux blocs.`;

      const transcribeModelsChain = ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"];
      let result;
      let lastErr;

      for (const m of transcribeModelsChain) {
        try {
          result = await effectiveAi.models.generateContent({
            model: m,
            contents: [
              {
                role: "user",
                parts: [
                  { text: transcriptionPrompt },
                  {
                    inlineData: {
                      mimeType: "audio/mp3",
                      data: audioBuffer.toString("base64")
                    }
                  }
                ]
              }
            ]
          });
          if (result && result.text) break;
        } catch (e: any) {
          lastErr = e;
          console.warn(`Transcription error with model ${m}:`, e?.message || e);
        }
      }

      if (!result || !result.text) {
        throw lastErr || new Error("Erreur de transcription via Gemini");
      }

      res.json({ transcription: result.text });
    } catch (err: any) {
      console.error("Transcription error:", err);
      res.status(500).json({ error: "Erreur lors de la transcription du fichier audio/vidéo" });
    } finally {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    }
  });

  // Mix voice and background track endpoint
  const mixUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/mix", mixUpload.fields([{ name: 'voice' }, { name: 'backing' }]), async (req, res) => {
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const os = (await import('os')).default;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files.voice || !files.backing) return res.status(400).json({ error: "Missing audio files" });

    const voicePath = path.join(os.tmpdir(), `voice-${Date.now()}.wav`);
    const backingPath = path.join(os.tmpdir(), `backing-${Date.now()}.wav`);
    const outputPath = path.join(os.tmpdir(), `mix-${Date.now()}.mp3`);

    try {
      fs.writeFileSync(voicePath, files.voice[0].buffer);
      fs.writeFileSync(backingPath, files.backing[0].buffer);

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(voicePath)
          .input(backingPath)
          .complexFilter([
            '[1:a]volume=0.5[a1]', // Backing track volume 50%
            '[0:a][a1]amix=inputs=2:duration=first'
          ])
          .toFormat('mp3')
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });

      const mixBuffer = fs.readFileSync(outputPath);
      res.set('Content-Type', 'audio/mpeg');
      res.send(mixBuffer);
    } catch (err) {
      console.error("Mixing error:", err);
      res.status(500).json({ error: "Erreur lors du mixage" });
    } finally {
      if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath);
      if (fs.existsSync(backingPath)) fs.unlinkSync(backingPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  // Export edited video with voiceover, background music, and burned-in / embedded subtitles
  const videoExportUpload = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 150 * 1024 * 1024 } 
  });
  app.post("/api/export-video", videoExportUpload.fields([
    { name: 'video', maxCount: 1 }, 
    { name: 'voice', maxCount: 1 },
    { name: 'music', maxCount: 1 }
  ]), async (req, res) => {
    console.log("Export video request received");
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const os = (await import('os')).default;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const videoFile = files?.video?.[0];
    const voiceFile = files?.voice?.[0];
    const musicFile = files?.music?.[0];

    if (!videoFile) {
      return res.status(400).json({ error: "Fichier vidéo manquant." });
    }

    const {
      srtContent = '',
      burnSubtitles = 'true',
      originalAudioVolume = '0.0', // '0.0' for replace, '0.2' for ducking background
      voiceVolume = '1.0',
      musicVolume = '0.3',
      subtitleStyle = 'yellow' // 'yellow' | 'classic' | 'afro'
    } = req.body;

    const tempId = Date.now();
    const tempVideoPath = path.join(os.tmpdir(), `in-vid-${tempId}.mp4`);
    const tempVoicePath = voiceFile ? path.join(os.tmpdir(), `in-voice-${tempId}.mp3`) : null;
    const tempMusicPath = musicFile ? path.join(os.tmpdir(), `in-music-${tempId}.mp3`) : null;
    const tempSrtPath = path.join(os.tmpdir(), `sub-${tempId}.srt`);
    const tempOutputPath = path.join(os.tmpdir(), `out-vid-${tempId}.mp4`);

    try {
      fs.writeFileSync(tempVideoPath, videoFile.buffer);

      if (voiceFile && tempVoicePath) {
        fs.writeFileSync(tempVoicePath, voiceFile.buffer);
      }

      if (musicFile && tempMusicPath) {
        fs.writeFileSync(tempMusicPath, musicFile.buffer);
      }

      const shouldBurnSubs = burnSubtitles === 'true' && srtContent && srtContent.trim().length > 0;
      if (shouldBurnSubs) {
        fs.writeFileSync(tempSrtPath, srtContent.trim(), 'utf8');
      }

      await new Promise<void>((resolve, reject) => {
        let command = ffmpeg().input(tempVideoPath);
        let nextInputIdx = 1;
        let voiceInputIdx: number | null = null;
        let musicInputIdx: number | null = null;

        if (tempVoicePath) {
          command = command.input(tempVoicePath);
          voiceInputIdx = nextInputIdx++;
        }
        if (tempMusicPath) {
          command = command.input(tempMusicPath);
          musicInputIdx = nextInputIdx++;
        }

        const origVol = Math.max(0, Math.min(1, parseFloat(originalAudioVolume) || 0));
        const vVol = Math.max(0, Math.min(2, parseFloat(voiceVolume) || 1.0));
        const mVol = Math.max(0, Math.min(2, parseFloat(musicVolume) || 0.3));

        const complexFilters: string[] = [];
        let videoMap = '0:v';

        // 1. Subtitles filter if requested
        if (shouldBurnSubs) {
          let forceStyle = 'Fontname=Arial,Fontsize=18,PrimaryColour=&H0000FFFF,BackColour=&H80000000,BorderStyle=4,Outline=1,Shadow=1,Alignment=2,MarginV=30';
          if (subtitleStyle === 'classic') {
            forceStyle = 'Fontname=Arial,Fontsize=18,PrimaryColour=&H00FFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=1,Shadow=1,Alignment=2,MarginV=30';
          } else if (subtitleStyle === 'afro') {
            forceStyle = 'Fontname=Arial,Fontsize=19,PrimaryColour=&H0033CCFF,BackColour=&H90001030,BorderStyle=4,Outline=2,Shadow=2,Alignment=2,MarginV=30';
          }

          const escapedSrtPath = tempSrtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
          complexFilters.push(`[0:v]subtitles='${escapedSrtPath}':force_style='${forceStyle}'[vsub]`);
          videoMap = '[vsub]';
        }

        // 2. Audio mixing with flexible inputs (original, voiceover, background music)
        const audioTags: string[] = [];
        if (origVol > 0) {
          complexFilters.push(`[0:a]volume=${origVol}[orig_a]`);
          audioTags.push('[orig_a]');
        }
        if (voiceInputIdx !== null) {
          complexFilters.push(`[${voiceInputIdx}:a]volume=${vVol}[voice_a]`);
          audioTags.push('[voice_a]');
        }
        if (musicInputIdx !== null) {
          complexFilters.push(`[${musicInputIdx}:a]volume=${mVol}[music_a]`);
          audioTags.push('[music_a]');
        }

        let audioMap = '0:a?';
        if (audioTags.length === 1) {
          audioMap = audioTags[0];
        } else if (audioTags.length > 1) {
          complexFilters.push(`${audioTags.join('')}amix=inputs=${audioTags.length}:duration=first:dropout_transition=2[mixed_a]`);
          audioMap = '[mixed_a]';
        }

        if (complexFilters.length > 0) {
          command = command.complexFilter(complexFilters);
        }

        command
          .outputOptions([
            `-map ${videoMap}`,
            `-map ${audioMap}`,
            '-c:v libx264',
            '-preset veryfast',
            '-crf 23',
            '-c:a aac',
            '-b:a 192k',
            '-movflags +faststart'
          ])
          .toFormat('mp4')
          .on('start', (cmdLine) => {
            console.log("Running ffmpeg video export:", cmdLine);
          })
          .on('end', () => resolve())
          .on('error', (err) => {
            console.error("FFmpeg video export failed:", err);
            reject(err);
          })
          .save(tempOutputPath);
      });

      const videoBuffer = fs.readFileSync(tempOutputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="voxart-video-edited.mp4"');
      res.send(videoBuffer);
    } catch (err: any) {
      console.error("Video export server error:", err);
      res.status(500).json({ error: "Échec de l'assemblage vidéo et des sous-titres: " + (err?.message || err) });
    } finally {
      if (fs.existsSync(tempVideoPath)) try { fs.unlinkSync(tempVideoPath); } catch {}
      if (tempVoicePath && fs.existsSync(tempVoicePath)) try { fs.unlinkSync(tempVoicePath); } catch {}
      if (tempMusicPath && fs.existsSync(tempMusicPath)) try { fs.unlinkSync(tempMusicPath); } catch {}
      if (fs.existsSync(tempSrtPath)) try { fs.unlinkSync(tempSrtPath); } catch {}
      if (fs.existsSync(tempOutputPath)) try { fs.unlinkSync(tempOutputPath); } catch {}
    }
  });

  // Explicit PWA endpoints to ensure exact MIME types and instant installability
  app.get("/manifest.json", (_req, res) => {

    res.setHeader("Content-Type", "application/json");
    res.sendFile(path.resolve(__dirname, "public/manifest.json"));
  });

  app.get("/manifest.webmanifest", (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.sendFile(path.resolve(__dirname, "public/manifest.webmanifest"));
  });

  app.get("/sw.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.sendFile(path.resolve(__dirname, "public/sw.js"));
  });

  // Setup Vite middleware with HMR disabled to avoid WebSocket disconnects in iframe/proxy
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      allowedHosts: true,
      hmr: false,
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      if (url.pathname === "/api/live" || url.pathname === "/live") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
    } catch (e) {
      console.warn("WebSocket upgrade handling error:", e);
    }
  });

  wss.on("connection", async (clientWs, req) => {
    try {
      const effectiveKey = extractEffectiveApiKey(req as any);
      const effectiveAi = getEffectiveAi(effectiveKey);

      let session: any = null;
      try {
        session = await effectiveAi.live.connect({
          model: "gemini-3.8-live",
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
            },
            systemInstruction: "Tu es l'assistant vocal intelligent et dynamique du studio RidiaLArt & VoxArt. Réponds de façon concise, créative et vivante.",
          },
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              try {
                if (clientWs.readyState !== WebSocket.OPEN) return;
                for (const part of message.serverContent?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                  }
                  if (part.text) {
                    clientWs.send(JSON.stringify({ text: part.text }));
                  }
                }
                if (message.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
              } catch (e) {
                console.warn("Live API websocket message send error:", e);
              }
            },
            onclose: () => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.close();
              }
            },
            onerror: (err) => {
              console.warn("Live API session error:", err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ error: err?.message || "Live API error" }));
              }
            }
          },
        });
      } catch (liveInitErr: any) {
        console.warn("Failed to connect to Gemini Live session:", liveInitErr?.message || liveInitErr);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ error: "Impossible d'initialiser la session Live API Gemini." }));
          clientWs.close();
        }
        return;
      }

      clientWs.on("message", async (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio && session) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else if (parsed.text && session) {
            session.send({
              clientContent: {
                turns: [{ role: "user", parts: [{ text: parsed.text }] }],
                turnComplete: true,
              },
            });
          }
        } catch (msgErr) {
          console.warn("Live API client message parsing error:", msgErr);
        }
      });

      clientWs.on("close", () => {
        try {
          if (session?.close) session.close();
        } catch {}
      });
    } catch (connErr) {
      console.warn("WebSocket Live connection error:", connErr);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    }
  });

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
