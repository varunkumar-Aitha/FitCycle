// RAG retrieval using TF-IDF — no embedding API required.
// Nutrition documents are keyword-rich (food names, macros, meal types) so
// TF-IDF scoring finds the right sections as reliably as vector similarity.

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function chunkText(text, chunkSize = 600, overlap = 100) {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 40) chunks.push(chunk);
    if (end === normalized.length) break;
    start = end - overlap;
  }

  return chunks;
}

// Synchronous — no network call needed
function retrieveRelevantChunks(queryText, storedChunks, topK = 4) {
  const queryTerms = tokenize(queryText);
  if (queryTerms.length === 0 || storedChunks.length === 0) return [];

  // Single-chunk document: TF-IDF degenerates to zero (log(2/2)=0) — return it directly
  if (storedChunks.length === 1) {
    return [{ text: storedChunks[0].text, score: 1 }];
  }

  const N = storedChunks.length;

  // Document frequency: how many chunks contain each term
  const df = {};
  storedChunks.forEach(chunk => {
    const terms = new Set(tokenize(chunk.text));
    terms.forEach(t => { df[t] = (df[t] || 0) + 1; });
  });

  // Score each chunk using smoothed IDF: log(1 + (N+1)/(df+1))
  // Always positive — avoids the zero-score trap when a term appears in every chunk
  const scored = storedChunks.map(chunk => {
    const terms = tokenize(chunk.text);
    const tf = {};
    terms.forEach(t => { tf[t] = (tf[t] || 0) + 1; });

    let score = 0;
    queryTerms.forEach(qt => {
      if (tf[qt]) {
        const tfScore = tf[qt] / terms.length;
        const idfScore = Math.log(1 + (N + 1) / ((df[qt] || 0) + 1));
        score += tfScore * idfScore;
      }
    });

    return { text: chunk.text, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter(c => c.score > 0);
}

module.exports = { chunkText, retrieveRelevantChunks };
