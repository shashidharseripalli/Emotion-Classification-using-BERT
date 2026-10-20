# Emotion Classification using BERT — Chrome Extension

A browser extension that predicts the emotion expressed in text typed by the user or selected on a webpage. It uses a Manifest V3 Chrome extension, a FastAPI inference backend, and a Hugging Face Transformers sequence-classification model.

## Features

- Analyze text typed or pasted into the extension popup.
- Load highlighted webpage text into the popup.
- Right-click selected text and choose **Analyze emotion in selected text**.
- View the predicted emotion and confidence scores for all model classes.
- Configure the backend URL in the popup; Chrome requests permission for the selected API host.
- Use the included default public checkpoint or point the backend at your own fine-tuned model.
- GitHub Actions validates manifest JSON, JavaScript syntax, Python syntax, and required files on pushes and pull requests.

> **Important:** the current notebook fine-tunes `bert-base-uncased` on the dair-ai Emotion dataset, but the notebook's recorded training run was interrupted and does not commit a saved model artifact. The backend therefore defaults to a public emotion checkpoint so the application can run without first training a model. To use your own model, complete training and set `EMOTION_MODEL_ID` to the saved `emotion-bert` directory. Do not claim your own fine-tuned checkpoint is deployed until you have saved and tested it.

## Project structure

```text
.
├── example.ipynb
├── requirements.txt
├── extension/
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── background.js
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── .github/workflows/validate.yml
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
5. Pin the extension from Chrome's Extensions menu.
6. Keep the backend running at `http://127.0.0.1:8000`.
7. Click the extension icon, type text, and choose **Analyze emotion**.
8. To analyze page text, select text on a normal webpage, open the extension, and click **Use selected webpage text**. Alternatively, right-click selected text and choose **Analyze emotion in selected text**, then open the extension popup if Chrome does not open it automatically.

Chrome internal pages and the Chrome Web Store do not permit normal content-script access. Test on an ordinary website.

## 3. Connect your own fine-tuned BERT model

The notebook uses six labels in this order:

0. sadness
1. joy
2. love
3. anger
4. fear
5. surprise

Complete training and save the model and tokenizer into `./emotion-bert`. The saved directory must contain Transformers model configuration, weights, and tokenizer files. The current notebook's recorded run is interrupted, so training and saving must complete successfully first.

Start the backend with the saved directory as the model ID.

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

Do not use the base `bert-base-uncased` checkpoint without fine-tuning its classification head for emotion labels; its predictions would not be meaningful.

## 4. Deploy the backend

The extension needs a reachable HTTPS backend for use beyond your own computer. A deployed extension must not use `127.0.0.1`, because that address refers to the end user's own computer.

### Docker

From the `backend` directory:

```bash
docker build -t emotion-lens-api .
docker run --rm -p 8000:7860 -e EMOTION_MODEL_ID=bhadresh-savani/bert-base-uncased-emotion emotion-lens-api
```

### Hugging Face Spaces (recommended for a demo)

The backend is prepared for Spaces' Docker runtime on port `7860`. You must create the Space under your own Hugging Face account; I cannot create or publish it without access to that account.

1. Open [Hugging Face Spaces](https://huggingface.co/new-space) and sign in.
2. Choose a Space name, select **Docker** as the Space SDK, and create the Space. Public is easiest for a public demo; remember that the endpoint will then be callable by others.
3. In the Space's **Files** view, upload the *contents* of this repository's `backend/` folder to the root of the Space. The root must contain `Dockerfile`, `README.md`, `main.py`, and `requirements.txt`. Do not upload the parent folder as a nested directory.
4. In Space **Settings → Variables and secrets**, add the variable `EMOTION_MODEL_ID` with value `bhadresh-savani/bert-base-uncased-emotion`. This is a variable, not a secret; do not add access tokens to the extension.
5. Wait for the Docker build and model download to finish. Open `https://YOUR-SPACE-NAME.hf.space/health`; continue only when the JSON reports `"model_loaded": true`.
6. Open the extension popup → **API settings**. Enter `https://YOUR-SPACE-NAME.hf.space`, save it, and approve Chrome's host permission prompt.
7. Test a sample from the popup and verify the predicted label and score list.

The root-level metadata in `backend/README.md` configures Spaces for Docker and port `7860`. If you prefer a private Space, confirm its authentication behavior before using it from the extension; a public extension should not contain a Hugging Face token.

### Other Docker hosts

1. Deploy the `backend` directory / Dockerfile to a container host.
2. Configure `EMOTION_MODEL_ID` in the host's environment variables.
3. Verify `https://YOUR_API_HOST/health` reports `"model_loaded": true`.
4. In the extension popup, open **API settings** and save your HTTPS API base URL.
5. For public release, configure rate limits, request size limits, logs that avoid storing user text, and an appropriate privacy notice. Never embed a secret API key in extension code.

The backend's current CORS regex accepts Chrome extension IDs. Review CORS settings and access controls before public production deployment. Some hosts sleep when idle and may be slow on the first request while loading the model.

## 5. Troubleshooting

- **Backend offline:** start Uvicorn and verify `/health`; confirm the popup API URL matches.
- **Model not loaded:** inspect backend logs for download errors, an invalid model ID, or insufficient RAM.
- **No selection found:** select text on a regular webpage before clicking the selection button.
- **Popup does not open from context menu:** click the extension icon; the selected text is saved for the popup.
- **Slow first prediction:** model downloads and CPU inference can take time.
- **Generic label names:** a checkpoint may lack `id2label` metadata; the backend uses the six-label dataset order as a fallback.

## Privacy and limitations

Text is sent to the configured backend for inference. Do not submit confidential or personally identifying text unless you control the backend and understand its logging and retention settings. Emotion labels are approximate classifications of text, not proof of what a person actually feels. Results can be wrong, especially for sarcasm, mixed emotions, short text, or missing context.

## Validation status

GitHub Actions performs static validation of the manifest, JavaScript syntax, Python syntax, and required files. This is not a substitute for testing the extension in Chrome, running inference against the downloaded model, or verifying a live deployment. Complete those integration checks before publishing.

## License

Add a license before redistributing this project. Check the license and usage terms for the selected model checkpoint and dataset separately.
