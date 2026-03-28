export {};

const BaseUrl = "https://api.akindo.io/public";
const DefaultWaveHackId = "X4ZV12Z6GSMEkmOkX";
const DefaultPage = 1;
const DefaultPageSize = 5;
const MaxPageSize = 50;

type TimelineWave = {
  id: string;
  waveHackId: string;
  waveCount: number;
  grantAmount: string | null;
  openedAt: string | null;
  startedAt: string | null;
  submissionDeadline: string | null;
  judgementDeadline: string | null;
  completedAt: string | null;
  totalSubmissionCount: number | null;
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMeta;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringOrNull(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readNumberOrNull(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
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

function paginateArray<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: items.slice(startIndex, endIndex),
    meta: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  };
}

function parseTimelineWave(item: unknown, index: number): TimelineWave {
  if (!isRecord(item)) {
    throw new Error(`Invalid timeline entry at index ${index}: expected object.`);
  }

  if (typeof item.id !== "string") {
    throw new Error(`Invalid timeline entry at index ${index}: missing id.`);
  }

  if (typeof item.waveHackId !== "string") {
    throw new Error(`Invalid timeline entry at index ${index}: missing waveHackId.`);
  }

  if (typeof item.waveCount !== "number") {
    throw new Error(`Invalid timeline entry at index ${index}: missing waveCount.`);
  }

  return {
    id: item.id,
    waveHackId: item.waveHackId,
    waveCount: item.waveCount,
    grantAmount: readStringOrNull(item, "grantAmount"),
    openedAt: readStringOrNull(item, "openedAt"),
    startedAt: readStringOrNull(item, "startedAt"),
    submissionDeadline: readStringOrNull(item, "submissionDeadline"),
    judgementDeadline: readStringOrNull(item, "judgementDeadline"),
    completedAt: readStringOrNull(item, "completedAt"),
    totalSubmissionCount: readNumberOrNull(item, "totalSubmissionCount"),
  };
}

function parseTimelineResponse(payload: unknown, page: number, pageSize: number): PaginatedResult<TimelineWave> {
  if (Array.isArray(payload)) {
    const sorted = [...payload].sort((left, right) => {
      const leftRecord = isRecord(left) ? left : null;
      const rightRecord = isRecord(right) ? right : null;
      const leftWaveCount = leftRecord && typeof leftRecord.waveCount === "number" ? leftRecord.waveCount : 0;
      const rightWaveCount = rightRecord && typeof rightRecord.waveCount === "number" ? rightRecord.waveCount : 0;

      return leftWaveCount - rightWaveCount;
    });

    const paginated = paginateArray(sorted, page, pageSize);

    return {
      items: paginated.items.map((item, index) => parseTimelineWave(item, index)),
      meta: paginated.meta,
    };
  }

  if (!isRecord(payload)) {
    throw new Error("Invalid timeline response: expected array or object.");
  }

  const items = payload.items;
  const meta = payload.meta;

  if (!Array.isArray(items) || !isRecord(meta)) {
    throw new Error("Invalid timeline response: missing items/meta.");
  }

  if (typeof meta.totalPages !== "number" || typeof meta.totalItems !== "number") {
    throw new Error("Invalid timeline response meta: missing totalPages/totalItems.");
  }

  const safePage = Math.min(Math.max(page, 1), Math.max(meta.totalPages, 1));

  return {
    items: items.map((item, index) => parseTimelineWave(item, index)),
    meta: {
      page: safePage,
      pageSize,
      totalItems: meta.totalItems,
      totalPages: Math.max(meta.totalPages, 1),
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < Math.max(meta.totalPages, 1),
    },
  };
}

function formatDateLabel(isoDate: string | null): string {
  if (!isoDate) {
    return "N/A";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toISOString();
}

function getCliOptions() {
  const args = process.argv.slice(2);

  const raw = args.includes("--raw");
  const waveHackId =
    getFlagValue(args, "--wave-hack-id") ??
    args.find((arg) => !arg.startsWith("-")) ??
    process.env.AKINDO_WAVE_HACK_ID ??
    DefaultWaveHackId;

  const page = parsePositiveInteger(getFlagValue(args, "--page"), DefaultPage);
  const requestedPageSize = parsePositiveInteger(
    getFlagValue(args, "--page-size"),
    DefaultPageSize,
  );
  const pageSize = Math.min(MaxPageSize, requestedPageSize);

  return { raw, waveHackId, page, pageSize };
}

async function fetchTimeline(
  waveHackId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<TimelineWave>> {
  const url = `${BaseUrl}/wave-hacks/${waveHackId}/waves?page=${page}&pageSize=${pageSize}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch wave timeline: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  return parseTimelineResponse(data, page, pageSize);
}

async function main() {
  const { raw, waveHackId, page, pageSize } = getCliOptions();

  console.log(
    `Fetching timeline for WaveHack: ${waveHackId} (page ${page}, pageSize ${pageSize})...`,
  );

  const timeline = await fetchTimeline(waveHackId, page, pageSize);

  console.log(
    `Fetched ${timeline.items.length} waves on page ${timeline.meta.page}/${timeline.meta.totalPages} (total ${timeline.meta.totalItems}).`,
  );

  if (raw) {
    console.log(JSON.stringify(timeline, null, 2));
    return;
  }

  const indexOffset = (timeline.meta.page - 1) * timeline.meta.pageSize;

  console.log("\n--- Wave Timeline ---");

  for (const [index, wave] of timeline.items.entries()) {
    console.log(`${indexOffset + index + 1}. Wave ${wave.waveCount} (${wave.id})`);
    console.log(`   Opened: ${formatDateLabel(wave.openedAt)}`);
    console.log(`   Started: ${formatDateLabel(wave.startedAt)}`);
    console.log(`   Submission Deadline: ${formatDateLabel(wave.submissionDeadline)}`);
    console.log(`   Judgement Deadline: ${formatDateLabel(wave.judgementDeadline)}`);
    console.log(`   Completed: ${formatDateLabel(wave.completedAt)}`);
    console.log(`   Total Submissions: ${wave.totalSubmissionCount ?? "N/A"}`);
    console.log(`   Grant Amount: ${wave.grantAmount ?? "N/A"}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error("Error fetching wave timeline:", error);
  process.exitCode = 1;
});
