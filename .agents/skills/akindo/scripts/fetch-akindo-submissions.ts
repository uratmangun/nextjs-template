export {};

const BaseUrl = "https://api.akindo.io/public";
const DefaultPage = 1;
const DefaultPageSize = 10;
const MaxPageSize = 50;

type Wave = {
  id: string;
  waveCount: number;
};

type Product = {
  id: string;
  name: string;
  tagline: string | null;
  deliverableUrl: string | null;
  githubRepositoryName: string | null;
  isPublic: boolean | null;
  communityId: string | null;
  videoUrl: string | null;
};
type SubmissionLinks = {
  all: string[];
  youtube: string[];
};

type Submission = {
  id: string;
  createdAt: string;
  waveId: string;
  productId: string;
  comment: string | null;
  planComment: string | null;
  product: Product;
  links: SubmissionLinks;
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

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

const UrlPattern = /https?:\/\/[^\s)\]}>,"']+/gi;
const YoutubePattern = /(?:youtube\.com|youtu\.be)/i;

function collectLinks(value: unknown): string[] {
  const links = new Set<string>();
  const stack: unknown[] = [value];

  while (stack.length > 0) {
    const current = stack.pop();

    if (typeof current === "string") {
      const matches = current.match(UrlPattern);
      if (!matches) {
        continue;
      }

      for (const match of matches) {
        links.add(match.replace(/[.,!?;:]+$/, ""));
      }
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item);
      }
      continue;
    }

    if (isRecord(current)) {
      for (const item of Object.values(current)) {
        stack.push(item);
      }
    }
  }

  return [...links];
}

function extractSubmissionLinks(input: unknown, extraLinks: string[] = []): SubmissionLinks {
  const all = collectLinks(input);

  for (const link of extraLinks) {
    if (link) {
      all.push(link);
    }
  }

  const deduplicated = [...new Set(all)];
  const youtube = deduplicated.filter((url) => YoutubePattern.test(url));

  return {
    all: deduplicated,
    youtube,
  };
}

function parseWave(input: unknown, context: string): Wave {
  if (!isRecord(input)) {
    throw new Error(`Invalid wave at ${context}: expected object.`);
  }

  if (typeof input.id !== "string") {
    throw new Error(`Invalid wave at ${context}: missing id.`);
  }

  if (typeof input.waveCount !== "number") {
    throw new Error(`Invalid wave at ${context}: missing waveCount.`);
  }

  return {
    id: input.id,
    waveCount: input.waveCount,
  };
}

function parseProduct(input: unknown, context: string): Product {
  if (!isRecord(input)) {
    throw new Error(`Invalid product at ${context}: expected object.`);
  }

  if (typeof input.id !== "string") {
    throw new Error(`Invalid product at ${context}: missing id.`);
  }

  if (typeof input.name !== "string") {
    throw new Error(`Invalid product at ${context}: missing name.`);
  }

  let communityId: string | null = null;
  if (isRecord(input.community)) {
    communityId = readString(input.community.id);
  }

  return {
    id: input.id,
    name: input.name,
    tagline: readString(input.tagline),
    deliverableUrl: readString(input.deliverableUrl),
    githubRepositoryName: readString(input.githubRepositoryName),
    isPublic: readBoolean(input.isPublic),
    communityId,
    videoUrl: readString(input.videoUrl),
  };
}

function parseSubmission(input: unknown, context: string): Submission {
  if (!isRecord(input)) {
    throw new Error(`Invalid submission at ${context}: expected object.`);
  }

  if (typeof input.id !== "string") {
    throw new Error(`Invalid submission at ${context}: missing id.`);
  }

  if (typeof input.createdAt !== "string") {
    throw new Error(`Invalid submission at ${context}: missing createdAt.`);
  }

  if (typeof input.waveId !== "string") {
    throw new Error(`Invalid submission at ${context}: missing waveId.`);
  }

  if (typeof input.productId !== "string") {
    throw new Error(`Invalid submission at ${context}: missing productId.`);
  }

  const product = parseProduct(input.product, `${context}.product`);
  const links = extractSubmissionLinks(input, product.videoUrl ? [product.videoUrl] : []);

  return {
    id: input.id,
    createdAt: input.createdAt,
    waveId: input.waveId,
    productId: input.productId,
    comment: readString(input.comment),
    planComment: readString(input.planComment),
    product,
    links,
  };
}

