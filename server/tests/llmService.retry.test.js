/**
 * Tests for llmService retry logic and model fallback.
 *
 * Uses jest.doMock + jest.resetModules so each test gets a fresh module
 * instance — required because llmService caches the genAI singleton.
 * NODE_ENV=test skips real sleep inside _withRetry so tests run fast.
 */

'use strict';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTransientError(status) {
  const err = new Error(`[${status} Error]`);
  err.status = status;
  return err;
}

function makeNonTransientError(status) {
  const err = new Error(`[${status} Error]`);
  err.status = status;
  return err;
}

function makeNetworkError(code) {
  const err = new Error('Network error');
  err.code = code;
  return err;
}

function makeOkResponse(text = 'ok') {
  return {
    response: {
      text: () => text,
      candidates: [{ finishReason: 'STOP' }]
    }
  };
}

// ── _isTransientError ────────────────────────────────────────────────────────

describe('_isTransientError', () => {
  let isTransientError;

  beforeEach(() => {
    jest.resetModules();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    isTransientError = require('../services/llmService')._isTransientError;
  });

  test.each([408, 429, 500, 502, 503, 504])(
    'returns true for status %i (numeric property)',
    (code) => {
      expect(isTransientError(makeTransientError(code))).toBe(true);
    }
  );

  test.each([408, 500, 503])(
    'returns true for status %i parsed from message string',
    (code) => {
      const err = new Error(`[${code} Service Error] some detail`);
      expect(isTransientError(err)).toBe(true);
    }
  );

  test.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'])(
    'returns true for network error code %s',
    (code) => {
      expect(isTransientError(makeNetworkError(code))).toBe(true);
    }
  );

  test.each([400, 401, 403, 404])(
    'returns false for non-transient status %i',
    (code) => {
      expect(isTransientError(makeNonTransientError(code))).toBe(false);
    }
  );

  test('returns false for generic errors with no status', () => {
    expect(isTransientError(new Error('Something went wrong'))).toBe(false);
  });

  test('returns true for AbortError (request timeout)', () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    expect(isTransientError(err)).toBe(true);
  });

  test('returns true for ABORT_ERR code', () => {
    const err = new Error('aborted');
    err.code = 'ABORT_ERR';
    expect(isTransientError(err)).toBe(true);
  });
});

// ── _withRetry ────────────────────────────────────────────────────────────────

