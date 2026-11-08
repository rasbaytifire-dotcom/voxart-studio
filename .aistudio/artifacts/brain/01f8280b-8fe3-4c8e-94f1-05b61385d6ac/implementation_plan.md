# Implementation Plan - AI Agent API Key & Error Troubleshooting

## Problem
The AI agent displays an error message stating: *"Désolé, une erreur est survenue lors de la communication avec l'agent Gemini. Veuillez vérifier votre clé API dans les paramètres."* This occurs because the user's client-side API key is empty or invalid, while the backend requires an API key to communicate with Gemini.

## Proposed Changes
1. **Settings / API Key Guidance in Chat Modal**:
   - When an API key error occurs or when no API key is set, show a direct button/link inside the AIAgentChat modal to open the Settings panel where the user can enter their Gemini API key.
   - Display a helper notice explaining how to obtain a free Gemini API key from Google AI Studio.

2. **Backend Fallback & Robustness**:
   - Ensure `server.ts` uses `process.env.GEMINI_API_KEY` correctly if available, and provides clear, actionable instructions in error responses.

## Verification Plan
- Verify that opening settings and saving an API key allows the AI agent to respond successfully.
- Run `compile_applet` and `lint_applet` to ensure zero compilation or syntax errors.