function parseSubmissionsResponse(payload: unknown, waveId: string): Submission[] {
  if (!isRecord(payload)) {
    throw new Error(`Invalid submissions response for wave ${waveId}: expected object.`);
  }

  const wave = parseWave(payload.wave, `wave-${waveId}.wave`);
  if (wave.id !== waveId) {
    throw new Error(`Unexpected wave id in response. Expected ${waveId}, got ${wave.id}.`);
  }

  if (!Array.isArray(payload.submissions)) {
    throw new Error(`Invalid submissions response for wave ${waveId}: expected submissions array.`);
  }

  return payload.submissions.map((submission, index) =>
    parseSubmission(submission, `wave-${waveId}.submissions[${index}]`),
  );
}

const ProductVideoUrlCache = new Map<string, string | null>();

function getProductVideoCacheKey(communityId: string, productId: string): string {
  return `${communityId}:${productId}`;
}

async function fetchProductVideoUrl(communityId: string, productId: string): Promise<string | null> {
  const cacheKey = getProductVideoCacheKey(communityId, productId);

  if (ProductVideoUrlCache.has(cacheKey)) {
    return ProductVideoUrlCache.get(cacheKey) ?? null;
  }

  const encodedCommunityId = encodeURIComponent(communityId);
  const encodedProductId = encodeURIComponent(productId);
  const response = await fetch(`${BaseUrl}/communities/${encodedCommunityId}/products/${encodedProductId}`);

  if (!response.ok) {
    ProductVideoUrlCache.set(cacheKey, null);
    return null;
  }

  const payload: unknown = await response.json();
  const videoUrl = isRecord(payload) ? readString(payload.videoUrl) : null;

  ProductVideoUrlCache.set(cacheKey, videoUrl);
  return videoUrl;
}

function withSubmissionVideoUrl(submission: Submission, videoUrl: string | null): Submission {
  if (!videoUrl) {
    return submission;
  }

  return {
    ...submission,
    product: {
      ...submission.product,
      videoUrl,
    },
    links: extractSubmissionLinks(submission, [videoUrl]),
  };
}

async function enrichSubmissionWithProductVideoUrl(submission: Submission): Promise<Submission> {
  const communityId = submission.product.communityId;

  if (!communityId) {
    return submission;
  }

  const videoUrl = await fetchProductVideoUrl(communityId, submission.product.id);
  return withSubmissionVideoUrl(submission, videoUrl);
}

function getWaveHackIdFromCli(args: string[]): string {
  const waveHackIdFromFlag = getFlagValue(args, "--wave-hack-id");
  const waveHackIdFromPositional = args.find((arg) => !arg.startsWith("-"));

  const waveHackId =
    waveHackIdFromFlag ?? waveHackIdFromPositional ?? process.env.AKINDO_WAVE_HACK_ID;

  if (!waveHackId) {
    throw new Error(
      "Missing wave-hack id. Pass `<waveHackId>` or `--wave-hack-id <id>`, or set AKINDO_WAVE_HACK_ID.",
    );
  }

  return waveHackId;
}

function getCliOptions() {
  const args = process.argv.slice(2);

  const raw = args.includes("--raw");
  const waveHackId = getWaveHackIdFromCli(args);
  const page = parsePositiveInteger(getFlagValue(args, "--page"), DefaultPage);
  const requestedPageSize = parsePositiveInteger(
    getFlagValue(args, "--page-size"),
    DefaultPageSize,
  );
  const pageSize = Math.min(MaxPageSize, requestedPageSize);

  return {
    raw,
    waveHackId,
    page,
    pageSize,
  };
}

