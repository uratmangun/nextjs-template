"use client";

import { validateProviderBaseUrl } from "@/lib/provider-url";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type UiModel = {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
};

type ModelsResponse = {
  data?: UiModel[];
  configured?: boolean;
  message?: string | null;
};

type ChatSettings = {
  baseURL: string;
  apiKey: string;
};

type ChatPart = {
  type: "text";
  text: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
};

const STORAGE_KEY = "openai-compatible-chat-settings";

const emptySettings: ChatSettings = {
  baseURL: "",
  apiKey: "",
};

const suggestedPrompts = [
  "Explain how React Server Components differ from client components.",
  "Draft a landing page headline and three supporting bullets for a scholarship verifier app.",
  "Summarize the latest work in this repository and suggest next implementation steps.",
];

function readStoredSettings(): ChatSettings {
  if (typeof window === "undefined") {
    return emptySettings;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return emptySettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ChatSettings>;

    return {
      apiKey: parsed.apiKey?.trim() ?? "",
      baseURL: parsed.baseURL?.trim() ?? "",
    };
  } catch {
    return emptySettings;
  }
}

function createMessage(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    parts: [{ type: "text", text }],
  };
}

function getMessageText(message: ChatMessage) {
  return message.parts.map((part) => part.text).join("\n\n");
}

