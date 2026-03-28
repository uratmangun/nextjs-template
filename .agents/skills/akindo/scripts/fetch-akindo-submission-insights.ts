export {};

const BaseUrl = "https://api.akindo.io/public";
const DefaultPage = 1;
const DefaultPageSize = 5;
const MaxPageSize = 50;

type Wave = {
  id: string;
  waveCount: number;
  grantAmount: string | null;
};

type Product = {
  id: string;
  name: string | null;
  isPublic: boolean | null;
  githubRepositoryName: string | null;
  deliverableUrl: string | null;
  communityId: string | null;
  videoUrl: string | null;
};
type SubmissionLinks = {
  all: string[];
  youtube: string[];
};

type Submission = {
  id: string;
  waveId: string;
  productId: string;
  earnedAmount: string;
  product: Product;
  links: SubmissionLinks;
};

type SubmissionInsight = {
  submissionId: string;
  waveId: string;
  productId: string;
  productName: string | null;
  earnedAmount: string;
  isHidden: boolean | null;
  githubRepositoryName: string | null;
  deliverableUrl: string | null;
  videoUrl: string | null;
  youtubeLinks: string[];
};

type WaveInsight = {
  waveId: string;
  waveCount: number;
  waveGrantAmount: string | null;
  totalSubmissions: number;
  hiddenSubmissions: number;
  publicSubmissions: number;
  unknownVisibilitySubmissions: number;
  publicWithGithub: number;
  publicWithDeliverableUrl: number;
  publicWithYoutube: number;
  nonZeroEarnedAmountSubmissions: number;
  totalEarnedAmount: number;
  submissions: SubmissionInsight[];
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
  const showSubmissions = args.includes("--show-submissions");
  const waveHackId = getWaveHackIdFromCli(args);
  const page = parsePositiveInteger(getFlagValue(args, "--page"), DefaultPage);
  const requestedPageSize = parsePositiveInteger(
    getFlagValue(args, "--page-size"),
    DefaultPageSize,
  );
  const pageSize = Math.min(MaxPageSize, requestedPageSize);

  return {
    raw,
    showSubmissions,
    waveHackId,
    page,
    pageSize,
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
    grantAmount: readString(input.grantAmount),
  };
}

