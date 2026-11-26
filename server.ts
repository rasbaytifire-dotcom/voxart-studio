/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
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
  apiVersion: "v1beta",
  httpOptions: {
    apiVersion: "v1beta",
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

function getEffectiveAi(effectiveKey: string | null): GoogleGenAI {
  if (effectiveKey && isValidGeminiKey(effectiveKey)) {
    return new GoogleGenAI({
      apiKey: effectiveKey,
      apiVersion: "v1beta",
      httpOptions: {
        apiVersion: "v1beta",
        headers: { 'User-Agent': 'aistudio-build' }
      }
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

  // App version and live update verification endpoint
  const APP_VERSION = "3.0.0";
  const APP_RELEASE_TIME = Date.now();
  app.get("/api/version", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      version: APP_VERSION,
      releaseTime: APP_RELEASE_TIME,
      name: "VoxArt Studio",
      timestamp: Date.now()
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
    .replace(/\[(?:respiration|souffle)\]/gi, '... ')
    .replace(/\[(?:pause|silence)(?:\s*\d+s?)?\]/gi, '... — ... ')
    .replace(/\[\/?(?:emphase|crescendo|murmure|ralentir|accelerando|fort|doux)\]/gi, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
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
      const { text, voiceName = "Kore", model = "gemini-3.8-flash-lite-tts", style, customVoiceStyle, language, gender, multiSpeaker, speakers } = req.body;
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

      const serverEnvKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
      const canFallbackToServerEnv = !!(serverEnvKey && isValidGeminiKey(serverEnvKey) && effectiveKey !== serverEnvKey);
      const runWithKeyFallback = async (fn: (client: GoogleGenAI) => Promise<any>) => {
        try {
          return await fn(effectiveAi);
        } catch (err: any) {
          const msg = err?.message || String(err || "");
          const isBadKey = msg.includes("API key not valid") || msg.includes("API_KEY_INVALID");
          if (isBadKey && canFallbackToServerEnv) {
            console.warn("Client API key invalid on /api/tts, falling back to server GEMINI_API_KEY.");
            return await fn(serverAi);
          }
          throw err;
        }
      };

      let response;
      if (multiSpeaker && speakers && Array.isArray(speakers) && speakers.length === 2) {
        response = await runWithKeyFallback((client) =>
          client.models.generateContent({
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
          })
        );
      } else {
        const cleanCustomStyle = typeof customVoiceStyle === 'string' ? customVoiceStyle.trim() : '';
        const comprehensiveStyle = [
          language ? `Langue: ${language}` : '',
          gender ? `Timbre: ${gender}` : '',
          cleanCustomStyle ? `Empreinte vocale personnalisée (Voice Design): ${cleanCustomStyle}` : '',
          style && (!cleanCustomStyle || !cleanCustomStyle.includes(style)) ? `Style contextuel: ${style}` : ''
        ].filter(Boolean).join('. ');

        // When a custom Voice Design directive is provided, prefer gemini-3.8-flash-tts first
        const preferredModel = cleanCustomStyle
          ? "gemini-3.8-flash-tts"
          : (model || "gemini-3.8-flash-lite-tts");
        const fallbackModel = preferredModel === "gemini-3.8-flash-tts"
          ? "gemini-3.8-flash-lite-tts"
          : "gemini-3.8-flash-tts";
        const modelsChain = [preferredModel, fallbackModel];
        const uniqueModels = Array.from(new Set(modelsChain));

        let lastError;
        for (const m of uniqueModels) {
          try {
            response = await runWithKeyFallback((client) =>
              client.models.generateContent({
                model: m,
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: sanitizedText,
                        ...(comprehensiveStyle ? { speechMetadata: { style: comprehensiveStyle } } : {}),
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
              })
            );
            break; // Success!
          } catch (e: any) {
            lastError = e;
            console.warn(`Model ${m} encountered error/quota limit, trying fallback model...`, e?.message || e);
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
      const errMsg = err?.message || String(err || "");
      console.error("TTS endpoint error:", err?.status, errMsg);
      const isKey =
        errMsg.includes("API key not valid") ||
        errMsg.includes("API_KEY_INVALID") ||
        errMsg.includes("API key should be set");
      if (isKey) {
        return res.status(200).json({
          fallback: true,
          isKeyError: true,
          error: errMsg,
          message: "Clé API Gemini non reconnue ou invalide. Utilisation de la voix de synthèse locale."
        });
      }
      const isQuota = err?.status === 429 || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
      if (isQuota) {
        return res.status(429).json({ 
          error: "Quota journalier gratuit Gemini atteint. Veuillez patienter ou configurer votre clé API dans les Paramètres." 
        });
      }
      return res.status(200).json({
        fallback: true,
        error: errMsg || "Erreur TTS",
        message: "Erreur de synthèse vocale Gemini. Lecture vocale locale activée."
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
          if (eMsg.includes("API key not valid") || eMsg.includes("API_KEY_INVALID")) {
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

  // AI Agent Chat Endpoint powered by Gemini with multi-model fallback chain, literary expert mode & media support
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, currentText, mode, literaryContext } = req.body;
      const effectiveKey = extractEffectiveApiKey(req);

      if (!effectiveKey) {
        return res.status(200).json({ 
          reply: mode === 'literary_expert'
            ? "Pour activer l'Assistant Expert en Littérature & Création Poétique avec Gemini, veuillez configurer votre clé API Gemini dans les Paramètres ⚙️ (ou dans Settings > Secrets). Vous pouvez néanmoins utiliser librement l'éditeur de slam, le compteur de temps de parole et les marqueurs scéniques."
            : "Bonjour ! Pour activer toutes les capacités d'analyse et de génération de scénarios RidiaLArt avec Gemini, veuillez renseigner votre clé API Gemini (gratuite sur aistudio.google.com) dans les Paramètres ⚙️. En attendant, toutes les fonctions du Studio Vocal, des rythmes traditionnels et de la Bibliothèque fonctionnent librement !"
        });
      }
      const effectiveAi = getEffectiveAi(effectiveKey);

      const isLiteraryExpert = mode === 'literary_expert';
      const reqCadence = Number(literaryContext?.cadenceWpm);
      const validCadence = Number.isFinite(reqCadence) && reqCadence >= 60 && reqCadence <= 240 ? Math.round(reqCadence) : 0;
      const reqTargetDur = Number(literaryContext?.targetDurationSec);
      const validTargetDur = Number.isFinite(reqTargetDur) && reqTargetDur >= 5 && reqTargetDur <= 600 ? Math.round(reqTargetDur) : 0;
      const targetSpokenWords =
        validTargetDur > 0
          ? Math.max(10, Math.round((validTargetDur / 60) * (validCadence || 130) * 0.86))
          : 0;

      const ctxDetails = literaryContext && typeof literaryContext === 'object'
        ? [
            literaryContext.movement ? `Courant artistique/littéraire visé : ${literaryContext.movement}` : '',
            literaryContext.form ? `Forme poétique / style : ${literaryContext.form}` : '',
            literaryContext.language ? `Langue / registre : ${literaryContext.language}` : '',
            validCadence > 0 ? `Cadence de déclamation ciblée : ~${validCadence} mots/minute` : '',
            validTargetDur > 0
              ? `Durée audio cible stricte : ~${validTargetDur} secondes. Calibre impérativement le poème autour de ${Math.max(8, Math.round(targetSpokenWords * 0.9))} à ${Math.round(targetSpokenWords * 1.1)} mots parlés au total (hors balises entre crochets) avec des vers courts et percutants (6 à 11 mots par ligne pour un affichage lisible en sous-titres smartphone 9:16).`
              : '',
            typeof literaryContext.includeMarkers === 'boolean'
              ? `Inclure les marqueurs scéniques VoxArt ([respiration], [pause], [silence 2s], [emphase]...[/emphase], [crescendo]...[/crescendo], [murmure]...[/murmure]) : ${literaryContext.includeMarkers ? 'OUI' : 'NON'}`
              : '',
          ].filter(Boolean).join('\n')
        : '';

      const LITERARY_POETRY_EXPERT_PROMPT = `Tu es le Maître Littéraire & Poète Expert de VoxArt Studio.
Tu possèdes une érudition encyclopédique et une pratique vivante de :
1. **L'Histoire de la Littérature et des Courants Artistiques** : Antiquité gréco-romaine et égyptienne, Poésie médiévale (troubadours, chansons de geste), Renaissance & Pléiade (Ronsard, Du Bellay), Baroque & Classicisme (Racine, La Fontaine), Lumières, Romantisme (Hugo, Lamartine, Musset), Parnasse, Symbolisme (Baudelaire, Verlaine, Rimbaud, Mallarmé), Surréalisme & Dada (Breton, Éluard, Desnos), Harlem Renaissance (Langston Hughes), Négritude & Oralité Africaine (Léopold Sédar Senghor, Aimé Césaire, Léon-Gontran Damas, Birago Diop, tradition des Griots et dyéli d'Afrique de l'Ouest), Beat Generation (Ginsberg, Kerouac), Spoken Word & Slam contemporain (Marc Kelly Smith, Grand Corps Malade, Abd al Malik, Souleymane Diamanka, Gaël Faye), ainsi que l'Afrofuturisme poétique et la pensée RidiaLArt.
2. **La Prosodie, la Métrique et l'Art de l'Écriture** : alexandrin (césure à l'hémistiche 6/6), décasyllabe, octosyllabe, sonnet, ballade, pantoum, haïku, ode, élégie, vers libre, prose poétique, rimes (plates, croisées, embrassées, riches/suffisantes/pauvres), figures de style (anaphore, métaphore filée, allitération, assonance, chiasme, oxymore, hypotypose, prétérition), rythme respiratoire et musicalité orale.
3. **L'Interprétation Scénique, Cadence & Durée** : Tu sais sculpter ou adapter des textes destinés à être déclamés à voix haute avec un débit précis (de 105 à 180 mots/min) et calibrés exactement sur une durée cible (ex. 15s, 30s, 60s). Lorsque l'utilisateur souhaite des repères d'interprétation ou écrit pour le studio Slam/Vocal, tu intègres avec finesse les marqueurs scéniques VoxArt : \`[respiration]\`, \`[pause]\`, \`[silence 2s]\`, \`[emphase]...[/emphase]\`, \`[crescendo]...[/crescendo]\`, \`[murmure]...[/murmure]\`, \`[ralentir]...[/ralentir]\`, et \`—\` (césure).

Règles de réponse :
- Réponds toujours en français (sauf si l'utilisateur demande une autre langue comme l'anglais ou le wolof, ou un poème bilingue).
- Sois précis, cultivé, inspirant et pédagogique quand on te demande l'histoire d'un courant, une analyse stylistique, des rimes ou des conseils d'écriture.
- Dès que tu crées, réécris ou adaptes un poème / texte de slam prêt à être récité, place IMPÉRATIVEMENT le texte final du poème seul dans un bloc de code balisé \`\`\`poeme\n...\n\`\`\` (sans commentaire à l'intérieur du bloc), afin que l'utilisateur puisse l'envoyer en un clic dans son éditeur vocal ou slam.
${ctxDetails ? `\nParamètres souhaités par l'auteur :\n${ctxDetails}` : ''}`;

      const systemInstruction = isLiteraryExpert
        ? `${LITERARY_POETRY_EXPERT_PROMPT}

Texte actuellement dans l'éditeur de l'auteur :
---
${currentText || "(Éditeur vide pour l'instant)"}
---`
        : `${RIDIALART_DOCTRINE_PROMPT}

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

      const lastParts: any[] = [{ text: lastMessageObj?.content || "Propose-moi une création littéraire inspirante." }];
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

      // Use gemini-4-hydrogen for literary expert (with fallback models)
      const chatModelsChain = isLiteraryExpert
        ? ["gemini-4-hydrogen", "gemini-3.1-flash-lite", "gemini-flash-latest"]
        : ["gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-4-hydrogen"];
      let result;
      let lastChatError;

      const buildChatConfig = (modelName: string) => {
        if (modelName.startsWith("gemini-4-")) {
          return { systemInstruction };
        }
        return { systemInstruction, temperature: isLiteraryExpert ? 0.65 : 0.3 };
      };

      if (wantsStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for (const m of chatModelsChain) {
          try {
            const chat = effectiveAi.chats.create({
              model: m,
              config: buildChatConfig(m),
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
            config: buildChatConfig(m),
            history: chatHistory,
          });

          result = await chat.sendMessage({ message: lastParts });
          if (result && result.text) break; // Success!
        } catch (e: any) {
          lastChatError = e;
          const eMsg = e?.message || "";
          if (eMsg.includes("API key not valid") || eMsg.includes("API_KEY_INVALID")) {
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
    
    const file = req.file;
    const ext = file ? (path.extname(file.originalname || '') || (file.mimetype?.includes('webm') ? '.webm' : file.mimetype?.includes('wav') ? '.wav' : file.mimetype?.includes('mp4') ? '.mp4' : '.bin')) : '.bin';
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let tempInputPath = path.join(os.tmpdir(), `input-${stamp}${ext}`);
    let tempOutputPath = path.join(os.tmpdir(), `output-${stamp}.mp3`);

    try {
      console.log("File uploaded:", file ? `${file.originalname} (${(file.size / (1024 * 1024)).toFixed(2)} MB, type: ${file.mimetype})` : "No file");
      
      if (!file) return res.status(400).json({ error: "Aucun fichier téléversé" });

      fs.writeFileSync(tempInputPath, file.buffer);

      // Probe streams first so silent videos return a clear actionable error
      const probeData: any = await new Promise((resolve) => {
        ffmpeg.ffprobe(tempInputPath, (err, metadata) => {
          if (err) resolve(null);
          else resolve(metadata);
        });
      });
      const hasAudioStream = Array.isArray(probeData?.streams)
        ? probeData.streams.some((s: any) => s.codec_type === 'audio')
        : true;
      if (!hasAudioStream) {
        return res.status(400).json({
          error: "Cette vidéo ne contient aucune piste audio exploitable. Enregistrez ou posez une voix off, ou générez les sous-titres directement depuis votre script."
        });
      }

      // Pre-process audio or video file: extract audio stream into lightweight mono MP3 for transcription
      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempInputPath)
          .noVideo()
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
      const serverEnvKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
      const canFallbackToServerEnv = !!(serverEnvKey && isValidGeminiKey(serverEnvKey) && effectiveKey !== serverEnvKey);

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

      const transcribeModelsChain = ["gemini-3.5-transcribe", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
      let result;
      let lastErr;

      const runTranscribeWithClient = async (client: GoogleGenAI, m: string) =>
        client.models.generateContent({
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

      for (const m of transcribeModelsChain) {
        try {
          try {
            result = await runTranscribeWithClient(effectiveAi, m);
          } catch (innerErr: any) {
            const innerMsg = innerErr?.message || String(innerErr || "");
            const isBadKey = innerMsg.includes("API key not valid") || innerMsg.includes("API_KEY_INVALID");
            if (isBadKey && canFallbackToServerEnv) {
              result = await runTranscribeWithClient(serverAi, m);
            } else {
              throw innerErr;
            }
          }
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
      const msg = err?.message || "";
      if (err?.status === 429 || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        return res.status(429).json({ error: "Quota Gemini temporairement atteint pour la transcription. Réessayez dans un instant." });
      }
      if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid") || msg.includes("PERMISSION_DENIED")) {
        return res.status(401).json({ error: "Clé API Gemini invalide ou expirée. Vérifiez vos Réglages." });
      }
      res.status(500).json({ error: "Erreur lors de la transcription du fichier audio/vidéo" });
    } finally {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
      if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
    }
  });

  // Acoustic Voice Profile Analysis Endpoint (Audio Sample -> Voice Design Parameters)
  app.post("/api/voice-profile/analyze", upload.single("file"), async (req, res) => {
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const os = (await import('os')).default;

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempInputPath = path.join(os.tmpdir(), `voice-in-${stamp}`);
    const tempOutputPath = path.join(os.tmpdir(), `voice-out-${stamp}.mp3`);

    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Aucun fichier ou enregistrement vocal fourni." });
      }

      const effectiveKey = extractEffectiveApiKey(req);
      if (!effectiveKey) {
        return res.status(401).json({ error: "Clé API Gemini requise pour analyser l'empreinte vocale. Configurez-la dans les Réglages." });
      }

      fs.writeFileSync(tempInputPath, file.buffer);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(tempInputPath)
          .noVideo()
          .toFormat('mp3')
          .audioChannels(1)
          .audioBitrate('64k')
          .audioFrequency(16000)
          .on('end', () => resolve())
          .on('error', () => {
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
      const effectiveAi = getEffectiveAi(effectiveKey);

      const analysisPrompt = `Tu es un ingénieur du son et directeur artistique spécialisé dans l'analyse acoustique et le Voice Design.
Écoute attentivement cet extrait vocal et extrais son profil acoustique pour configurer une voix de synthèse expressive fidèle à son caractère :

1. recommendedBaseVoice : Choisis la voix Gemini de base la plus proche parmi EXACTEMENT ces 5 valeurs :
   - "Charon" : voix masculine grave, profonde, résonnante et posée
   - "Fenrir" : voix masculine directe, nette, structurée
   - "Puck" : voix masculine claire, dynamique et énergique
   - "Kore" : voix féminine mélodieuse, articulée et chaleureuse
   - "Zephyr" : voix féminine douce, feutrée et apaisante
2. estimatedPitchFactor : facteur de calibrage entre 0.80 et 1.20 (1.00 = neutre ; < 1.00 si la voix est plus grave que la base choisie ; > 1.00 si plus claire/aiguë).
3. detectedGenderLabel : une des 3 descriptions exactes suivantes selon le registre entendu :
   - "voix masculine grave, profonde et résonnante (homme)"
   - "voix féminine mélodieuse, claire et expressive (femme)"
   - "voix neutre, posée et feutrée"
4. detectedPace : rythme d'élocution parmi EXACTEMENT : "lent", "pose", "naturel", "dynamique", "rapide".
5. detectedTimbreTags : liste de 2 à 4 qualificatifs courts en français (ex: ["Grave & Boisé", "Chaleureux", "Posé & Serein"]).
6. voiceDesignPrompt : consigne détaillée en français (2 phrases max) décrivant le grain de voix, l'intonation, la respiration, l'accentuation et la présence microphonique à reproduire en synthèse vocale.
7. analysisSummary : court bilan en français (1 à 2 phrases) expliquant ce qui a été détecté dans l'échantillon audio.`;

      const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
      let analysisJson: any = null;
      let lastError: any = null;

      for (const m of modelsToTry) {
        try {
          const response = await effectiveAi.models.generateContent({
            model: m,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/mp3",
                    data: audioBuffer.toString("base64"),
                  },
                },
                { text: analysisPrompt },
              ],
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  recommendedBaseVoice: {
                    type: Type.STRING,
                    description: "Must be one of Charon, Fenrir, Puck, Kore, Zephyr",
                  },
                  estimatedPitchFactor: {
                    type: Type.NUMBER,
                    description: "Pitch calibration factor between 0.80 and 1.20",
                  },
                  detectedGenderLabel: {
                    type: Type.STRING,
                    description: "Gender/timbre preset string",
                  },
                  detectedPace: {
                    type: Type.STRING,
                    description: "Must be one of lent, pose, naturel, dynamique, rapide",
                  },
                  detectedTimbreTags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "2 to 4 short French timbre adjectives",
                  },
                  voiceDesignPrompt: {
                    type: Type.STRING,
                    description: "French Voice Design style instruction",
                  },
                  analysisSummary: {
                    type: Type.STRING,
                    description: "Short French summary of acoustic analysis",
                  },
                },
                required: [
                  "recommendedBaseVoice",
                  "estimatedPitchFactor",
                  "detectedGenderLabel",
                  "detectedPace",
                  "detectedTimbreTags",
                  "voiceDesignPrompt",
                  "analysisSummary",
                ],
              },
            },
          });

          const rawText = (response.text || "").trim();
          if (rawText) {
            analysisJson = JSON.parse(rawText);
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Voice profile analysis attempt with ${m} failed:`, err?.message || err);
        }
      }

      if (!analysisJson) {
        throw lastError || new Error("Impossible d'analyser l'échantillon vocal.");
      }

      const validVoices = ["Charon", "Fenrir", "Puck", "Kore", "Zephyr"];
      const validPaces = ["lent", "pose", "naturel", "dynamique", "rapide"];
      const recommendedBaseVoice = validVoices.includes(analysisJson.recommendedBaseVoice)
        ? analysisJson.recommendedBaseVoice
        : "Charon";
      const detectedPace = validPaces.includes(analysisJson.detectedPace)
        ? analysisJson.detectedPace
        : "pose";
      const pitchNum = Number(analysisJson.estimatedPitchFactor);
      const estimatedPitchFactor = Number.isFinite(pitchNum)
        ? Math.round(Math.max(0.8, Math.min(1.2, pitchNum)) * 100) / 100
        : 1.0;

      res.json({
        recommendedBaseVoice,
        estimatedPitchFactor,
        detectedGenderLabel:
          typeof analysisJson.detectedGenderLabel === "string" && analysisJson.detectedGenderLabel.trim()
            ? analysisJson.detectedGenderLabel.trim()
            : "voix masculine grave, profonde et résonnante (homme)",
        detectedPace,
        detectedTimbreTags: Array.isArray(analysisJson.detectedTimbreTags)
          ? analysisJson.detectedTimbreTags.slice(0, 5).map(String)
          : ["Chaleureux", "Posé & Serein"],
        voiceDesignPrompt:
          typeof analysisJson.voiceDesignPrompt === "string"
            ? analysisJson.voiceDesignPrompt.trim()
            : "",
        analysisSummary:
          typeof analysisJson.analysisSummary === "string"
            ? analysisJson.analysisSummary.trim()
            : "Analyse acoustique terminée.",
      });
    } catch (err: any) {
      console.error("Voice profile analysis error:", err);
      const msg = err?.message || "";
      if (err?.status === 429 || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
        return res.status(429).json({
          error: "Quota Gemini temporairement atteint pour l'analyse vocale. Réessayez dans un instant ou sculptez votre profil manuellement ci-dessous.",
        });
      }
      if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid") || msg.includes("PERMISSION_DENIED")) {
        return res.status(401).json({
          error: "Clé API Gemini invalide ou expirée. Vérifiez votre clé dans les Réglages.",
        });
      }
      res.status(500).json({
        error: "L'analyse acoustique de l'audio a échoué. Vérifiez que votre extrait contient bien de la parole audible.",
      });
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
      voiceDelaySeconds = '0',
      musicVolume = '0.3',
      subtitleStyle = 'yellow', // 'yellow' | 'classic' | 'afro'
      subtitlePosition = 'bottom', // 'bottom' | 'center' | 'top'
      subtitleFontSize = '18',
    } = req.body;

    const inferExt = (f?: Express.Multer.File, fallback = '.bin') => {
      if (!f) return fallback;
      const ext = path.extname(f.originalname || '').toLowerCase();
      if (ext && ext.length <= 6) return ext;
      const mime = (f.mimetype || '').toLowerCase();
      if (mime.includes('wav')) return '.wav';
      if (mime.includes('webm')) return '.webm';
      if (mime.includes('ogg')) return '.ogg';
      if (mime.includes('mp4') || mime.includes('m4a')) return mime.startsWith('audio') ? '.m4a' : '.mp4';
      if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
      if (mime.includes('quicktime')) return '.mov';
      return fallback;
    };

    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tempVideoPath = path.join(os.tmpdir(), `in-vid-${tempId}${inferExt(videoFile, '.mp4')}`);
    const tempVoicePath = voiceFile ? path.join(os.tmpdir(), `in-voice-${tempId}${inferExt(voiceFile, '.wav')}`) : null;
    const tempMusicPath = musicFile ? path.join(os.tmpdir(), `in-music-${tempId}${inferExt(musicFile, '.wav')}`) : null;
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
        const normalizedSrt = srtContent.trim().replace(/\r\n/g, '\n');
        fs.writeFileSync(tempSrtPath, normalizedSrt, 'utf8');
      }

      // Probe video streams to detect whether an original audio track exists and obtain duration
      const probeData: any = await new Promise((resolve) => {
        ffmpeg.ffprobe(tempVideoPath, (err, metadata) => {
          if (err) resolve(null);
          else resolve(metadata);
        });
      });
      const hasVideoAudioStream = Array.isArray(probeData?.streams)
        ? probeData.streams.some((s: any) => s.codec_type === 'audio')
        : false;
      const probedDuration = Number(probeData?.format?.duration);
      const videoDuration = Number.isFinite(probedDuration) && probedDuration > 0 ? probedDuration : 0;

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
          command = command.input(tempMusicPath).inputOptions(['-stream_loop -1']);
          musicInputIdx = nextInputIdx++;
        }

        const origVol = Math.max(0, Math.min(1, parseFloat(originalAudioVolume) || 0));
        const vVol = Math.max(0, Math.min(2, parseFloat(voiceVolume) || 1.0));
        const mVol = Math.max(0, Math.min(2, parseFloat(musicVolume) || 0.3));
        const vDelayMs = Math.round(Math.max(0, Math.min(300, parseFloat(voiceDelaySeconds) || 0)) * 1000);
        const fontSize = Math.round(Math.max(12, Math.min(34, parseFloat(subtitleFontSize) || 18)));

        const complexFilters: string[] = [];
        let videoMap = '0:v';

        // 1. Ensure even dimensions for H.264 yuv420p hardware decoders + optional burned-in subtitles
        if (shouldBurnSubs) {
          const alignment = subtitlePosition === 'top' ? 6 : subtitlePosition === 'center' ? 5 : 2;
          const marginV = subtitlePosition === 'center' ? 10 : 32;
          let primaryColour = '&H0000FFFF';
          let backColour = '&H80000000';
          let outline = 1;
          let shadow = 1;

          if (subtitleStyle === 'classic') {
            primaryColour = '&H00FFFFFF';
            backColour = '&H80000000';
          } else if (subtitleStyle === 'afro') {
            primaryColour = '&H0033CCFF';
            backColour = '&H90001030';
            outline = 2;
            shadow = 2;
          }

          const forceStyle = `Fontname=Noto Sans,Fontsize=${fontSize},PrimaryColour=${primaryColour},BackColour=${backColour},BorderStyle=4,Outline=${outline},Shadow=${shadow},Alignment=${alignment},MarginV=${marginV}`;
          const escapedSrtPath = tempSrtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
          complexFilters.push(`[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,subtitles='${escapedSrtPath}':charenc=UTF-8:force_style='${forceStyle}'[vsub]`);
          videoMap = '[vsub]';
        } else {
          complexFilters.push(`[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1[vnorm]`);
          videoMap = '[vnorm]';
        }

        // 2. Audio mixing with flexible inputs (only reference [0:a] if video actually has audio!)
        const audioTags: string[] = [];
        if (hasVideoAudioStream && origVol > 0) {
          complexFilters.push(`[0:a]volume=${origVol}[orig_a]`);
          audioTags.push('[orig_a]');
        }
        if (voiceInputIdx !== null) {
          const voiceChain: string[] = [`volume=${vVol}`];
          if (vDelayMs > 0) {
            voiceChain.push(`adelay=${vDelayMs}:all=1`);
          }
          if (videoDuration > 0) {
            voiceChain.push(`apad=whole_dur=${videoDuration.toFixed(3)}`);
          }
          complexFilters.push(`[${voiceInputIdx}:a]${voiceChain.join(',')}[voice_a]`);
          audioTags.push('[voice_a]');
        }
        if (musicInputIdx !== null) {
          const musicChain: string[] = [`volume=${mVol}`];
          if (videoDuration > 0) {
            musicChain.push(`atrim=0:${videoDuration.toFixed(3)},asetpts=PTS-STARTPTS`);
          }
          complexFilters.push(`[${musicInputIdx}:a]${musicChain.join(',')}[music_a]`);
          audioTags.push('[music_a]');
        }

        let audioMap: string | null = null;
        if (audioTags.length === 1) {
          audioMap = audioTags[0];
        } else if (audioTags.length > 1) {
          complexFilters.push(`${audioTags.join('')}amix=inputs=${audioTags.length}:duration=longest:dropout_transition=2:normalize=0[mixed_a]`);
          audioMap = '[mixed_a]';
        } else if (hasVideoAudioStream && origVol === 0 && !voiceFile && !musicFile) {
          audioMap = null; // explicitly muted video
        } else if (hasVideoAudioStream) {
          audioMap = '0:a';
        }

        if (complexFilters.length > 0) {
          command = command.complexFilter(complexFilters);
        }

        const outOpts = [
          `-map ${videoMap}`,
          ...(audioMap ? [`-map ${audioMap}`, '-c:a aac', '-b:a 192k', '-ar 44100', '-ac 2'] : ['-an']),
          '-c:v libx264',
          '-profile:v main',
          '-level 4.0',
          '-pix_fmt yuv420p',
          '-vsync cfr',
          '-preset veryfast',
          '-crf 23',
          ...(videoDuration > 0 ? [`-t ${videoDuration.toFixed(3)}`] : []),
          '-movflags +faststart',
          '-max_muxing_queue_size 1024'
        ];

        command
          .outputOptions(outOpts)
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
      const safeOutName = String(req.body?.outputFilename || 'voxart-video-edited.mp4').replace(/[\\/:*?"<>|]+/g, '_');
      const dlUrl = registerPendingDownload(videoBuffer, 'video/mp4', safeOutName.endsWith('.mp4') ? safeOutName : `${safeOutName}.mp4`);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', String(videoBuffer.length));
      res.setHeader('X-Download-Url', dlUrl);
      res.setHeader('Access-Control-Expose-Headers', 'X-Download-Url');
      res.setHeader('Content-Disposition', `attachment; filename="${safeOutName.endsWith('.mp4') ? safeOutName : `${safeOutName}.mp4`}"`);
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

  // Compile Slam & Poésie video directly to universal mobile-compatible H.264/AAC MP4
  app.post("/api/compile-slam-video", videoExportUpload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ]), async (req, res) => {
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const ffmpeg = (await import('fluent-ffmpeg')).default;
    const os = (await import('os')).default;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const audioFile = files?.audio?.[0];
    const imageFile = files?.image?.[0];

    if (!audioFile) {
      return res.status(400).json({ error: "Fichier audio manquant pour la compilation vidéo." });
    }

    const rawW = parseInt(req.body?.width || '720', 10) || 720;
    const rawH = parseInt(req.body?.height || '1280', 10) || 1280;
    const width = Math.max(320, Math.min(1920, rawW % 2 === 0 ? rawW : rawW - 1));
    const height = Math.max(320, Math.min(1920, rawH % 2 === 0 ? rawH : rawH - 1));
    const fallbackDur = Math.max(2, Math.min(1800, parseFloat(req.body?.durationSec || '10') || 10));
    const subtitleStyle = String(req.body?.subtitleStyle || 'gold_slam');
    const subtitlePosition = String(req.body?.subtitlePosition || 'bottom');
    const subtitleFontPx = Math.max(22, Math.min(64, parseInt(req.body?.subtitleFontPx || '36', 10) || 36));

    let segments: Array<{ start: number; end: number; text: string }> = [];
    try {
      const parsed = JSON.parse(req.body?.segmentsJson || '[]');
      if (Array.isArray(parsed)) {
        segments = parsed.filter((s) => s && typeof s.text === 'string' && s.text.trim().length > 0);
      }
    } catch {
      segments = [];
    }

    const inferAudioExt = (f: Express.Multer.File) => {
      const ext = path.extname(f.originalname || '').toLowerCase();
      if (ext && ext.length <= 6) return ext;
      const mime = (f.mimetype || '').toLowerCase();
      if (mime.includes('wav')) return '.wav';
      if (mime.includes('mp3') || mime.includes('mpeg')) return '.mp3';
      if (mime.includes('ogg')) return '.ogg';
      if (mime.includes('webm')) return '.webm';
      return '.wav';
    };

    const inferImgExt = (f: Express.Multer.File) => {
      const mime = (f.mimetype || '').toLowerCase();
      if (mime.includes('png')) return '.png';
      if (mime.includes('webp')) return '.webp';
      return '.jpg';
    };

    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tempAudioPath = path.join(os.tmpdir(), `slam-aud-${tempId}${inferAudioExt(audioFile)}`);
    const tempImagePath = imageFile ? path.join(os.tmpdir(), `slam-img-${tempId}${inferImgExt(imageFile)}`) : null;
    const tempAssPath = path.join(os.tmpdir(), `slam-sub-${tempId}.ass`);
    const tempOutputPath = path.join(os.tmpdir(), `slam-out-${tempId}.mp4`);

    const toAssTime = (sec: number) => {
      const safe = Math.max(0, sec);
      const h = Math.floor(safe / 3600);
      const m = Math.floor((safe % 3600) / 60);
      const s = Math.floor(safe % 60);
      const cs = Math.min(99, Math.round((safe - Math.floor(safe)) * 100));
      const pad2 = (n: number) => String(n).padStart(2, '0');
      return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
    };

    try {
      fs.writeFileSync(tempAudioPath, audioFile.buffer);
      if (imageFile && tempImagePath) {
        fs.writeFileSync(tempImagePath, imageFile.buffer);
      }

      const probedAudio: any = await new Promise((resolve) => {
        ffmpeg.ffprobe(tempAudioPath, (err, meta) => resolve(err ? null : meta));
      });
      const probedDur = Number(probedAudio?.format?.duration);
      const totalDur = Number.isFinite(probedDur) && probedDur > 0.5 ? probedDur : fallbackDur;

      // Build styled ASS subtitle script at exact video resolution
      const isGold = subtitleStyle === 'gold_slam';
      const isCyan = subtitleStyle === 'neon_cyan';
      const primaryColour = isGold ? '&H008AE6FD' : isCyan ? '&H00FEF2E0' : '&H00FFFFFF';
      const boxColour = isGold ? '&H38040C14' : isCyan ? '&H331C1006' : '&H47000000';
      const alignment = subtitlePosition === 'top' ? 8 : subtitlePosition === 'center' ? 5 : 2;
      const isVertical = height > width;
      const marginV =
        subtitlePosition === 'center'
          ? 12
          : subtitlePosition === 'top'
          ? Math.round(height * (isVertical ? 0.16 : 0.14))
          : Math.round(height * (isVertical ? 0.18 : 0.16));

      const assLines: string[] = [
        '[Script Info]',
        'ScriptType: v4.00+',
        `PlayResX: ${width}`,
        `PlayResY: ${height}`,
        'WrapStyle: 2',
        'ScaledBorderAndShadow: yes',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        `Style: SlamSub,Noto Sans,${subtitleFontPx},${primaryColour},&H000000FF,${boxColour},${boxColour},-1,0,0,0,100,100,0,0,3,14,0,${alignment},40,40,${marginV},1`,
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      ];

      let dialogueCount = 0;
      segments.forEach((seg, idx) => {
        const sStart = Math.max(0, Math.min(totalDur - 0.1, Number(seg.start) || 0));
        const nextSeg = segments[idx + 1];
        const rawEnd = Number(seg.end) || sStart + 2;
        const sEnd = Math.max(sStart + 0.15, Math.min(totalDur, nextSeg ? Math.min(rawEnd, nextSeg.start) : Math.max(rawEnd, totalDur)));
        const cleanBody = String(seg.text || '')
          .replace(/\r\n/g, '\n')
          .replace(/\{/g, '(')
          .replace(/\}/g, ')')
          .trim()
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .join('\\N');
        if (cleanBody) {
          assLines.push(`Dialogue: 0,${toAssTime(sStart)},${toAssTime(sEnd)},SlamSub,,0,0,0,,{\\fad(90,60)}${cleanBody}`);
          dialogueCount++;
        }
      });

      const hasSubtitles = dialogueCount > 0;
      if (hasSubtitles) {
        fs.writeFileSync(tempAssPath, assLines.join('\n'), 'utf8');
      }

      await new Promise<void>((resolve, reject) => {
        let cmd = ffmpeg();
        if (tempImagePath) {
          cmd = cmd.input(tempImagePath).inputOptions(['-loop 1', '-framerate 30']);
        } else {
          cmd = cmd.input(`color=c=0x181825:s=${width}x${height}:r=30`).inputOptions(['-f lavfi']);
        }
        cmd = cmd.input(tempAudioPath);

        const escapedAss = tempAssPath.replace(/\\/g, '/').replace(/:/g, '\\:');
        const vfChain = [
          `scale=${width}:${height}:force_original_aspect_ratio=increase`,
          `crop=${width}:${height}`,
          'setsar=1',
          ...(hasSubtitles ? [`ass='${escapedAss}'`] : []),
        ].join(',');

        cmd
          .complexFilter([`[0:v]${vfChain}[vout]`])
          .outputOptions([
            '-map [vout]',
            '-map 1:a',
            '-c:v libx264',
            '-profile:v main',
            '-level 4.0',
            '-pix_fmt yuv420p',
            '-r 30',
            '-vsync cfr',
            '-preset veryfast',
            '-crf 22',
            '-c:a aac',
            '-b:a 192k',
            '-ar 44100',
            '-ac 2',
            `-t ${totalDur.toFixed(3)}`,
            '-movflags +faststart',
            '-max_muxing_queue_size 1024',
          ])
          .toFormat('mp4')
          .on('end', () => resolve())
          .on('error', (err) => {
            console.error('Slam FFmpeg compile failed:', err);
            reject(err);
          })
          .save(tempOutputPath);
      });

      const mp4Buffer = fs.readFileSync(tempOutputPath);
      const safeOutName = String(req.body?.outputFilename || 'voxart-slam-video.mp4').replace(/[\\/:*?"<>|]+/g, '_');
      const finalOutName = safeOutName.endsWith('.mp4') ? safeOutName : `${safeOutName}.mp4`;
      const dlUrl = registerPendingDownload(mp4Buffer, 'video/mp4', finalOutName);
      if (String(req.body?.responseMode || '').toLowerCase() === 'json') {
        return res.json({
          url: dlUrl,
          filename: finalOutName,
          sizeBytes: mp4Buffer.length,
        });
      }
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', String(mp4Buffer.length));
      res.setHeader('X-Download-Url', dlUrl);
      res.setHeader('Access-Control-Expose-Headers', 'X-Download-Url');
      res.setHeader('Content-Disposition', `attachment; filename="${finalOutName}"`);
      res.send(mp4Buffer);
    } catch (err: any) {
      console.error('Slam video compile error:', err);
      res.status(500).json({ error: "Erreur lors de la compilation MP4 : " + (err?.message || err) });
    } finally {
      if (fs.existsSync(tempAudioPath)) try { fs.unlinkSync(tempAudioPath); } catch {}
      if (tempImagePath && fs.existsSync(tempImagePath)) try { fs.unlinkSync(tempImagePath); } catch {}
      if (fs.existsSync(tempAssPath)) try { fs.unlinkSync(tempAssPath); } catch {}
      if (fs.existsSync(tempOutputPath)) try { fs.unlinkSync(tempOutputPath); } catch {}
    }
  });

  // Expiring HTTP download relay so Android / mobile iframes save exact .wav/.mp3/.mp4/.srt/.zip filenames instead of <uuid>.bin
  const pendingDownloads = new Map<string, { buffer: Buffer; mime: string; filename: string; expiresAt: number }>();
  const DOWNLOAD_TTL_MS = 10 * 60_000;

  function prunePendingDownloads() {
    const now = Date.now();
    for (const [k, v] of pendingDownloads.entries()) {
      if (v.expiresAt <= now) pendingDownloads.delete(k);
    }
    let totalBytes = 0;
    for (const v of pendingDownloads.values()) totalBytes += v.buffer.length;
    if (totalBytes > 200 * 1024 * 1024) {
      for (const k of pendingDownloads.keys()) {
        const removed = pendingDownloads.get(k);
        pendingDownloads.delete(k);
        if (removed) totalBytes -= removed.buffer.length;
        if (totalBytes <= 150 * 1024 * 1024) break;
      }
    }
  }

  function registerPendingDownload(buffer: Buffer, mime: string, rawFilename: string): string {
    prunePendingDownloads();
    const cleanedName =
      (rawFilename || 'VoxArt_Export.wav')
        .replace(/[\\/:*?"<>|\r\n]+/g, '_')
        .trim() || 'VoxArt_Export.wav';
    const dlId = `dl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    pendingDownloads.set(dlId, {
      buffer,
      mime: mime || 'application/octet-stream',
      filename: cleanedName,
      expiresAt: Date.now() + DOWNLOAD_TTL_MS,
    });
    return `/api/download/${dlId}/${encodeURIComponent(cleanedName)}`;
  }

  app.post("/api/prepare-download", videoExportUpload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file || !file.buffer || file.buffer.length === 0) {
        return res.status(400).json({ error: "Fichier manquant pour le téléchargement." });
      }
      const rawFilename = String(req.body?.filename || file.originalname || 'VoxArt_File.wav');
      let outBuffer = file.buffer;
      let outMime = String(req.body?.mimeType || file.mimetype || '').trim();
      const wantsMp3 = req.body?.convertToMp3 === 'true' || rawFilename.toLowerCase().endsWith('.mp3');

      const hasRiff =
        outBuffer.length >= 12 &&
        outBuffer[0] === 0x52 &&
        outBuffer[1] === 0x49 &&
        outBuffer[2] === 0x46 &&
        outBuffer[3] === 0x46;

      if (wantsMp3 && hasRiff) {
        const fs = (await import('fs')).default;
        const path = (await import('path')).default;
        const ffmpeg = (await import('fluent-ffmpeg')).default;
        const os = (await import('os')).default;
        const tid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const inPath = path.join(os.tmpdir(), `dl-in-${tid}.wav`);
        const outPath = path.join(os.tmpdir(), `dl-out-${tid}.mp3`);
        try {
          fs.writeFileSync(inPath, outBuffer);
          await new Promise<void>((resolve, reject) => {
            ffmpeg(inPath)
              .audioCodec('libmp3lame')
              .audioBitrate('192k')
              .audioFrequency(44100)
              .audioChannels(2)
              .toFormat('mp3')
              .on('end', () => resolve())
              .on('error', (err) => reject(err))
              .save(outPath);
          });
          outBuffer = fs.readFileSync(outPath);
          outMime = 'audio/mpeg';
        } finally {
          if (fs.existsSync(inPath)) try { fs.unlinkSync(inPath); } catch {}
          if (fs.existsSync(outPath)) try { fs.unlinkSync(outPath); } catch {}
        }
      } else if (!outMime || outMime === 'application/octet-stream') {
        const lower = rawFilename.toLowerCase();
        if (lower.endsWith('.wav')) outMime = 'audio/wav';
        else if (lower.endsWith('.mp3')) outMime = 'audio/mpeg';
        else if (lower.endsWith('.mp4')) outMime = 'video/mp4';
        else if (lower.endsWith('.srt')) outMime = 'application/x-subrip; charset=utf-8';
        else if (lower.endsWith('.vtt')) outMime = 'text/vtt; charset=utf-8';
        else if (lower.endsWith('.txt')) outMime = 'text/plain; charset=utf-8';
        else if (lower.endsWith('.zip')) outMime = 'application/zip';
        else if (lower.endsWith('.json')) outMime = 'application/json; charset=utf-8';
        else if (lower.endsWith('.png')) outMime = 'image/png';
        else outMime = 'application/octet-stream';
      }

      const url = registerPendingDownload(outBuffer, outMime, rawFilename);
      return res.json({ url, filename: rawFilename });
    } catch (err: any) {
      console.error('Prepare download error:', err);
      return res.status(500).json({ error: err?.message || "Erreur lors de la préparation du téléchargement." });
    }
  });

  app.get(["/api/download/:id/:filename", "/api/download/:id"], (req, res) => {
    prunePendingDownloads();
    const entry = pendingDownloads.get(req.params.id);
    if (!entry) {
      return res.status(404).send("Lien de téléchargement expiré. Veuillez relancer l'export.");
    }
    const total = entry.buffer.length;
    const asciiSafe = entry.filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Type', entry.mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(entry.filename)}`
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(total - 1, parseInt(match[2], 10)) : total - 1;
        if (start >= 0 && start <= end && start < total) {
          const chunk = entry.buffer.subarray(start, end + 1);
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
          res.setHeader('Content-Length', String(chunk.length));
          return res.send(chunk);
        }
      }
    }

    res.setHeader('Content-Length', String(total));
    return res.send(entry.buffer);
  });

  // Fallback handler for Web Share Target POST /share-target when Service Worker is not yet controlling
  app.post("/share-target", upload.array("media", 5), (req, res) => {
    try {
      const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
      const payload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        receivedAt: Date.now(),
        title: typeof req.body?.title === "string" ? req.body.title.trim() : "",
        text: typeof req.body?.text === "string" ? req.body.text.trim() : "",
        url: typeof req.body?.url === "string" ? req.body.url.trim() : "",
        filesBase64: files
          .filter((f) => f && f.buffer && f.buffer.length > 0 && f.buffer.length <= 20 * 1024 * 1024)
          .map((f) => ({
            name: f.originalname || `fichier_${Date.now()}`,
            type: f.mimetype || "application/octet-stream",
            size: f.size,
            base64: f.buffer.toString("base64"),
          })),
      };
      const safeJson = JSON.stringify(payload).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Ouverture dans VoxArt...</title></head>
<body style="background:#181825;color:#cdd6f4;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<script>
(function(){
  var data = ${safeJson};
  function b64ToBuf(b64){
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++){ arr[i] = bin.charCodeAt(i); }
    return arr.buffer;
  }
  var req = indexedDB.open('voxart-share-db', 1);
  req.onupgradeneeded = function(e){
    var db = e.target.result;
    if(!db.objectStoreNames.contains('incoming_shares')){
      db.createObjectStore('incoming_shares', { keyPath: 'id' });
    }
  };
  req.onsuccess = function(){
    try {
      var db = req.result;
      var files = (data.filesBase64 || []).map(function(f){
        return { name: f.name, type: f.type, size: f.size, lastModified: Date.now(), buffer: b64ToBuf(f.base64) };
      });
      var tx = db.transaction('incoming_shares', 'readwrite');
      tx.objectStore('incoming_shares').put({
        id: data.id,
        receivedAt: data.receivedAt,
        title: data.title,
        text: data.text,
        url: data.url,
        files: files
      });
      tx.oncomplete = function(){ window.location.replace('/?shared=1'); };
      tx.onerror = function(){ window.location.replace('/?shared=1'); };
    } catch (err) {
      window.location.replace('/?shared=1');
    }
  };
  req.onerror = function(){ window.location.replace('/?shared=1'); };
})();
</script>
<p>Transfert vers VoxArt Studio...</p>
</body></html>`);
    } catch {
      res.redirect(303, "/?shared=1&shareError=1");
    }
  });

  // Explicit PWA endpoints to ensure exact MIME types and instant installability
  app.get("/manifest.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(__dirname, "public/manifest.json"));
  });

  app.get("/manifest.webmanifest", (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(__dirname, "public/manifest.webmanifest"));
  });

  app.get("/sw.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(__dirname, "public/sw.js"));
  });

  // Guarantee /api/* routes always return JSON on 404 or server/Multer errors (never Vite HTML fallback)
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpoint API introuvable." });
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const status =
      typeof err?.status === "number"
        ? err.status
        : typeof err?.statusCode === "number"
          ? err.statusCode
          : err?.code === "LIMIT_FILE_SIZE"
            ? 413
            : 500;
    const message =
      err?.code === "LIMIT_FILE_SIZE"
        ? "Fichier trop volumineux pour le serveur."
        : err?.message || "Erreur interne du serveur.";
    if (req.path.startsWith("/api") || req.headers.accept?.includes("application/json")) {
      return res.status(status).json({ error: message });
    }
    return next(err);
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
