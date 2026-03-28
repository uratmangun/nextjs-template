import { NextResponse } from "next/server";

import { validateProviderBaseUrl } from "@/lib/provider-url";

type ProxyModel = {
  id?: string;
  object?: string;
  created?: number;
  owned_by?: string;
};

type ProxyModelsResponse = {
  data?: ProxyModel[];
};

type UiModel = {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
};

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferProvider(modelId: string) {
  const normalized = modelId.toLowerCase();

  if (normalized.includes("gemini")) {
    return { provider: "google", providerLabel: "Google" };
  }

  if (normalized.includes("qwen")) {
    return { provider: "alibaba", providerLabel: "Alibaba" };
  }

  if (normalized.includes("claude")) {
    return { provider: "anthropic", providerLabel: "Anthropic" };
  }

  if (normalized.includes("llama")) {
    return { provider: "llama", providerLabel: "Llama" };
  }

  if (normalized.includes("mistral")) {
    return { provider: "mistral", providerLabel: "Mistral" };
  }

  if (normalized.includes("deepseek")) {
    return { provider: "deepseek", providerLabel: "DeepSeek" };
  }

  if (normalized.includes("grok")) {
    return { provider: "xai", providerLabel: "xAI" };
  }

  return { provider: "openai", providerLabel: "OpenAI-compatible" };
}

function humanizeModelName(modelId: string) {
  return modelId
    .split(/[/:]/)
    .pop()
    ?.split("-")
    .map((part) => {
      if (/^\d+(?:\.\d+)?$/.test(part)) {
        return part;
      }

      if (part.length <= 3) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ") || modelId;
}

function normalizeModel(model: ProxyModel): UiModel | null {
  const id = model.id?.trim();

  if (!id) {
    return null;
  }

  const owner = model.owned_by?.trim();
  const inferred = inferProvider(id);

  return {
    id,
    name: humanizeModelName(id),
    provider: inferred.provider,
    providerLabel: owner ? toTitleCase(owner) : inferred.providerLabel,
  };
}

export async function POST(request: Request) {
  const { baseURL: rawBaseURL, apiKey: rawApiKey } = (await request.json()) as {
    baseURL?: string;
    apiKey?: string;
  };

  const baseURL = rawBaseURL?.trim() ?? "";
  const apiKey = rawApiKey?.trim();

  if (!baseURL) {
    return NextResponse.json(
      {
        data: [],
        configured: false,
        message:
          "Open settings and add an OpenAI-compatible base URL to load models.",
      },
      { status: 200 }
    );
  }

  const validatedBaseURL = validateProviderBaseUrl(baseURL);

  if (!validatedBaseURL.ok) {
    return NextResponse.json(
      {
        data: [],
        configured: true,
        message: validatedBaseURL.error,
      },
      { status: 200 }
    );
  }

  try {
    const response = await fetch(`${validatedBaseURL.normalizedUrl}/models`, {
      headers: apiKey
        ? {
            Authorization: `Bearer ${apiKey}`,
          }
        : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Model fetch failed with status ${response.status}`);
    }

    const payload = (await response.json()) as ProxyModelsResponse;
    const normalized = (payload.data ?? [])
      .map(normalizeModel)
      .filter((model): model is UiModel => model !== null);

    return NextResponse.json({
      data: normalized,
      configured: true,
      message:
        normalized.length === 0
          ? "No models were returned by the configured OpenAI-compatible API."
          : null,
    });
  } catch {
    return NextResponse.json(
      {
        data: [],
        configured: true,
        message:
          "Could not load models from the configured OpenAI-compatible API.",
      },
      { status: 200 }
    );
  }
}