export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [models, setModels] = useState<UiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelsMessage, setModelsMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings>(emptySettings);
  const [draftSettings, setDraftSettings] = useState<ChatSettings>(emptySettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming" | "error">("ready");
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    const nextSettings = readStoredSettings();
    setSettings(nextSettings);
    setDraftSettings(nextSettings);
    setIsHydrated(true);

    if (!nextSettings.baseURL) {
      setIsSettingsOpen(true);
    }
  }, []);

  const loadModels = useCallback(async (currentSettings: ChatSettings) => {
    if (!currentSettings.baseURL) {
      setModels([]);
      setSelectedModelId("");
      setModelsMessage(null);
      return;
    }

    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(currentSettings),
      });

      if (!response.ok) {
        throw new Error(`Failed to load models (${response.status})`);
      }

      const payload = (await response.json()) as ModelsResponse;
      const nextModels = payload.data ?? [];

      setModels(nextModels);
      setSelectedModelId((current) => {
        if (nextModels.some((model) => model.id === current)) {
          return current;
        }

        return nextModels[0]?.id ?? "";
      });
      setModelsMessage(payload.message ?? null);
    } catch {
      setModels([]);
      setSelectedModelId("");
      setModelsMessage("Could not load models from the configured OpenAI-compatible API.");
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void loadModels(settings);
  }, [isHydrated, loadModels, settings]);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId]
  );

  const groupedModels = useMemo(() => {
    const groups = new Map<string, UiModel[]>();

    for (const model of models) {
      groups.set(model.providerLabel, [...(groups.get(model.providerLabel) ?? []), model]);
    }

    return Array.from(groups.entries());
  }, [models]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      previousMessageCountRef.current = messages.length;
      return;
    }

    if (messages.length > previousMessageCountRef.current) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      });
    }

    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const handleSendText = useCallback(
    async (text: string) => {
      if (!settings.baseURL || !selectedModel) {
        setDraftSettings(settings);
        setSettingsError(null);
        setIsSettingsOpen(true);
        return;
      }

      const trimmedText = text.trim();

      if (!trimmedText || status === "submitted" || status === "streaming") {
        return;
      }

      const userMessage = createMessage("user", trimmedText);
      const assistantMessageId = `assistant-${crypto.randomUUID()}`;

      setChatError(null);
      setStatus("submitted");
      setMessages((current) => [
        ...current,
        userMessage,
        {
          id: assistantMessageId,
          role: "assistant",
          parts: [{ type: "text", text: "" }],
        },
      ]);
      setInput("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: settings.apiKey,
            baseURL: settings.baseURL,
            model: selectedModel.id,
            messages: [...messages, userMessage],
          }),
        });

        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          throw new Error(detail || `Chat request failed with status ${response.status}.`);
        }

        setStatus("streaming");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          assistantText += decoder.decode(value, { stream: true });
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    parts: [{ type: "text", text: assistantText }],
                  }
                : message
            )
          );
        }

        assistantText += decoder.decode();
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  parts: [{ type: "text", text: assistantText || "No response returned." }],
                }
              : message
          )
        );
        setStatus("ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Chat request failed.";
        setMessages((current) => current.filter((entry) => entry.id !== assistantMessageId));
        setChatError(message);
        setStatus("error");
      }
    },
    [messages, selectedModel, settings, status]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleSendText(input);
  };

  const handleSaveSettings = async () => {
    const trimmedSettings = {
      apiKey: draftSettings.apiKey.trim(),
      baseURL: draftSettings.baseURL.trim(),
    };

    const validatedBaseURL = validateProviderBaseUrl(trimmedSettings.baseURL);

    if (!validatedBaseURL.ok) {
      setSettingsError(validatedBaseURL.error);
      return;
    }

    const nextSettings = {
      ...trimmedSettings,
      baseURL: validatedBaseURL.normalizedUrl,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    setSettings(nextSettings);
    setDraftSettings(nextSettings);
    setSettingsError(null);
    setIsSettingsOpen(false);
    await loadModels(nextSettings);
  };

  const handleClearSettings = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setSettings(emptySettings);
    setDraftSettings(emptySettings);
    setModels([]);
    setSelectedModelId("");
    setModelsMessage(null);
    setSettingsError(null);
    setIsSettingsOpen(false);
  };

  const isChatDisabled = !settings.baseURL || !selectedModel;

  return (
    <>
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-10">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-cyan-950/20">
          <header className="border-b border-slate-800 px-6 py-6 sm:px-8">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
                Browser-configured OpenAI-compatible chat template
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Simple streaming chatbot
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                  Add your own public HTTPS OpenAI-compatible base URL, optionally provide an API key,
                  load models, and stream chat responses in the browser.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-slate-300">
                <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5">
                  Model: <span className="font-medium text-white">{selectedModel?.name ?? "Not selected"}</span>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5">
                  Provider: <span className="font-medium text-white">{selectedModel?.providerLabel ?? "OpenAI-compatible API"}</span>
                </div>
                <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 capitalize">
                  Status: <span className="font-medium text-white">{status}</span>
                </div>
                <button
                  className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-white transition hover:border-cyan-400 hover:text-cyan-200"
                  onClick={() => {
                    setDraftSettings(settings);
                    setSettingsError(null);
                    setIsSettingsOpen(true);
                  }}
                  type="button"
                >
                  Settings
                </button>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
            <section className="flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950/70">
              <div className="min-h-0 flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6" ref={viewportRef}>
                  <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4">
                    {messages.length === 0 ? (
                      <div className="flex min-h-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-10 text-center">
                        <h2 className="text-xl font-semibold text-white">
                          {settings.baseURL ? "Start a conversation" : "Add your API settings to begin"}
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                          {settings.baseURL
                            ? "Choose a model, send a message, and streamed responses will appear here."
                            : "Open settings and add a public HTTPS OpenAI-compatible base URL. Localhost and private-network targets are blocked in this public template."}
                        </p>
                        {settings.baseURL ? (
                          <div className="mt-6 grid w-full max-w-2xl gap-3">
                            {suggestedPrompts.map((prompt) => (
                              <button
                                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm leading-6 text-slate-100 transition hover:border-cyan-400 hover:bg-slate-800"
                                key={prompt}
                                onClick={() => setInput(prompt)}
                                type="button"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            className="mt-6 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                            onClick={() => {
                              setDraftSettings(settings);
                              setSettingsError(null);
                              setIsSettingsOpen(true);
                            }}
                            type="button"
                          >
                            Open settings
                          </button>
                        )}
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          key={message.id}
                        >
                          <div
                            className={`max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${
                              message.role === "user"
                                ? "bg-cyan-500 text-slate-950"
                                : "border border-slate-800 bg-slate-900 text-slate-100"
                            }`}
                          >
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                              {message.role === "user" ? "You" : "Assistant"}
                            </div>
                            <div className="space-y-3 whitespace-pre-wrap break-words">
                              {getMessageText(message) || "…"}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 bg-slate-900/90 p-4">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                  {modelsMessage ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      {modelsMessage}
                    </div>
                  ) : null}

                  {chatError ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                      {chatError}
                    </div>
                  ) : null}

                  <form className="rounded-3xl border border-slate-800 bg-slate-950 p-3" onSubmit={handleSubmit}>
                    <label className="sr-only" htmlFor="chat-input">
                      Message
                    </label>
                    <textarea
                      className="min-h-[120px] w-full resize-none rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                      disabled={isChatDisabled}
                      id="chat-input"
                      onChange={(event) => setInput(event.currentTarget.value)}
                      placeholder={
                        isChatDisabled
                          ? "Open settings and add your OpenAI-compatible base URL..."
                          : "Ask about your app, architecture, or anything you want to explore..."
                      }
                      value={input}
                    />

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="sr-only" htmlFor="model-select">
                          Model
                        </label>
                        <select
                          className="min-w-[220px] rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={models.length === 0}
                          id="model-select"
                          onChange={(event) => setSelectedModelId(event.currentTarget.value)}
                          value={selectedModelId}
                        >
                          {models.length === 0 ? (
                            <option value="">No models available</option>
                          ) : (
                            groupedModels.map(([group, items]) => (
                              <optgroup key={group} label={group}>
                                {items.map((model) => (
                                  <option key={model.id} value={model.id}>
                                    {model.name}
                                  </option>
                                ))}
                              </optgroup>
                            ))
                          )}
                        </select>
                        <button
                          className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
                          onClick={() => {
                            setDraftSettings(settings);
                            setSettingsError(null);
                            setIsSettingsOpen(true);
                          }}
                          type="button"
                        >
                          Edit settings
                        </button>
                      </div>

                      <button
                        className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        disabled={!input.trim() || (status !== "ready" && status !== "error") || isChatDisabled}
                        type="submit"
                      >
                        Send message
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/40">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white">Chat provider settings</h2>
              <p className="text-sm leading-6 text-slate-300">
                Add a public HTTPS OpenAI-compatible base URL to enable model loading and chat
                streaming. API key is optional unless your provider requires authentication.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-100" htmlFor="base-url">
                  Base URL
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                  id="base-url"
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setDraftSettings((current) => ({
                      ...current,
                      baseURL: value,
                    }));
                    setSettingsError(null);
                  }}
                  placeholder="https://your-provider.example.com/v1"
                  value={draftSettings.baseURL}
                />
                <p className="text-xs text-slate-400">
                  Required. Must point to a public HTTPS OpenAI-compatible API.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-100" htmlFor="api-key">
                  API key
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                  id="api-key"
                  onChange={(event) => {
                    const { value } = event.currentTarget;
                    setDraftSettings((current) => ({
                      ...current,
                      apiKey: value,
                    }));
                  }}
                  placeholder="Optional"
                  type="password"
                  value={draftSettings.apiKey}
                />
                <p className="text-xs text-slate-400">
                  Optional. Only needed if your provider requires authentication.
                </p>
              </div>

              {settingsError ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {settingsError}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500"
                onClick={handleClearSettings}
                type="button"
              >
                Clear
              </button>
              <button
                className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500"
                onClick={() => {
                  setDraftSettings(settings);
                  setSettingsError(null);
                  setIsSettingsOpen(false);
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                onClick={() => void handleSaveSettings()}
                type="button"
              >
                Save settings
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
