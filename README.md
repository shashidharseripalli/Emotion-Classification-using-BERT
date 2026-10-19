# Emotion Classification using BERT — Chrome Extension

A browser extension that predicts the emotion expressed in text typed by the user or selected on a webpage. It uses a Manifest V3 Chrome extension, a FastAPI inference backend, and a Hugging Face Transformers sequence-classification model.

## Features

- Analyze text typed or pasted into the extension popup.
- Load highlighted webpage text into the popup.
- Right-click selected text and choose **Analyze emotion in selected text**.
- View the predicted emotion and confidence scores for all model classes.
- Configure the backend URL in the popup.
- Use the included default public checkpoint or point the backend at your own fine-tuned model.

> **Important:** the current notebook fine-tunes `bert-base-uncased` on the dair-ai Emotion dataset, but the notebook currently shows an interrupted training run and does not commit a saved model artifact. The backend therefore defaults to a public emotion checkpoint so the application can run without first training a model. To use your own model, complete training and set `EMOTION_MODEL_ID` to the saved `emotion-bert` directory. Do not claim your own fine-tuned checkpoint is deployed until you have saved and tested it.

## Project structure

```text
.
├── example.ipynb                 # Existing model exploration/training notebook
├── requirements.txt              # Existing notebook dependencies
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── background.js
└── backend/
    ├── main.py
    ├── requirements.txt
    ├── Dockerfile
    └── .env.example
```

## 1. Run the backend locally

Python 3.11 is recommended. From the repository root:

### Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
$env:EMOTION_MODEL_ID="bhadresh-savani/bert-base-uncased-emotion"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### macOS / Linux

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
export EMOTION_MODEL_ID="bhadresh-savani/bert-base-uncased-emotion"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The first launch downloads the model from Hugging Face and may take a few minutes. Open:

- Health: http://127.0.0.1:8000/health
- Interactive API docs: http://127.0.0.1:8000/docs

A successful health response contains `"model_loaded": true`. If the model cannot be downloaded or loaded, check the terminal logs and model ID.

### Try the API

```bash
curl -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"I am so happy that everything worked out!"}'
```

The response contains `predicted_emotion`, `confidence`, and a `scores` array.

## 2. Load the Chrome extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository's `extension` folder.
5. Pin **Emotion Lens — BERT Emotion Classifier** from Chrome's Extensions menu.
6. Keep the backend running at `http://127.0.0.1:8000`.
7. Click the extension icon, type text, and choose **Analyze emotion**.
8. To analyze page text, select text on a normal webpage, open the extension, and click **Use selected webpage text**. Alternatively, right-click the selected text and choose **Analyze emotion in selected text**, then open the extension popup if Chrome does not open it automatically.

Chrome internal pages (such as `chrome://extensions`) and the Chrome Web Store do not permit normal content-script access. Test on an ordinary website.

## 3. Connect your own fine-tuned BERT model

The existing notebook defines six labels in this order:

0. sadness
1. joy
2. love
3. anger
4. fear
5. surprise

In `example.ipynb`, run the training/evaluation cell only when you are ready to finish training. The notebook's current saved output shows an interrupted run, so training and saving need to complete successfully. The training function saves the model and tokenizer into `./emotion-bert`.

After the model has been saved, start the backend with that directory as the model ID.

### Windows PowerShell

From the `backend` directory, if the saved folder is at the repository root:

```powershell
$env:EMOTION_MODEL_ID="..\emotion-bert"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### macOS / Linux

```bash
export EMOTION_MODEL_ID="../emotion-bert"
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The local model directory must contain the Transformers model configuration, weights, and tokenizer files. Do not point `EMOTION_MODEL_ID` at the base `bert-base-uncased` checkpoint unless it has been fine-tuned for emotion labels; an untrained classification head produces meaningless predictions.

## 4. Deploy the backend

The extension must call a reachable HTTPS backend when used beyond your own computer. Do not use `127.0.0.1` for a deployed extension because that points to the end user's machine.

### Docker

From the `backend` directory:

```bash
docker build -t emotion-lens-api .
docker run --rm -p 8000:8000 \
  -e EMOTION_MODEL_ID=bhadresh-savani/bert-base-uncased-emotion \
  emotion-lens-api
```

### Hosting checklist

You can deploy the Docker image to a container host such as Hugging Face Spaces (Docker), Render, Railway, or another service that supports Python containers.

1. Deploy the `backend` directory / Dockerfile.
2. Configure `EMOTION_MODEL_ID` in the host's environment variables.
3. Wait for the model to download and verify `https://YOUR_API_HOST/health`.
4. In the extension popup, open **API settings** and save your HTTPS API base URL.
5. Add the deployed domain to the extension's `host_permissions` in `extension/manifest.json`, reload the extension, and retest. For example, add `https://YOUR_API_HOST/*` (replace with your real host).
6. For a public release, configure rate limits, request size limits, logging that avoids storing user text, and an appropriate privacy notice. Never embed a secret API key in the extension code.

For public deployment, configure CORS to allow your actual extension ID/origin and remove broad development allowances if no longer needed. The backend's current CORS regex accepts Chrome extension IDs. Some hosts sleep when idle and may be slow on the first request while loading the model.

## 5. Troubleshooting

- **Backend offline:** start Uvicorn and verify `/health`; confirm the popup API URL matches.
- **Model not loaded:** inspect the backend terminal for download errors, wrong model ID, or insufficient RAM.
- **No selection found:** select text on a regular webpage before clicking the selection button.
- **Popup does not open from the context menu:** click the extension icon; the selected text is saved for the popup.
- **Slow first prediction:** model downloads and CPU inference can take time. Consider a host with sufficient RAM or a smaller compatible checkpoint.
- **Label names look generic:** the checkpoint may not include `id2label` metadata. This API uses the six labels above as a fallback for the six-class dataset.

## Privacy and limitations

Text is sent to the configured backend for inference. Do not submit confidential, sensitive, or personally identifying text unless you control the backend and understand its logging and retention settings. Emotion labels are approximate classifications of text, not proof of what a person actually feels. Results can be wrong, especially for sarcasm, mixed emotions, short text, or missing conversation context.

## License

Add a license before redistributing this project. Check the license and usage terms for the chosen model checkpoint and dataset separately.