describe('_withRetry', () => {
  let withRetry;
  let isTransientError;

  beforeEach(() => {
    jest.resetModules();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    const mod = require('../services/llmService');
    withRetry = mod._withRetry;
    isTransientError = mod._isTransientError;
  });

  test('returns result immediately on first success', async () => {
    const fn = jest.fn().mockResolvedValue('done');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('retries up to maxAttempts on transient error then succeeds', async () => {
    const transient = makeTransientError(503);
    const fn = jest.fn()
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxAttempts: 3, baseMs: 0, jitterMs: 0 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('throws immediately on non-transient error without retrying', async () => {
    const nonTransient = makeNonTransientError(400);
    const fn = jest.fn().mockRejectedValue(nonTransient);

    await expect(withRetry(fn, { maxAttempts: 3, baseMs: 0, jitterMs: 0 }))
      .rejects.toMatchObject({ status: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throws after exhausting all attempts on persistent transient error', async () => {
    const transient = makeTransientError(503);
    const fn = jest.fn().mockRejectedValue(transient);

    await expect(withRetry(fn, { maxAttempts: 3, baseMs: 0, jitterMs: 0 }))
      .rejects.toMatchObject({ status: 503 });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('passes attempt number (1-based) to the callback', async () => {
    const attempts = [];
    const fn = jest.fn().mockImplementation(async (attempt) => {
      attempts.push(attempt);
      if (attempt < 3) throw makeTransientError(503);
      return 'done';
    });

    await withRetry(fn, { maxAttempts: 3, baseMs: 0, jitterMs: 0 });
    expect(attempts).toEqual([1, 2, 3]);
  });
});

// ── generateChatResponse (primary + fallback) ─────────────────────────────────

describe('generateChatResponse', () => {
  let generateChatResponse;
  let mockSendMessage;
  let mockGetGenerativeModel;

  function setupModule() {
    jest.resetModules();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.NODE_ENV = 'test';
    process.env.GEMINI_MODEL = 'primary-model';
    process.env.GEMINI_FALLBACK_MODEL = 'fallback-model';

    mockSendMessage = jest.fn();
    mockGetGenerativeModel = jest.fn().mockReturnValue({
      startChat: jest.fn().mockReturnValue({ sendMessage: mockSendMessage })
    });

    jest.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: mockGetGenerativeModel
      }))
    }));

    generateChatResponse = require('../services/llmService').generateChatResponse;
  }

  afterEach(() => {
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
  });

  test('returns response from primary model on first success', async () => {
    setupModule();
    mockSendMessage.mockResolvedValue(makeOkResponse('Hello!'));

    const result = await generateChatResponse('system', [{ role: 'user', content: 'hi' }]);

    expect(result).toBe('Hello!');
    expect(mockGetGenerativeModel.mock.calls[0][0]).toMatchObject({ model: 'primary-model' });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  test('retries primary model 3× on 503 then tries fallback model and succeeds', async () => {
    setupModule();
    const transient = makeTransientError(503);

    mockSendMessage
      .mockRejectedValueOnce(transient)   // primary attempt 1
      .mockRejectedValueOnce(transient)   // primary attempt 2
      .mockRejectedValueOnce(transient)   // primary attempt 3
      .mockResolvedValueOnce(makeOkResponse('fallback ok')); // fallback attempt 1

    const result = await generateChatResponse('system', [{ role: 'user', content: 'hi' }]);

    expect(result).toBe('fallback ok');
    expect(mockSendMessage).toHaveBeenCalledTimes(4);

    const modelNames = mockGetGenerativeModel.mock.calls.map(c => c[0].model);
    expect(modelNames.slice(0, 3)).toEqual(['primary-model', 'primary-model', 'primary-model']);
    expect(modelNames[3]).toBe('fallback-model');
  });

  test('returns user-facing 503 error when both primary and fallback exhaust retries', async () => {
    setupModule();
    const transient = makeTransientError(503);
    mockSendMessage.mockRejectedValue(transient); // all 6 attempts fail

    await expect(
      generateChatResponse('system', [{ role: 'user', content: 'hi' }])
    ).rejects.toMatchObject({
      isLLMUnavailable: true,
      statusCode: 503,
      message: expect.stringContaining('temporarily unavailable')
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(6); // 3 primary + 3 fallback
  });

  test('does NOT try fallback for non-transient 404 error', async () => {
    setupModule();
    const notFound = makeNonTransientError(404);
    mockSendMessage.mockRejectedValue(notFound);

    await expect(
      generateChatResponse('system', [{ role: 'user', content: 'hi' }])
    ).rejects.toMatchObject({ status: 404 });

    // Only 1 call — no retry, no fallback
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockGetGenerativeModel).not.toHaveBeenCalledWith(
      expect.objectContaining({ model: 'fallback-model' })
    );
  });

  test('does NOT retry a safety block — rethrows immediately with isSafetyBlock=true', async () => {
    setupModule();
    mockSendMessage.mockResolvedValue({
      response: {
        text: () => { throw new Error('blocked'); },
        candidates: [{ finishReason: 'SAFETY' }]
      }
    });

    await expect(
      generateChatResponse('system', [{ role: 'user', content: 'hi' }])
    ).rejects.toMatchObject({ isSafetyBlock: true });

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  test('error message does not expose API key', async () => {
    setupModule();
    mockSendMessage.mockRejectedValue(makeTransientError(503));

    try {
      await generateChatResponse('system', [{ role: 'user', content: 'hi' }]);
    } catch (err) {
      expect(err.message).not.toContain('test-key');
      expect(err.message).not.toContain(process.env.GEMINI_API_KEY || '');
    }
  });

  test('uses GEMINI_MODEL and GEMINI_FALLBACK_MODEL env vars', async () => {
    setupModule();
    mockSendMessage.mockResolvedValue(makeOkResponse('ok'));

    await generateChatResponse('system', [{ role: 'user', content: 'hi' }]);

    expect(mockGetGenerativeModel.mock.calls[0][0]).toMatchObject({ model: 'primary-model' });
  });
});
