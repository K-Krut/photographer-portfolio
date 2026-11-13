import { closeSync, openSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";
import { collectionRoutes, readCollectionSources, type CollectionSource } from "./collection-files";
import type { Category, Localized, Photo } from "./content";
import { locales } from "./i18n";

const photosDir = path.join(process.cwd(), "public", "photos");

type Problems = string[];

type Dimensions = { width: number; height: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLocalized(
  value: unknown,
  field: string,
  report: (message: string) => void,
): Localized | undefined {
  if (!isRecord(value)) {
    report(`"${field}" is missing or is not an object with ${locales.map((l) => `"${l}"`).join(" and ")}`);
    return undefined;
  }
  let valid = true;
  for (const locale of locales) {
    const text = value[locale];
    if (typeof text !== "string" || text.trim() === "") {
      report(`"${field}.${locale}" is missing or empty`);
      valid = false;
    }
  }
  return valid ? (Object.fromEntries(locales.map((l) => [l, value[l]])) as Localized) : undefined;
}

const unpatchedCloseSync: typeof closeSync =
  (closeSync as unknown as Record<symbol, typeof closeSync | undefined>)[
    Symbol.for("graceful-fs.previous")
  ] ?? closeSync;

function readImage(file: string): Uint8Array {
  const fd = openSync(file, "r");
  try {
    return readFileSync(fd);
  } finally {
    unpatchedCloseSync(fd);
  }
}

const dimensionsCache =new Map<string, { stamp: string; dimensions: Dimensions }>();

function readDimensions(file: string): Dimensions | undefined {
  let stamp: string;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) return undefined;
    stamp = `${stats.mtimeMs}:${stats.size}`;
  } catch {
    return undefined;
  }
  const cached = dimensionsCache.get(file);
  if (cached?.stamp === stamp) return cached.dimensions;
  const { width, height, orientation } = imageSize(readImage(file));
  if (!width || !height) throw new Error("could not read image size");
  const dimensions =
    orientation !== undefined && orientation >= 5
      ? { width: height, height: width }
      : { width, height };
  dimensionsCache.set(file, { stamp, dimensions });
  return dimensions;
}

function loadCollection(
  { source, data }: CollectionSource,
  slug: string | undefined,
  problems: Problems,
): { order: number; category: Category } | undefined {
  if (!data) return undefined;
  const report = (message: string) => problems.push(`${source}: ${message}`);
  const before = problems.length;

  const order = data.order;
  if (typeof order !== "number" || !Number.isFinite(order)) {
    report(`"order" must be a number, got ${JSON.stringify(order) ?? "nothing"}`);
  }

  const featured = data.featured;
  if (featured !== undefined && typeof featured !== "boolean") {
    report(`"featured" must be true or false, got ${JSON.stringify(featured)}`);
  }

  const name = readLocalized(data.name, "name", report);
  const description =
    data.description === undefined
      ? undefined
      : readLocalized(data.description, "description", report);

  const photos: Photo[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(data.photos) || data.photos.length === 0) {
    report(`"photos" must be a non-empty list`);
  } else {
    data.photos.forEach((entry: unknown, index: number) => {
      const field = `photos[${index}]`;
      if (!isRecord(entry)) {
        report(`"${field}" must be an object with "file" and "alt"`);
        return;
      }
      const file = entry.file;
      const alt = readLocalized(entry.alt, `${field}.alt`, report);
      if (typeof file !== "string" || file.trim() === "") {
        report(`"${field}.file" is missing or empty`);
        return;
      }
      if (file.includes("/") || file.includes("\\") || file.startsWith(".")) {
        report(`"${field}.file" must be a plain file name, got "${file}"`);
        return;
      }
      if (seen.has(file)) {
        report(`"${field}.file": "${file}" is listed more than once`);
        return;
      }
      seen.add(file);
      if (!slug) return;
      let dimensions: Dimensions | undefined;
      try {
        dimensions = readDimensions(path.join(photosDir, slug, file));
      } catch (error) {
        report(
          `"${field}.file": cannot read image size of public/photos/${slug}/${file} (${(error as Error).message})`,
        );
        return;
      }
      if (!dimensions) {
        report(`"${field}.file": public/photos/${slug}/${file} does not exist`);
        return;
      }
      if (alt) photos.push({ src: `/photos/${slug}/${file}`, ...dimensions, alt });
    });
  }

  const cover = data.cover ?? (Array.isArray(data.photos) ? data.photos[0]?.file : undefined);
  if (typeof cover !== "string" || cover.trim() === "") {
    report(`"cover" must be the file name of one of the photos`);
  } else if (Array.isArray(data.photos) && !seen.has(cover)) {
    report(`"cover": "${cover}" is not in "photos"`);
  }

  if (problems.length > before || !name || !slug) return undefined;

  const coverPhoto = photos.find((photo) => photo.src === `/photos/${slug}/${cover}`)!;
  return {
    order: order as number,
    category: {
      slug,
      name,
      ...(description && { description }),
      cover: coverPhoto,
      photos,
      featured: featured === true,
    },
  };
}

export function loadCollections(): Category[] {
  const sources = readCollectionSources();
  const { slugs, problems } = collectionRoutes(sources);
  if (sources.length === 0) {
    problems.push("content/collections: no collection files (*.json) found");
  }
  const slugOf = new Map([...slugs].map(([slug, owner]) => [owner, slug]));

  const loaded = sources.flatMap(
    (source) => loadCollection(source, slugOf.get(source), problems) ?? [],
  );

  if (problems.length > 0) {
    throw new Error(
      `Invalid collection content (${problems.length} ${problems.length === 1 ? "problem" : "problems"}):\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
    );
  }

  return loaded
    .sort((a, b) => a.order - b.order || (a.category.slug < b.category.slug ? -1 : 1))
    .map((entry) => entry.category);
}
