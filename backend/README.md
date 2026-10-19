---
title: Emotion Lens API
emoji: 🧠
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Emotion Lens API

FastAPI backend for the Emotion Lens Chrome extension. It classifies text into emotion labels and returns confidence scores.

## Endpoints

- `GET /` — service information
- `GET /health` — reports whether the model loaded successfully
- `POST /predict` — JSON body: `{"text":"I am happy today!"}`

## Configuration

The default model is `bhadresh-savani/bert-base-uncased-emotion`. Set the Space variable `EMOTION_MODEL_ID` to another compatible Hugging Face sequence-classification model if needed.

Wait for the Space to finish building and downloading its model, then confirm `/health` reports `"model_loaded": true`. The first startup can take several minutes. Free Spaces may sleep when inactive, so the first request after sleeping may be slow.

## Connect the Chrome extension

In the extension popup, open **API settings** and enter the Space URL, for example `https://YOUR-SPACE-NAME.hf.space`. Save the URL and grant the requested Chrome host permission.

Do not paste access tokens into the extension or commit secrets to this repository. This public demo endpoint does not authenticate callers; add rate limiting and abuse controls before treating it as a production service. Avoid logging submitted user text.
