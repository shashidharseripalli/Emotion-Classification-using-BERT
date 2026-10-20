"""Gradio-hosted emotion classifier for the Emotion Lens Chrome extension."""
import os

import gradio as gr
from transformers import pipeline

MODEL_ID = os.getenv(
    "EMOTION_MODEL_ID",
    "bhadresh-savani/bert-base-uncased-emotion",
)
MAX_CHARS = 5000

# Load once when the Space starts, rather than downloading the model per request.
classifier = pipeline(
    "text-classification",
    model=MODEL_ID,
    top_k=None,
)


def predict_emotion(text: str):
    if not text or not text.strip():
        return "unknown", 0.0, {}

    text = text.strip()[:MAX_CHARS]
    predictions = classifier(text, truncation=True)

    # Normalize output across Transformers versions.
    if predictions and isinstance(predictions[0], list):
        predictions = predictions[0]

    scores = {
        str(item["label"]).lower().replace("_", " "): float(item["score"])
        for item in predictions
    }
    if not scores:
        return "unknown", 0.0, {}

    emotion = max(scores, key=scores.get)
    return emotion, scores[emotion], scores


demo = gr.Interface(
    fn=predict_emotion,
    inputs=gr.Textbox(
        label="Text to analyze",
        placeholder="I am really excited about my new job!",
        lines=4,
        max_lines=10,
    ),
    outputs=[
        gr.Textbox(label="Predicted emotion"),
        gr.Number(label="Confidence"),
        gr.Label(label="Emotion scores", num_top_classes=6),
    ],
    title="Emotion Lens — BERT Emotion Classifier",
    description=(
        "Predict the emotions expressed in text. Results are approximate "
        "model predictions, not proof of a person's actual emotional state."
    ),
    api_name="predict",
)

if __name__ == "__main__":
    demo.launch()
