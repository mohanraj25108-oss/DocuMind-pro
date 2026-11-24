"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Loader2,
  MessageSquare,
  PanelLeftOpen,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { useWorkspace } from "./AppShell";

interface ConversationSummary {
  id: string;
  title: string;
  document_id: string | null;
  document_name: string | null;
  category_filter: string | null;
  message_count?: number;
  created_at: string;
  updated_at: string;
}

interface Citation {
  documentId: string;
  documentName: string;
  category: string;
  snippet: string;
}

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  provider: string;
  created_at: string;
}

function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-[#111827]">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const segments = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className={line.trim().startsWith("- ") ? "pl-3" : ""}>
            {segments.map((seg, j) => {
              if (seg.startsWith("**") && seg.endsWith("**")) {
                return (
                  <strong key={j} className="font-semibold text-[#111827]">
                    {seg.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={j}>{seg}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

function HistorySidebar({
  isMobile = false,
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onCloseMobile,
}: {
  isMobile?: boolean;
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onCloseMobile: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
          Conversations
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F7F8FC] px-2 text-xs font-medium text-[#111827] hover:bg-[#EEF2FB]"
          >
            <Plus size={13} />
            New
          </button>
          {isMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="rounded-md p-1 text-[#667085] hover:bg-[#F3F4F6]"
              aria-label="Close conversation list"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-[#667085]">
            No past chats yet. Ask a question to begin.
          </p>
        ) : (
          conversations.map((conv) => {
            const active = activeId === conv.id;
            return (
              <div
                key={conv.id}
                className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                  active
                    ? "bg-[#EEF2FB] text-[#243B64]"
                    : "text-[#111827] hover:bg-[#F7F8FC]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(conv.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare
                    size={13}
                    className={
                      active ? "shrink-0 text-[#4568C7]" : "shrink-0 text-[#667085]"
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{conv.title}</p>
                    {conv.document_name && (
                      <p className="truncate text-[11px] text-[#667085]">
                        {conv.document_name}
                      </p>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(conv.id)}
                  aria-label="Delete conversation"
                  className="rounded p-1 text-[#9CA3AF] opacity-80 hover:bg-[#FEF0F0] hover:text-[#DC5252] sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const SUGGESTED_PROMPTS = [
  "Which warranties or policies are expiring in the next 30 days?",
  "What is my total value across saved invoices and receipts?",
  "List any expired documents that need renewal.",
  "Do I have any gift cards or vouchers?",
];

export function AssistantClient({
  initialConversations,
  documents,
  initialDocumentId = "",
}: {
  initialConversations: ConversationSummary[];
  documents: Array<{ id: string; name: string; category: string }>;
  initialDocumentId?: string;
}) {
  const { settings } = useWorkspace();
  const [conversations, setConversations] =
    useState<ConversationSummary[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    !initialDocumentId && initialConversations[0] ? initialConversations[0].id : null
  );
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [selectedDocId, setSelectedDocId] = useState(initialDocumentId);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);

  const fetchConversationById = useCallback(async (id: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setSelectedDocId(data.conversation?.document_id || "");
        setSelectedCategory(data.conversation?.category_filter || "all");
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/assistant/conversations/${activeId}`, {
          cache: "no-store",
        });
        if (res.ok && active) {
          const data = await res.json();
          if (active) {
            setMessages(data.messages || []);
            setSelectedDocId(data.conversation?.document_id || "");
            setSelectedCategory(data.conversation?.category_filter || "all");
          }
        }
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const refreshConversations = async () => {
    const res = await fetch("/api/assistant/conversations", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations || []);
    }
  };

  const handleNewConversation = () => {
    setActiveId(null);
    setMessages([]);
    setMobileHistoryOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    setMobileHistoryOpen(false);
    void fetchConversationById(id);
  };

  const handleDeleteConversation = async (id: string) => {
    const res = await fetch(`/api/assistant/conversations/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    }
  };

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInput("");

    try {
      if (!activeId) {
        const res = await fetch("/api/assistant/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            documentId: selectedDocId || null,
            categoryFilter: selectedCategory !== "all" ? selectedCategory : null,
          }),
        });
        const data = await res.json();
        if (res.ok && data.conversation) {
          await refreshConversations();
          setActiveId(data.conversation.id);
          await fetchConversationById(data.conversation.id);
        }
      } else {
        const res = await fetch(`/api/assistant/conversations/${activeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            documentId: selectedDocId || null,
            categoryFilter: selectedCategory !== "all" ? selectedCategory : null,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessages(data.messages || []);
          await refreshConversations();
        }
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#111827]">
              AI Assistant
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#E2DDF8] bg-[#F6F4FE] px-2 py-0.5 text-[11px] font-medium text-[#5948BA]">
              <Sparkles size={11} className="text-[#8B7AE8]" />
              {settings.ai_provider === "local"
                ? "Local Workspace Engine"
                : settings.ai_provider === "openai"
                  ? "OpenAI Connected"
                  : "Gemini Connected"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#667085]">
            Ask questions grounded directly in your uploaded documents, metadata, and
            extracted text.
          </p>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileHistoryOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-medium text-[#111827]"
          >
            <PanelLeftOpen size={14} />
            History ({conversations.length})
          </button>
          <button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#243B64] px-3 text-xs font-medium text-white"
          >
            <Plus size={14} />
            New chat
          </button>
        </div>
      </div>

      <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white lg:grid-cols-12">
        <aside className="hidden border-r border-[#E5E7EB] lg:col-span-3 lg:block">
          <HistorySidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
            onCloseMobile={() => setMobileHistoryOpen(false)}
          />
        </aside>

        {mobileHistoryOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-[#111827]/40"
              onClick={() => setMobileHistoryOpen(false)}
            />
            <div className="relative z-10 h-full w-72 max-w-[82vw] border-r border-[#E5E7EB] bg-white">
              <HistorySidebar
                isMobile
                conversations={conversations}
                activeId={activeId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                onDelete={handleDeleteConversation}
                onCloseMobile={() => setMobileHistoryOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col lg:col-span-9">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] bg-[#FAFBFD] px-4 py-3">
            <span className="text-xs font-medium text-[#667085]">Context scope:</span>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              aria-label="Scope to specific document"
              className="h-8 max-w-[240px] rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#111827] focus:border-[#4568C7] focus:outline-none"
            >
              <option value="">All documents ({documents.length})</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {!selectedDocId && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter AI scope by category"
                className="h-8 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs text-[#111827] focus:border-[#4568C7] focus:outline-none"
              >
                <option value="all">All categories</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 max-h-[500px]">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-16 text-xs text-[#667085]">
                <Loader2 size={16} className="mr-2 animate-spin" />
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto max-w-xl py-8 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#E2DDF8] bg-[#F6F4FE] text-[#8B7AE8]">
                  <Sparkles size={20} />
                </div>
                <h2 className="mt-4 font-display text-base font-semibold text-[#111827]">
                  Ask anything about your documents
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#667085]">
                  DocuMind searches across your stored records, extracted text, policy
                  numbers, and expiration dates to return grounded answers with source
                  citations.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 text-left">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendQuestion(prompt)}
                      className="rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] p-3 text-xs font-medium text-[#111827] transition-colors hover:border-[#4568C7] hover:bg-white"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[88%] break-words rounded-xl px-4 py-3 sm:max-w-[78%] ${
                      msg.role === "user"
                        ? "bg-[#243B64] text-white"
                        : "border border-[#E5E7EB] bg-[#F7F8FC] text-[#111827]"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="space-y-3">
                        <FormattedAnswer text={msg.content} />
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="border-t border-[#E5E7EB] pt-2.5">
                            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#667085]">
                              Referenced documents
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.citations.map((cit) => (
                                <Link
                                  key={cit.documentId}
                                  href={`/documents/${cit.documentId}`}
                                  title={cit.snippet}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#4568C7] hover:border-[#4568C7]"
                                >
                                  <FileText size={12} />
                                  <span className="max-w-[180px] truncate">
                                    {cit.documentName}
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F7F8FC] px-4 py-3 text-xs text-[#667085]">
                  <Loader2 size={14} className="animate-spin text-[#8B7AE8]" />
                  Searching your documents and preparing grounded answer...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
            className="border-t border-[#E5E7EB] bg-white p-3 sm:p-4"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
                placeholder="Ask about warranty coverage, expiry dates, policy numbers, or totals..."
                className="h-10 flex-1 rounded-lg border border-[#E5E7EB] bg-[#F7F8FC] px-3.5 text-sm text-[#111827] placeholder:text-[#667085] focus:border-[#4568C7] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#4568C7] px-4 text-sm font-medium text-white transition-colors hover:bg-[#3756AC] disabled:opacity-50"
              >
                <Send size={15} />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
