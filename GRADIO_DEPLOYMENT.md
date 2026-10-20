# Deploy Emotion Lens on Hugging Face Spaces (Gradio)

This repository includes a Gradio app at `app.py`. Create a new Space with the **Gradio** SDK, then upload/push the repository files to the Space root. The Space root must contain `app.py` and `requirements.txt`.

## Files and settings

1. Set the Space SDK to **Gradio**.
2. Ensure `app.py` and `requirements.txt` are at the root of the Space.
3. In **Settings → Variables and secrets**, add:
   - Variable: `EMOTION_MODEL_ID`
   - Value: `bhadresh-savani/bert-base-uncased-emotion`
4. Wait for the build and model download to finish.
5. Open the Space's **Use via API** section and confirm the `predict` endpoint is listed.

## Connect the Chrome extension

1. Reload the extension from `chrome://extensions`.
2. Open the extension popup and click **API settings**.
3. Enter the Space's HTTPS URL, for example `https://YOUR-SPACE-NAME.hf.space` (use the actual URL shown on the Space page).
4. Click **Save URL** and approve Chrome's host permission prompt.
5. Test a sentence and verify the emotion and confidence scores.

The extension calls the Gradio API endpoint `/gradio_api/call/predict`. The model is loaded once when the Space starts. Free CPU Spaces may take time to wake up or load the model.

## Notes

- The Space should be public for unauthenticated use by a public extension. Do not put a Hugging Face token in the extension.
- Public endpoints can be called by others; apply appropriate rate limits and avoid logging user text unnecessarily.
- The predictions are approximate classifications and are not reliable evidence of a person's actual emotional state.
- The notebook's own fine-tuned model is not deployed by default. This app uses the public checkpoint unless `EMOTION_MODEL_ID` is changed.
