const { GoogleGenerativeAI } = require('@google/generative-ai');

// HTTP status codes that are transient and worth retrying
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

let genAI = null;

function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it to server/.env to enable AI Nutrition features.'
    );
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

// Exported for testing
function _isTransientError(err) {
  // Numeric status property set by GoogleGenerativeAIFetchError
  if (err.status && TRANSIENT_STATUSES.has(Number(err.status))) return true;
  if (err.statusCode && TRANSIENT_STATUSES.has(Number(err.statusCode))) return true;

  // Parse status code from error message strings like "[503 Service Unavailable]"
  const m = err.message?.match(/\[(\d{3})\s/);
  if (m && TRANSIENT_STATUSES.has(Number(m[1]))) return true;

  // Network-level transient conditions
  if (['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(err.code)) return true;

  // Timeout aborts (fired by the SDK when requestOptions.timeout elapses)
  if (err.name === 'AbortError' || err.code === 'ABORT_ERR') return true;

  return false;
}

// Skip actual sleep in test environment so tests run fast
function _sleep(ms) {
  if (process.env.NODE_ENV === 'test') return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential backoff with jitter: baseMs * 2^(attempt-1) + random(0, jitterMs)
// Exported for testing
async function _withRetry(fn, { maxAttempts = 3, baseMs = 1000, jitterMs = 500, label = '' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      const willRetry = _isTransientError(err) && attempt < maxAttempts;
      const status = err.status || err.statusCode || 'unknown';
      console.log(
        `[LLM] ${label} attempt ${attempt}/${maxAttempts} status=${status} — ${willRetry ? 'retrying' : 'giving up'}`
      );
      if (!willRetry) throw err;
      const delay = baseMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * jitterMs);
      await _sleep(delay);
    }
  }
  throw lastErr;
}

// Run one model with up to 3 retry attempts
async function _callModel(modelName, systemPrompt, messages) {
  const client = getClient();
  // Only apply a per-attempt timeout if explicitly set via GEMINI_TIMEOUT_MS.
  // By default requests run to completion — Gemini on the free tier can be slow.
  const timeoutMs = process.env.GEMINI_TIMEOUT_MS ? Number(process.env.GEMINI_TIMEOUT_MS) : undefined;
  const requestOptions = timeoutMs ? { timeout: timeoutMs } : {};

  return _withRetry(
    async (attempt) => {
      if (attempt > 1) {
        console.log(`[LLM] model="${modelName}" retry attempt ${attempt}/3`);
      }

      const model = client.getGenerativeModel(
        {
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
        },
        requestOptions
      );

      // Build multi-turn history — all messages except the last one
      const history = [];
      for (let i = 0; i < messages.length - 1; i++) {
        history.push({
          role: messages[i].role === 'assistant' ? 'model' : 'user',
          parts: [{ text: messages[i].content }]
        });
      }

      const chat = model.startChat({ history });
      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      const response = result.response;

      // Safety blocks are non-transient — mark so the caller can skip fallback
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        const safetyErr = new Error(
          'Response blocked by safety filters. Please rephrase your question.'
        );
        safetyErr.isSafetyBlock = true;
        throw safetyErr;
      }

      return response.text();
    },
    { maxAttempts: 3, baseMs: 300, jitterMs: 150, label: `model="${modelName}"` }
  );
}

async function generateChatResponse(systemPrompt, messages) {
  const primary  = process.env.GEMINI_MODEL          || 'gemini-3.8-flash';
  const fallback = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';

  // ── Primary model (3 attempts with backoff) ─────────────────────────────
  console.log(`[LLM] calling primary model="${primary}"`);
  try {
    return await _callModel(primary, systemPrompt, messages);
  } catch (primaryErr) {
    // Safety blocks and non-transient errors (auth, bad request, model not found)
    // are not worth retrying on a different model
    if (primaryErr.isSafetyBlock || !_isTransientError(primaryErr)) {
      throw primaryErr;
    }

    const status = primaryErr.status || primaryErr.statusCode || 'unknown';
    console.log(
      `[LLM] primary model="${primary}" transient failure (status=${status}) — trying fallback model="${fallback}"`
    );
  }

  // ── Fallback model (3 attempts with backoff) ─────────────────────────────
  try {
    return await _callModel(fallback, systemPrompt, messages);
  } catch (fallbackErr) {
    const status = fallbackErr.status || fallbackErr.statusCode || 'unknown';
    console.log(`[LLM] fallback model="${fallback}" also failed (status=${status})`);

    // Throw a clean user-facing error; never expose internals
    const finalErr = new Error(
      'The AI service is temporarily unavailable. Please try again in a few moments.'
    );
    finalErr.statusCode = 503;
    finalErr.isLLMUnavailable = true;
    throw finalErr;
  }
}

module.exports = {
  generateChatResponse,
  // Exported for unit testing only
  _isTransientError,
  _withRetry
};