function parseProduct(input: unknown, context: string): Product {
  if (!isRecord(input)) {
    throw new Error(`Invalid product at ${context}: expected object.`);
  }

  if (typeof input.id !== "string") {
    throw new Error(`Invalid product at ${context}: missing id.`);
  }

  let communityId: string | null = null;
  if (isRecord(input.community)) {
    communityId = readString(input.community.id);
  }

  return {
    id: input.id,
    name: readString(input.name),
    isPublic: readBoolean(input.isPublic),
    githubRepositoryName: readString(input.githubRepositoryName),
    deliverableUrl: readString(input.deliverableUrl),
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
    waveId: input.waveId,
    productId: input.productId,
    earnedAmount: readString(input.earnedAmount) ?? "0",
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

function amountToNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

async function fetchWaves(waveHackId: string): Promise<Wave[]> {
  const response = await fetch(`${BaseUrl}/wave-hacks/${waveHackId}/waves`);
  if (!response.ok) {
    throw new Error(`Failed to fetch waves: ${response.status} ${response.statusText}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error("Invalid waves response: expected array.");
  }

  return payload
    .map((wave, index) => parseWave(wave, `waves[${index}]`))
    .sort((left, right) => left.waveCount - right.waveCount);
}

async function fetchSubmissionsForWave(waveHackId: string, waveId: string): Promise<Submission[]> {
  const response = await fetch(`${BaseUrl}/wave-hacks/${waveHackId}/waves/${waveId}/submissions`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch submissions for wave ${waveId}: ${response.status} ${response.statusText}`,
    );
  }

  const payload: unknown = await response.json();
  const submissions = parseSubmissionsResponse(payload, waveId);

  const enrichedSubmissions: Submission[] = [];
  for (const submission of submissions) {
    const enriched = await enrichSubmissionWithProductVideoUrl(submission);
    enrichedSubmissions.push(enriched);
  }

  return enrichedSubmissions;
}

async function buildWaveInsight(waveHackId: string, wave: Wave): Promise<WaveInsight> {
  const submissions = await fetchSubmissionsForWave(waveHackId, wave.id);

  const insights: SubmissionInsight[] = submissions.map((submission) => {
    const isHidden =
      submission.product.isPublic === null ? null : submission.product.isPublic === false;

    return {
      submissionId: submission.id,
      waveId: submission.waveId,
      productId: submission.productId,
      productName: submission.product.name,
      earnedAmount: submission.earnedAmount,
      isHidden,
      githubRepositoryName: submission.product.githubRepositoryName,
      deliverableUrl: submission.product.deliverableUrl,
      videoUrl: submission.product.videoUrl,
      youtubeLinks: submission.links.youtube,
    };
  });

  const hiddenSubmissions = insights.filter((item) => item.isHidden === true).length;
  const publicSubmissions = insights.filter((item) => item.isHidden === false).length;
  const unknownVisibilitySubmissions = insights.filter((item) => item.isHidden === null).length;

  const publicWithGithub = insights.filter(
    (item) => item.isHidden === false && item.githubRepositoryName,
  ).length;

  const publicWithDeliverableUrl = insights.filter(
    (item) => item.isHidden === false && item.deliverableUrl,
  ).length;

  const publicWithYoutube = insights.filter(
    (item) => item.isHidden === false && item.youtubeLinks.length > 0,
  ).length;

  const nonZeroEarnedAmountSubmissions = insights.filter(
    (item) => amountToNumber(item.earnedAmount) > 0,
  ).length;

  const totalEarnedAmount = insights.reduce(
    (sum, item) => sum + amountToNumber(item.earnedAmount),
    0,
  );

  return {
    waveId: wave.id,
    waveCount: wave.waveCount,
    waveGrantAmount: wave.grantAmount,
    totalSubmissions: insights.length,
    hiddenSubmissions,
    publicSubmissions,
    unknownVisibilitySubmissions,
    publicWithGithub,
    publicWithDeliverableUrl,
    publicWithYoutube,
    nonZeroEarnedAmountSubmissions,
    totalEarnedAmount,
    submissions: insights,
  };
}

async function fetchSubmissionInsightsPage(
  waveHackId: string,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<WaveInsight>> {
  const waves = await fetchWaves(waveHackId);
  const pagedWaves = paginateArray(waves, page, pageSize);

  const items: WaveInsight[] = [];

  for (const wave of pagedWaves.items) {
    console.log(`Fetching wave ${wave.waveCount} (${wave.id}) submissions...`);

    try {
      const insight = await buildWaveInsight(waveHackId, wave);
      items.push(insight);
    } catch (error) {
      console.error(
        `  Failed to build insights for wave ${wave.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    items,
    meta: pagedWaves.meta,
  };
}

function visibilityLabel(isHidden: boolean | null): string {
  if (isHidden === true) {
    return "hidden";
  }

  if (isHidden === false) {
    return "public";
  }

  return "unknown";
}

async function main() {
  const { raw, showSubmissions, waveHackId, page, pageSize } = getCliOptions();

  console.log(
    `Fetching submission insights for WaveHack ${waveHackId} (page ${page}, pageSize ${pageSize})...`,
  );

  const result = await fetchSubmissionInsightsPage(waveHackId, page, pageSize);

  if (raw) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(
    `\nFetched ${result.items.length} wave(s) on page ${result.meta.page}/${result.meta.totalPages} (total waves ${result.meta.totalItems}).`,
  );

  for (const wave of result.items) {
    console.log(`\nWave ${wave.waveCount} (${wave.waveId})`);
    console.log(`  Wave grant amount: ${wave.waveGrantAmount ?? "N/A"}`);
    console.log(`  Total submissions: ${wave.totalSubmissions}`);
    console.log(`  Hidden submissions: ${wave.hiddenSubmissions}`);
    console.log(`  Public submissions: ${wave.publicSubmissions}`);
    console.log(`  Unknown visibility submissions: ${wave.unknownVisibilitySubmissions}`);
    console.log(`  Public submissions with GitHub: ${wave.publicWithGithub}`);
    console.log(`  Public submissions with deliverable URL: ${wave.publicWithDeliverableUrl}`);
    console.log(`  Public submissions with YouTube URL: ${wave.publicWithYoutube}`);
    console.log(`  Submissions with non-zero earned amount: ${wave.nonZeroEarnedAmountSubmissions}`);
    console.log(`  Total earned amount across submissions: ${wave.totalEarnedAmount.toFixed(6)}`);

    if (!showSubmissions) {
      continue;
    }

    console.log("  Submission details:");

    for (const submission of wave.submissions) {
      console.log(
        `    - ${submission.productName ?? "Unknown product"} (${submission.productId}) | ${visibilityLabel(submission.isHidden)} | earned=${submission.earnedAmount}`,
      );
      console.log(`      submissionId: ${submission.submissionId}`);
      console.log(`      github: ${submission.githubRepositoryName ?? "N/A"}`);
      console.log(`      deliverableUrl: ${submission.deliverableUrl ?? "N/A"}`);
      console.log(`      videoUrl: ${submission.videoUrl ?? "N/A"}`);
      console.log(
        `      youtube: ${submission.youtubeLinks.length > 0 ? submission.youtubeLinks.join(", ") : "N/A"}`,
      );
    }
  }

  if (!showSubmissions) {
    console.log("\nTip: pass --show-submissions to print per-submission details.");
  }
}

main().catch((error) => {
  console.error("Error fetching submission insights:", error);
  process.exitCode = 1;
});
