const ipv4Pattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isPrivateIpv4(hostname: string) {
  if (!ipv4Pattern.test(hostname)) {
    return false;
  }

  const octets = hostname.split(".").map((value) => Number(value));

  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isLocalOrPrivateHostname(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (!normalized) {
    return true;
  }

  if (normalized === "localhost" || normalized.endsWith(".localhost")) {
    return true;
  }

  if (isPrivateIpv4(normalized)) {
    return true;
  }

  if (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  return false;
}

export type ProviderBaseUrlValidationResult =
  | {
      ok: true;
      normalizedUrl: string;
    }
  | {
      ok: false;
      error: string;
    };

export function validateProviderBaseUrl(rawValue: string): ProviderBaseUrlValidationResult {
  const value = rawValue.trim();

  if (!value) {
    return {
      ok: false,
      error: "Base URL is required and must point to a public HTTPS OpenAI-compatible API.",
    };
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      error: "Base URL must be a valid HTTPS URL such as https://api.openai.com/v1.",
    };
  }

  if (url.protocol !== "https:") {
    return {
      ok: false,
      error: "Base URL must use HTTPS.",
    };
  }

  if (!url.hostname) {
    return {
      ok: false,
      error: "Base URL must include a hostname.",
    };
  }

  if (url.username || url.password) {
    return {
      ok: false,
      error: "Base URL must not include embedded credentials.",
    };
  }

  if (url.search || url.hash) {
    return {
      ok: false,
      error: "Base URL must not include query strings or hash fragments.",
    };
  }

  if (isLocalOrPrivateHostname(url.hostname)) {
    return {
      ok: false,
      error: "Base URL must target a public HTTPS host. Localhost and private network addresses are not allowed.",
    };
  }

  return {
    ok: true,
    normalizedUrl: url.toString().replace(/\/$/, ""),
  };
}
