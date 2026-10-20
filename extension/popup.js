const DEFAULT_API_URL = "http://127.0.0.1:8000";
const input = document.getElementById("text-input");
const analyzeButton = document.getElementById("analyze");
const statusNode = document.getElementById("status");
const resultNode = document.getElementById("result");
const apiState = document.getElementById("api-state");
const apiDot = document.querySelector(".dot");
const charCount = document.getElementById("char-count");
const apiInput = document.getElementById("api-url");

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#b42318" : "#788195";
}

async function getApiUrl() {
  const stored = await chrome.storage.local.get("apiUrl");
  return (stored.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
}

async function checkBackend() {
  try {
    const base = await getApiUrl();
    apiInput.value = base;
    // Gradio serves its app configuration at /config.
    const response = await fetch(base + "/config");
    if (!response.ok) throw new Error("Space returned " + response.status);
    await response.json();
    apiState.textContent = "Gradio Space reachable";
    apiDot.classList.toggle("online", true);
  } catch {
    apiState.textContent = "Space offline — check API URL";
    apiDot.classList.remove("online");
  }
}

function renderResult(data) {
  document.getElementById("emotion").textContent = data.predicted_emotion;
  document.getElementById("confidence").textContent = Math.round(data.confidence * 100) + "%";
  const scores = document.getElementById("scores");
  scores.replaceChildren();
  for (const item of data.scores.slice().sort((a, b) => b.score - a.score)) {
    const row = document.createElement("div");
    row.className = "score-row";
    const label = document.createElement("span");
    label.textContent = item.label;
    const track = document.createElement("div");
    track.className = "track";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = Math.max(0, Math.min(100, item.score * 100)) + "%";
    track.append(fill);
    const value = document.createElement("span");
    value.className = "score-value";
    value.textContent = (item.score * 100).toFixed(1) + "%";
    row.append(label, track, value);
    scores.append(row);
  }
  resultNode.classList.remove("hidden");
}

async function predictWithGradio(base, text) {
  const startResponse = await fetch(base + "/gradio_api/call/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [text] })
  });
  const startPayload = await startResponse.json().catch(() => ({}));
  if (!startResponse.ok) {
    throw new Error(startPayload.detail || startPayload.error || "Gradio request failed (" + startResponse.status + ")");
  }
  if (!startPayload.event_id) {
    throw new Error("Gradio did not return an event ID. Check the Space API documentation.");
  }

  const resultResponse = await fetch(
    base + "/gradio_api/call/predict/" + encodeURIComponent(startPayload.event_id)
  );
  if (!resultResponse.ok) {
    throw new Error("Could not retrieve prediction (" + resultResponse.status + ")");
  }

  // Gradio returns the result as a server-sent event stream.
  const streamText = await resultResponse.text();
  const dataLines = [...streamText.matchAll(/^data:\s*(.+)$/gm)].map((match) => match[1]);
  let result = null;
  for (const line of dataLines) {
    try {
      result = JSON.parse(line);
    } catch {
      // Ignore non-JSON heartbeat/event data.
    }
  }
  if (!Array.isArray(result) || result.length < 3) {
    throw new Error("Unexpected Gradio response. Open the Space's Use via API section to verify the endpoint.");
  }

  const [emotion, confidence, rawScores] = result;
  const scoreEntries = Array.isArray(rawScores)
    ? rawScores.map((item) => ({ label: item.label, score: Number(item.score) }))
    : Object.entries(rawScores || {}).map(([label, score]) => ({ label, score: Number(score) }));

  return {
    predicted_emotion: String(emotion),
    confidence: Number(confidence),
    scores: scoreEntries
  };
}

async function analyze(text = input.value) {
  const cleaned = text.trim();
  if (!cleaned) {
    setStatus("Enter text or select text on a webpage first.", true);
    return;
  }
  if (cleaned.length > 5000) {
    setStatus("Please keep the text under 5,000 characters.", true);
    return;
  }
  analyzeButton.disabled = true;
  resultNode.classList.add("hidden");
  setStatus("Analyzing text…");
  try {
    const base = await getApiUrl();
    const payload = await predictWithGradio(base, cleaned);
    renderResult(payload);
    setStatus("Analysis complete.");
  } catch (error) {
    setStatus("Could not analyze text. " + error.message + " Check the Space URL and API endpoint.", true);
  } finally {
    analyzeButton.disabled = false;
  }
}

input.addEventListener("input", () => {
  charCount.textContent = input.value.length + " / 5000";
});
analyzeButton.addEventListener("click", () => analyze());

document.getElementById("use-selection").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString() || ""
    });
    if (!result?.result?.trim()) {
      setStatus("No text selected. Highlight text on the page first.", true);
      return;
    }
    input.value = result.result.slice(0, 5000);
    charCount.textContent = input.value.length + " / 5000";
    setStatus("Selected webpage text loaded. Click Analyze emotion.");
  } catch {
    setStatus("Chrome cannot read a selection on this page. Try a normal website.", true);
  }
});

document.getElementById("settings").addEventListener("click", () => {
  document.getElementById("settings-panel").classList.toggle("hidden");
});

document.getElementById("save-url").addEventListener("click", async () => {
  const value = apiInput.value.trim().replace(/\/$/, "");
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    const originPattern = url.origin + "/*";
    const hasPermission = await chrome.permissions.contains({ origins: [originPattern] });
    if (!hasPermission) {
      const granted = await chrome.permissions.request({ origins: [originPattern] });
      if (!granted) {
        setStatus("Chrome permission was not granted for this API host.", true);
        return;
      }
    }
    await chrome.storage.local.set({ apiUrl: value });
    setStatus("API URL saved.");
    await checkBackend();
  } catch {
    setStatus("Enter a valid API URL and allow Chrome's host permission when prompted.", true);
  }
});

(async () => {
  const stored = await chrome.storage.local.get("pendingText");
  if (stored.pendingText) {
    input.value = stored.pendingText.slice(0, 5000);
    charCount.textContent = input.value.length + " / 5000";
    await chrome.storage.local.remove("pendingText");
    setStatus("Selected text loaded. Click Analyze emotion.");
  }
  await checkBackend();
})();
