import crypto from "node:crypto";
import { getDb } from "./db";
import { decryptSecret } from "./crypto";
import { ensureUserSettings, logActivity } from "./auth";
import { listUserDocuments, type DocumentItem } from "./documents";
import { formatCurrency, formatRelativeDays, getTodayIso } from "./constants";

export interface CitationItem {
  documentId: string;
  documentName: string;
  category: string;
  snippet: string;
}

export interface AssistantResponse {
  answer: string;
  citations: CitationItem[];
  provider: string;
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "what",
  "which",
  "when",
  "where",
  "who",
  "how",
  "my",
  "me",
  "i",
  "do",
  "does",
  "have",
  "has",
  "had",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "about",
  "from",
  "any",
  "all",
  "can",
  "you",
  "tell",
  "show",
  "give",
  "find",
  "please",
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

function scoreDocument(doc: DocumentItem, tokens: string[], rawQuery: string): number {
  const qLower = rawQuery.toLowerCase();
  const titleLower = doc.name.toLowerCase();
  const issuerLower = doc.issuer.toLowerCase();
  const catLower = doc.category.toLowerCase();
  const policyLower = doc.policy_number.toLowerCase();
  const tagsLower = doc.tags.join(" ").toLowerCase();
  const bodyLower = `${doc.notes}\n${doc.ai_summary}\n${doc.extracted_text}`.toLowerCase();

  let score = 0;
  if (qLower.includes(titleLower) && titleLower.length > 2) score += 20;
  if (issuerLower && qLower.includes(issuerLower) && issuerLower.length > 2) score += 12;

  for (const tok of tokens) {
    if (titleLower.includes(tok)) score += 6;
    if (issuerLower.includes(tok)) score += 5;
    if (catLower.includes(tok)) score += 4;
    if (policyLower.includes(tok)) score += 6;
    if (tagsLower.includes(tok)) score += 5;
    if (bodyLower.includes(tok)) score += 2;
  }
  return score;
}

function extractRelevantExcerpt(doc: DocumentItem, tokens: string[]): string {
  const sourceText = doc.extracted_text || doc.notes || doc.ai_summary;
  if (!sourceText) {
    const parts = [
      doc.category,
      doc.issuer ? `Issuer: ${doc.issuer}` : "",
      doc.policy_number ? `Ref: ${doc.policy_number}` : "",
      doc.expiry_date ? `Expiry: ${doc.expiry_date}` : "",
    ].filter(Boolean);
    return parts.join(" • ");
  }

  const sentences = sourceText
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((s) => s.trim().length > 8);

  if (sentences.length === 0) return sourceText.slice(0, 180);

  let best = sentences[0];
  let bestScore = -1;
  for (const s of sentences.slice(0, 80)) {
    const lower = s.toLowerCase();
    let sc = 0;
    for (const t of tokens) {
      if (lower.includes(t)) sc += 1;
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return best.slice(0, 220);
}

function generateLocalAnswer(params: {
  question: string;
  docs: DocumentItem[];
  scopedDocId?: string | null;
  currency: string;
}): AssistantResponse {
  const { question, docs, scopedDocId, currency } = params;
  const q = question.trim();
  const qLower = q.toLowerCase();

  if (docs.length === 0) {
    return {
      answer:
        "You don't have any documents in this workspace scope yet. Upload a PDF or image, or add a document manually, and I will immediately analyze its contents, track expiries, and answer questions grounded in your records.",
      citations: [],
      provider: "local",
    };
  }

  // If scoped to a specific document
  if (scopedDocId) {
    const target = docs.find((d) => d.id === scopedDocId);
    if (target) {
      const tokens = tokenize(q);
      const excerpt = extractRelevantExcerpt(target, tokens);

      if (/summar|overview|what is this|details|explain/i.test(qLower)) {
        const lines = [
          `**${target.name}** (${target.category})`,
          target.issuer ? `- **Issuer / Company:** ${target.issuer}` : null,
          target.purchase_date ? `- **Purchase / Issue Date:** ${target.purchase_date}` : null,
          target.expiry_date
            ? `- **Expiry Date:** ${target.expiry_date} (${formatRelativeDays(target.days_until_expiry)})`
            : `- **Expiry Date:** No expiry set`,
          target.warranty_duration ? `- **Warranty Duration:** ${target.warranty_duration}` : null,
          target.policy_number ? `- **Policy / Ref Number:** ${target.policy_number}` : null,
          target.amount !== null
            ? `- **Amount / Value:** ${formatCurrency(target.amount, target.currency)}`
            : null,
          target.notes ? `- **Notes:** ${target.notes}` : null,
          target.extracted_text
            ? `\n**Key extracted context:** ${excerpt}`
            : null,
        ].filter(Boolean);

        return {
          answer: lines.join("\n"),
          citations: [
            {
              documentId: target.id,
              documentName: target.name,
              category: target.category,
              snippet: excerpt,
            },
          ],
          provider: "local",
        };
      }

      if (/expir|valid|renew|end|when does/i.test(qLower)) {
        const ans = target.expiry_date
          ? `**${target.name}** expires on **${target.expiry_date}** (${formatRelativeDays(target.days_until_expiry)}).${
              target.warranty_duration ? ` Coverage duration recorded: ${target.warranty_duration}.` : ""
            }`
          : `**${target.name}** does not currently have an expiry date recorded.${
              target.purchase_date ? ` Purchase date is ${target.purchase_date}.` : ""
            }`;
        return {
          answer: ans,
          citations: [
            {
              documentId: target.id,
              documentName: target.name,
              category: target.category,
              snippet: excerpt,
            },
          ],
          provider: "local",
        };
      }

      if (/policy|number|serial|code|invoice #|ref/i.test(qLower)) {
        const ans = target.policy_number
          ? `The recorded policy / reference number for **${target.name}** is **${target.policy_number}**.`
          : `No separate policy or reference number is stored on **${target.name}**. Extracted context: "${excerpt}"`;
        return {
          answer: ans,
          citations: [
            {
              documentId: target.id,
              documentName: target.name,
              category: target.category,
              snippet: excerpt,
            },
          ],
          provider: "local",
        };
      }

      return {
        answer: `From **${target.name}**${target.issuer ? ` (${target.issuer})` : ""}:\n\n${
          target.extracted_text
            ? `Closest matching excerpt: "${excerpt}"`
            : target.ai_summary || target.notes || "No embedded text extracted yet."
        }\n\n${
          target.expiry_date
            ? `Status: ${formatRelativeDays(target.days_until_expiry)} (${target.expiry_date}).`
            : ""
        }`.trim(),
        citations: [
          {
            documentId: target.id,
            documentName: target.name,
            category: target.category,
            snippet: excerpt,
          },
        ],
        provider: "local",
      };
    }
  }

  // Global / multi-document queries
  // 1. Expiry / expiring soon / expired queries
  if (/(expir|renew|due|upcoming|ending|outdated|valid)/i.test(qLower)) {
    const daysMatch = qLower.match(/next\s+(\d+)\s+day/);
    const horizon = daysMatch ? Number(daysMatch[1]) : 30;
    const wantsExpiredOnly = /\bexpired\b/i.test(qLower) && !/soon|upcoming|next/i.test(qLower);

    const relevant = docs
      .filter((d) => {
        if (d.days_until_expiry === null) return false;
        if (wantsExpiredOnly) return d.days_until_expiry < 0;
        return d.days_until_expiry >= -7 && d.days_until_expiry <= horizon;
      })
      .sort((a, b) => (a.days_until_expiry ?? 9999) - (b.days_until_expiry ?? 9999));

    if (relevant.length === 0) {
      const nextUpcoming = docs
        .filter((d) => (d.days_until_expiry ?? -1) >= 0)
        .sort((a, b) => (a.days_until_expiry ?? 9999) - (b.days_until_expiry ?? 9999))
        .slice(0, 3);

      const extra =
        nextUpcoming.length > 0
          ? `\n\nNext upcoming expirations beyond that window:\n${nextUpcoming
              .map(
                (d) =>
                  `- **${d.name}** (${d.category}) — ${d.expiry_date} (${formatRelativeDays(d.days_until_expiry)})`
              )
              .join("\n")}`
          : "";

      return {
        answer: wantsExpiredOnly
          ? `You currently have **0 expired documents** across your ${docs.length} saved record(s).${extra}`
          : `You have **0 documents expiring within ${horizon} days**.${extra}`,
        citations: nextUpcoming.map((d) => ({
          documentId: d.id,
          documentName: d.name,
          category: d.category,
          snippet: `${d.expiry_date} (${formatRelativeDays(d.days_until_expiry)})`,
        })),
        provider: "local",
      };
    }

    const listText = relevant
      .slice(0, 10)
      .map(
        (d) =>
          `- **${d.name}** (${d.category}${d.issuer ? `, ${d.issuer}` : ""}) — **${d.expiry_date}** (${formatRelativeDays(d.days_until_expiry)})`
      )
      .join("\n");

    return {
      answer: wantsExpiredOnly
        ? `Found **${relevant.length} expired document(s)** in your workspace:\n\n${listText}`
        : `Found **${relevant.length} document(s)** expiring within ${horizon} days (or recently expired):\n\n${listText}`,
      citations: relevant.slice(0, 6).map((d) => ({
        documentId: d.id,
        documentName: d.name,
        category: d.category,
        snippet: `${d.expiry_date} • ${formatRelativeDays(d.days_until_expiry)}`,
      })),
      provider: "local",
    };
  }

  // 2. Total spending / amount / value queries
  if (/(how much|total|spend|spent|amount|value|worth|cost|sum)/i.test(qLower)) {
    const tokens = tokenize(q);
    const matching = docs.filter((d) => {
      if (d.amount === null) return false;
      if (tokens.some((t) => d.category.toLowerCase().includes(t))) return true;
      if (tokens.some((t) => d.name.toLowerCase().includes(t) || d.issuer.toLowerCase().includes(t)))
        return true;
      return false;
    });
    const pool = matching.length > 0 ? matching : docs.filter((d) => d.amount !== null);
    if (pool.length === 0) {
      return {
        answer: "None of your matching documents currently have an amount or monetary value recorded.",
        citations: [],
        provider: "local",
      };
    }

    const byCurrency = new Map<string, number>();
    for (const d of pool) {
      const curr = d.currency || currency;
      byCurrency.set(curr, (byCurrency.get(curr) || 0) + (d.amount ?? 0));
    }
    const totals = Array.from(byCurrency.entries())
      .map(([c, v]) => `**${formatCurrency(v, c)}**`)
      .join(" + ");

    const topItems = pool
      .slice()
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .slice(0, 6);

    return {
      answer: `Across **${pool.length} document(s)** with recorded values, the combined total is ${totals}:\n\n${topItems
        .map(
          (d) =>
            `- **${d.name}** (${d.category}) — ${formatCurrency(d.amount, d.currency)}${
              d.purchase_date ? ` on ${d.purchase_date}` : ""
            }`
        )
        .join("\n")}`,
      citations: topItems.map((d) => ({
        documentId: d.id,
        documentName: d.name,
        category: d.category,
        snippet: formatCurrency(d.amount, d.currency),
      })),
      provider: "local",
    };
  }

  // 3. General ranked search & extractive Q&A across all documents
  const tokens = tokenize(q);
  const scored = docs
    .map((doc) => ({ doc, score: scoreDocument(doc, tokens, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0) {
    const sampleNames = docs
      .slice(0, 4)
      .map((d) => `"${d.name}"`)
      .join(", ");
    return {
      answer: `I checked your **${docs.length} saved document(s)** (${sampleNames}${
        docs.length > 4 ? ", …" : ""
      }), and didn't find a direct match for "${q}". Try asking with the issuer name, category, policy number, or select a specific document from the scope selector above.`,
      citations: [],
      provider: "local",
    };
  }

  const top = scored[0].doc;
  const topExcerpt = extractRelevantExcerpt(top, tokens);
  const lines = scored.map(({ doc }) => {
    const meta: string[] = [doc.category];
    if (doc.issuer) meta.push(doc.issuer);
    if (doc.policy_number) meta.push(`Ref: ${doc.policy_number}`);
    if (doc.amount !== null) meta.push(formatCurrency(doc.amount, doc.currency));
    if (doc.expiry_date) meta.push(`Expires ${doc.expiry_date}`);
    return `- **${doc.name}** (${meta.join(" • ")})`;
  });

  return {
    answer: `Based on your saved documents, the strongest match is **${top.name}**:\n\n${topExcerpt}\n\n**Matching records (${scored.length}):**\n${lines.join("\n")}`,
    citations: scored.map(({ doc }) => ({
      documentId: doc.id,
      documentName: doc.name,
      category: doc.category,
      snippet: extractRelevantExcerpt(doc, tokens),
    })),
    provider: "local",
  };
}

async function callExternalProvider(params: {
  provider: "openai" | "gemini";
  apiKey: string;
  model: string;
  question: string;
  history: Array<{ role: string; content: string }>;
  docs: DocumentItem[];
}): Promise<string | null> {
  const contextBlocks = params.docs
    .slice(0, 12)
    .map((d, idx) =>
      [
        `[Doc ${idx + 1}] Name: ${d.name}`,
        `Category: ${d.category}`,
        d.issuer ? `Issuer: ${d.issuer}` : "",
        d.purchase_date ? `Purchase Date: ${d.purchase_date}` : "",
        d.expiry_date ? `Expiry Date: ${d.expiry_date}` : "",
        d.warranty_duration ? `Warranty: ${d.warranty_duration}` : "",
        d.policy_number ? `Policy/Ref: ${d.policy_number}` : "",
        d.amount !== null ? `Amount: ${formatCurrency(d.amount, d.currency)}` : "",
        d.notes ? `Notes: ${d.notes}` : "",
        d.extracted_text ? `Text Excerpt: ${d.extracted_text.slice(0, 1500)}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n---\n");

  const systemPrompt = `You are DocuMind AI, an intelligent personal document assistant. Today is ${getTodayIso()}.
Answer ONLY using the user's real documents provided below. Cite document names explicitly. Never invent documents or fields that are not present.\n\nUSER DOCUMENTS:\n${contextBlocks}`;

  try {
    if (params.provider === "openai") {
      const model = params.model || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            ...params.history.slice(-8),
            { role: "user", content: params.question },
          ],
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || null;
    }

    if (params.provider === "gemini") {
      const model = params.model || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(params.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              ...params.history.slice(-8).map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
              { role: "user", parts: [{ text: params.question }] },
            ],
          }),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function runAssistantTurn(params: {
  userId: string;
  conversationId: string;
  question: string;
  documentId?: string | null;
  categoryFilter?: string | null;
}): Promise<{ userMessageId: string; assistantMessageId: string; response: AssistantResponse }> {
  const db = getDb();
  const settings = ensureUserSettings(params.userId);
  const allDocs = listUserDocuments(params.userId, {
    category: params.categoryFilter || "all",
  });
  const scopedDocs = params.documentId
    ? allDocs.filter((d) => d.id === params.documentId)
    : allDocs;

  const historyRows = db
    .prepare(
      `SELECT role, content FROM ai_messages
       WHERE conversation_id = ? AND user_id = ?
       ORDER BY created_at ASC`
    )
    .all(params.conversationId, params.userId);
  const history = historyRows.map((r) => ({
    role: String(r.role),
    content: String(r.content),
  }));

  let response = generateLocalAnswer({
    question: params.question,
    docs: scopedDocs,
    scopedDocId: params.documentId,
    currency: settings.currency,
  });

  // If external AI provider is configured and key exists, enrich answer using grounded RAG context
  if (settings.ai_provider !== "local" && scopedDocs.length > 0) {
    const row = db
      .prepare("SELECT ai_api_key_enc FROM user_settings WHERE user_id = ?")
      .get(params.userId) as Record<string, unknown> | undefined;
    const encryptedKey = row?.ai_api_key_enc ? String(row.ai_api_key_enc) : "";
    const envFallback =
      params.userId && settings.ai_provider === "openai"
        ? process.env.OPENAI_API_KEY || ""
        : process.env.GEMINI_API_KEY || "";
    const apiKey = decryptSecret(encryptedKey) || envFallback;

    if (apiKey) {
      const tokens = tokenize(params.question);
      const ranked = scopedDocs
        .map((d) => ({ d, s: scoreDocument(d, tokens, params.question) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map((x) => x.d);

      const externalText = await callExternalProvider({
        provider: settings.ai_provider,
        apiKey,
        model: settings.ai_model,
        question: params.question,
        history,
        docs: ranked.length > 0 ? ranked : scopedDocs.slice(0, 8),
      });

      if (externalText) {
        response = {
          answer: externalText,
          citations: ranked.slice(0, 4).map((doc) => ({
            documentId: doc.id,
            documentName: doc.name,
            category: doc.category,
            snippet: extractRelevantExcerpt(doc, tokens),
          })),
          provider: settings.ai_provider,
        };
      }
    }
  }

  const now = new Date().toISOString();
  const userMessageId = crypto.randomUUID();
  const assistantMessageId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO ai_messages (id, conversation_id, user_id, role, content, citations_json, provider, created_at)
     VALUES (?, ?, ?, 'user', ?, '[]', 'user', ?)`
  ).run(userMessageId, params.conversationId, params.userId, params.question.trim(), now);

  const assistantTime = new Date(Date.now() + 1).toISOString();
  db.prepare(
    `INSERT INTO ai_messages (id, conversation_id, user_id, role, content, citations_json, provider, created_at)
     VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?)`
  ).run(
    assistantMessageId,
    params.conversationId,
    params.userId,
    response.answer,
    JSON.stringify(response.citations),
    response.provider,
    assistantTime
  );

  // Auto-title conversation from first question if still generic
  const convRow = db
    .prepare("SELECT title FROM ai_conversations WHERE id = ? AND user_id = ?")
    .get(params.conversationId, params.userId) as Record<string, unknown> | undefined;
  const nextTitle =
    convRow && String(convRow.title) === "New conversation"
      ? params.question.trim().slice(0, 54)
      : String(convRow?.title || "Conversation");

  db.prepare(
    "UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  ).run(nextTitle, assistantTime, params.conversationId, params.userId);

  logActivity({
    userId: params.userId,
    action: "ai.message",
    entityType: "conversation",
    entityId: params.conversationId,
    entityName: nextTitle,
    details: params.question.trim().slice(0, 90),
  });

  return { userMessageId, assistantMessageId, response };
}
