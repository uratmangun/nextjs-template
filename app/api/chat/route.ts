import { NextResponse } from "next/server";

import { validateProviderBaseUrl } from "@/lib/provider-url";

export const maxDuration = 30;

type ChatMessage = {
  role?: string;
  parts?: Array<{
    type?: string;
    text?: string;
  }>;
};

type ChatRequest = {
  messages?: ChatMessage[];
  model?: string;
  baseURL?: string;
  apiKey?: string;
};

function normalizeMessages(messages: ChatMessage[]) {
  return messages
    .map((message) => {
      const role = message.role === "assistant" ? "assistant" : "user";
      const text = (message.parts ?? [])
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text?.trim() ?? "")
        .filter(Boolean)
        .join("\n\n");

      if (!text) {
        return null;
      }

      return {
        role,
        content: text,
      };
    })
    .filter((message): message is { role: "user" | "assistant"; content: string } => message !== null);
}

export async function POST(request: Request) {
  const {
    messages = [],
    model,
    baseURL: rawBaseURL,
    apiKey: rawApiKey,
  }: ChatRequest = await request.json();

  const baseURL = rawBaseURL?.trim() ?? "";
  const apiKey = rawApiKey?.trim();
  const validatedBaseURL = validateProviderBaseUrl(baseURL);

  if (!validatedBaseURL.ok) {
    return NextResponse.json(
      {
        error: validatedBaseURL.error,
      },
      { status: 400 }
    );
  }

  const normalizedMessages = normalizeMessages(messages);

  if (normalizedMessages.length === 0) {
    return NextResponse.json(
      {
        error: "Add a message before sending a chat request.",
      },
      { status: 400 }
    );
  }

  const upstreamResponse = await fetch(`${validatedBaseURL.normalizedUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
          }
        : {}),
    },
    body: JSON.stringify({
      model: model?.trim() || "titan-5.4",
      messages: normalizedMessages,
      stream: true,
    }),
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const detail = await upstreamResponse.text().catch(() => "");

    return NextResponse.json(
      {
        error: detail || `Chat request failed with status ${upstreamResponse.status}.`,
      },
      { status: upstreamResponse.status || 500 }
    );
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamResponse.body!.getReader();
      let buffer = "";

      const flushDataLine = (line: string) => {
        const value = line.slice(5).trim();

        if (!value || value === "[DONE]") {
          return;
        }

        try {
          const payload = JSON.parse(value) as {
            choices?: Array<{
              delta?: {
                content?: string;
              };
            }>;
          };
          const content = payload.choices?.[0]?.delta?.content;

          if (!content) {
            return;
          }

          controller.enqueue(encoder.encode(content));
        } catch {
          // Ignore malformed SSE chunks from upstream.
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            buffer += decoder.decode();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data:")) {
              flushDataLine(line);
            }
          }
        }

        if (buffer.startsWith("data:")) {
          flushDataLine(buffer);
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