async function fetchWaves(waveHackId: string): Promise<Wave[]> {
  const wavesRes = await fetch(`${BaseUrl}/wave-hacks/${waveHackId}/waves`);
  if (!wavesRes.ok) {
    throw new Error(`Failed to fetch waves: ${wavesRes.status} ${wavesRes.statusText}`);
  }

  const wavesData: unknown = await wavesRes.json();

  if (!Array.isArray(wavesData)) {
    throw new Error("Invalid waves response: expected array.");
  }

  return wavesData.map((wave, index) => parseWave(wave, `waves[${index}]`));
}

async function fetchSubmissionsForWave(waveHackId: string, waveId: string): Promise<Submission[]> {
  const submissionsRes = await fetch(`${BaseUrl}/wave-hacks/${waveHackId}/waves/${waveId}/submissions`);
  if (!submissionsRes.ok) {
    throw new Error(
      `Failed to fetch submissions for wave ${waveId}: ${submissionsRes.status} ${submissionsRes.statusText}`,
    );
  }

  const submissionsData: unknown = await submissionsRes.json();
  const submissions = parseSubmissionsResponse(submissionsData, waveId);

  const enrichedSubmissions: Submission[] = [];
  for (const submission of submissions) {
    const enriched = await enrichSubmissionWithProductVideoUrl(submission);
    enrichedSubmissions.push(enriched);
  }

  return enrichedSubmissions;
}

async function fetchSubmissionsPage(
  waveHackId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<Submission>> {
  const waves = await fetchWaves(waveHackId);

  const totalItems = waves.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const wavesForPage = waves.slice(startIndex, endIndex);

  console.log(
    `Found ${waves.length} waves. Fetching submissions for ${wavesForPage.length} wave(s) on page ${safePage}/${totalPages}.`,
  );

  const pageSubmissions: Submission[] = [];

  for (const wave of wavesForPage) {
    console.log(`Fetching submissions for Wave ${wave.waveCount} (${wave.id})...`);

    try {
      const submissions = await fetchSubmissionsForWave(waveHackId, wave.id);
      console.log(`  Found ${submissions.length} submissions.`);
      pageSubmissions.push(...submissions);
    } catch (error) {
      console.error(
        `  Failed to fetch submissions for wave ${wave.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    items: pageSubmissions,
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

async function main() {
  const { raw, waveHackId, page, pageSize } = getCliOptions();

  console.log(`Fetching paginated submissions for WaveHack: ${waveHackId}...`);

  const pagedSubmissions = await fetchSubmissionsPage(waveHackId, page, pageSize);

  if (raw) {
    console.log(JSON.stringify(pagedSubmissions, null, 2));
    return;
  }

  console.log("\n--- Summary ---");
  console.log(
    `Wave page: ${pagedSubmissions.meta.page}/${pagedSubmissions.meta.totalPages} (${pagedSubmissions.meta.pageSize} waves per page, total waves ${pagedSubmissions.meta.totalItems})`,
  );
  console.log(`Total Submissions Fetched This Page: ${pagedSubmissions.items.length}`);

  console.log("\n--- Submissions ---");
  pagedSubmissions.items.forEach((sub, idx) => {
    console.log(`${idx + 1}. [${sub.product.name}] - ${sub.product.tagline || "No tagline"}`);
    console.log(`   Repo: ${sub.product.githubRepositoryName || "N/A"}`);
    console.log(`   Wave: ${sub.waveId}`);
    console.log(`   Date: ${sub.createdAt}`);
    console.log(`   Public: ${sub.product.isPublic}`);
    console.log(`   Video URL (product detail): ${sub.product.videoUrl ?? "N/A"}`);
    console.log(
      `   YouTube: ${sub.links.youtube.length > 0 ? sub.links.youtube.join(", ") : "N/A"}`,
    );
    console.log(`   URL count (all fields): ${sub.links.all.length}`);
    console.log("");
  });
}

main().catch((error) => {
  console.error("Error fetching submissions:", error);
  process.exitCode = 1;
});
