"""FastAPI inference service for the Emotion Lens Chrome extension.

By default this loads a Hugging Face emotion-classification checkpoint.
To use your own fine-tuned notebook output, set EMOTION_MODEL_ID to the
path of the saved model directory (for example: ./emotion-bert).
"""
import os
from contextlib import asynccontextmanager
from typing import Any

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_ID = os.getenv("EMOTION_MODEL_ID", "bhadresh-savani/bert-base-uncased-emotion")
MAX_LENGTH = int(os.getenv("MAX_LENGTH", "256"))
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
tokenizer = None
model = None


def label_for(index: int) -> str:
    if model is not None:
        labels: dict[str, Any] = getattr(model.config, "id2label", {}) or {}
        label = labels.get(index, labels.get(str(index)))
        if label and not str(label).startswith("LABEL_"):
            return str(label).lower().replace("_", " ")
    # Label IDs used by dair-ai/emotion and by the repository's notebook.
    defaults = ["sadness", "joy", "love", "anger", "fear", "surprise"]
    return defaults[index] if 0 <= index < len(defaults) else f"class {index}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global tokenizer, model
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
        model.to(DEVICE)
        model.eval()
        print(f"Loaded model {MODEL_ID!r} on {DEVICE}")
    except Exception as exc:
        print(f"Model loading failed for {MODEL_ID!r}: {exc}")
        # Keep the health endpoint alive so the reason is visible to users.
    yield


app = FastAPI(
    title="Emotion Lens API",
    description="Emotion classification inference API for a Chrome extension.",
    version="1.0.0",
    lifespan=lifespan,
)

# Chrome extension IDs use the a-p alphabet and have 32 characters.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://[a-p]{32}",
    allow_origins=["http://localhost", "http://127.0.0.1"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


class PredictRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class EmotionScore(BaseModel):
    label: str
    score: float


class PredictResponse(BaseModel):
    text: str
    predicted_emotion: str
    confidence: float
    scores: list[EmotionScore]
    model: str


@app.get("/")
def root():
    return {"name": "Emotion Lens API", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health():
    return {
        "status": "ok" if model is not None else "model_not_loaded",
        "model_loaded": model is not None,
        "model_id": MODEL_ID,
        "device": str(DEVICE),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    if model is None or tokenizer is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model is not loaded. Check the backend logs and EMOTION_MODEL_ID ({MODEL_ID}).",
        )
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text cannot be blank.")
    try:
        inputs = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_LENGTH,
            padding=True,
        )
        inputs = {key: value.to(DEVICE) for key, value in inputs.items()}
        with torch.inference_mode():
            logits = model(**inputs).logits
            probabilities = torch.softmax(logits, dim=-1)[0].detach().cpu().tolist()
        scores = [
            EmotionScore(label=label_for(i), score=float(score))
            for i, score in enumerate(probabilities)
        ]
        best = max(scores, key=lambda item: item.score)
        return PredictResponse(
            text=text,
            predicted_emotion=best.label,
            confidence=best.score,
            scores=scores,
            model=MODEL_ID,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc
