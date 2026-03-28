export {};

const BaseUrl = "https://api.akindo.io/public";
const DefaultPage = 1;
const DefaultPageSize = 12;
const MaxPageSize = 50;

type WaveHack = Record<string, unknown> & {
  id: string;
  title: string;
};

type WaveHacksResponse = {
  items: WaveHack[];
  meta: {
    totalPages: number;
    totalItems: number;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getFlagValue(args: string[], flag: string): string | null {
  const flagIndex = args.findIndex((arg) => arg === flag);
  if (flagIndex < 0) {
    return null;
  }

  const value = args[flagIndex + 1];
  if (!value || value.startsWith("--")) {
    return null;
  }

  return value;
}

function getCliOptions() {
  const args = process.argv.slice(2);

  const raw = args.includes("--raw");
  const page = parsePositiveInteger(getFlagValue(args, "--page"), DefaultPage);
  const requestedPageSize = parsePositiveInteger(
    getFlagValue(args, "--page-size"),
    DefaultPageSize,
  );
  const pageSize = Math.min(MaxPageSize, requestedPageSize);

  return {
    raw,
    page,
    pageSize,
  };
}

function parseWaveHacksResponse(payload: unknown, page: number): WaveHacksResponse {
  if (!isRecord(payload)) {
    throw new Error(`Invalid response shape on page ${page}: expected object.`);
  }

  const { items, meta } = payload;

  if (!Array.isArray(items)) {
    throw new Error(`Invalid response shape on page ${page}: expected items array.`);
  }

  if (!isRecord(meta)) {
    throw new Error(`Invalid response shape on page ${page}: expected meta object.`);
  }

  if (typeof meta.totalPages !== "number" || typeof meta.totalItems !== "number") {
    throw new Error(`Invalid response meta on page ${page}: missing totalPages/totalItems.`);
  }

  const parsedItems: WaveHack[] = items.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Invalid wave-hack item at page ${page}, index ${index}: expected object.`);
    }

    if (typeof item.id !== "string" || typeof item.title !== "string") {
      throw new Error(
        `Invalid wave-hack item at page ${page}, index ${index}: missing id/title.`,
      );
    }

    return item as WaveHack;
  });

  return {
    items: parsedItems,
    meta: {
      totalPages: meta.totalPages,
      totalItems: meta.totalItems,
    },
  };
}

async function fetchWaveHacksPage(page: number, pageSize: number): Promise<WaveHacksResponse> {
  const url = `${BaseUrl}/wave-hacks?page=${page}&pageSize=${pageSize}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch wave-hacks page ${page}: ${response.status} ${response.statusText}`,
    );
  }

  const data: unknown = await response.json();
  return parseWaveHacksResponse(data, page);
}

function getStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function getNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function getCommunityName(waveHack: WaveHack): string {
  const community = waveHack.community;
  if (!isRecord(community)) {
    return "Unknown community";
  }

  const name = getStringField(community, "name");
  return name ?? "Unknown community";
}

function getWaveCountLabel(waveHack: WaveHack): string {
  const activeWave = waveHack.activeWave;
  if (isRecord(activeWave)) {
    const activeWaveCount = getNumberField(activeWave, "waveCount");
    if (activeWaveCount !== null) {
      return `active wave ${activeWaveCount}`;
    }
  }

  const latestWave = waveHack.latestWave;
  if (isRecord(latestWave)) {
    const latestWaveCount = getNumberField(latestWave, "waveCount");
    if (latestWaveCount !== null) {
      return `latest wave ${latestWaveCount}`;
    }
  }

  return "no wave info";
}

async function main() {
  const { raw, page, pageSize } = getCliOptions();

  console.log(`Fetching wave-hacks page ${page} (pageSize ${pageSize}) from Akindo...`);

  const pageData = await fetchWaveHacksPage(page, pageSize);

  if (raw) {
    console.log(JSON.stringify(pageData, null, 2));
    return;
  }

  const safePage = Math.min(Math.max(page, 1), Math.max(pageData.meta.totalPages, 1));
  const indexOffset = (safePage - 1) * pageSize;

  console.log(
    `\nFetched ${pageData.items.length} wave-hacks on page ${safePage}/${pageData.meta.totalPages} (total ${pageData.meta.totalItems}).`,
  );
  console.log("\n--- Wave Hacks ---");

  for (const [index, waveHack] of pageData.items.entries()) {
    const tagline = getStringField(waveHack, "tagline") ?? "No tagline";
    const builderCount = getNumberField(waveHack, "builderCount") ?? 0;

    console.log(`${indexOffset + index + 1}. ${waveHack.title} (${waveHack.id})`);
    console.log(`   Community: ${getCommunityName(waveHack)}`);
    console.log(`   Builders: ${builderCount}`);
    console.log(`   Wave: ${getWaveCountLabel(waveHack)}`);
    console.log(`   Tagline: ${tagline}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error("Error fetching wave-hacks:", error);
  process.exitCode = 1;
});
