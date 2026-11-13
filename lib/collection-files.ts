import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const collectionsDir = path.join(process.cwd(), "content", "collections");

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugHint = 'use lowercase latin letters, digits and single hyphens, e.g. "wedding-2025"';

export type CollectionSource = {
  fileName: string;
  source: string;
  data?: Record<string, unknown>;
  problem?: string;
};

export type CollectionRoutes = {
  slugs: Map<string, CollectionSource>;
  redirects: Map<string, string>;
  problems: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function collectionFiles(): string[] {
  return existsSync(collectionsDir)
    ? readdirSync(collectionsDir).filter((file) => file.endsWith(".json")).sort()
    : [];
}

export function readCollectionSources(): CollectionSource[] {
  return collectionFiles().map((fileName) => {
    const source = path.posix.join("content/collections", fileName);
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(path.join(collectionsDir, fileName), "utf8"));
    } catch (error) {
      return { fileName, source, problem: `invalid JSON: ${(error as Error).message}` };
    }
    return isRecord(data)
      ? { fileName, source, data }
      : { fileName, source, problem: "the file must contain a JSON object { ... }" };
  });
}

export function collectionRoutes(sources: readonly CollectionSource[]): CollectionRoutes {
  const slugs = new Map<string, CollectionSource>();
  const redirects = new Map<string, string>();
  const redirectOwners = new Map<string, CollectionSource>();
  const problems: string[] = [];
  const pendingRedirects: { owner: CollectionSource; field: string; from: string; to?: string }[] = [];

  for (const owner of sources) {
    const report = (message: string) => problems.push(`${owner.source}: ${message}`);
    if (owner.problem) {
      report(owner.problem);
      continue;
    }
    const data = owner.data!;

    let slug: string | undefined;
    if (typeof data.slug !== "string" || data.slug.trim() === "") {
      report(`"slug" is missing or empty (it sets the page address and the photos folder, e.g. "slug": "wedding-2025")`);
    } else if (!slugPattern.test(data.slug)) {
      report(`"slug": "${data.slug}" is not a valid address (${slugHint})`);
    } else if (slugs.has(data.slug)) {
      report(`"slug": "${data.slug}" is already used by ${slugs.get(data.slug)!.source}`);
    } else {
      slug = data.slug;
      slugs.set(slug, owner);
    }

    const redirectFrom = data.redirectFrom;
    if (redirectFrom === undefined) continue;
    if (!Array.isArray(redirectFrom)) {
      report(`"redirectFrom" must be a list of old addresses, e.g. ["old-slug"]`);
      continue;
    }
    redirectFrom.forEach((from: unknown, index: number) => {
      const field = `redirectFrom[${index}]`;
      if (typeof from !== "string" || !slugPattern.test(from)) {
        report(`"${field}": ${JSON.stringify(from)} is not a valid address (${slugHint})`);
      } else if (redirectOwners.has(from)) {
        const other = redirectOwners.get(from)!;
        report(
          other === owner
            ? `"${field}": "${from}" is listed more than once`
            : `"${field}": "${from}" is already in "redirectFrom" of ${other.source}`,
        );
      } else {
        redirectOwners.set(from, owner);
        pendingRedirects.push({ owner, field, from, to: slug });
      }
    });
  }

  for (const { owner, field, from, to } of pendingRedirects) {
    const live = slugs.get(from);
    if (live === owner) {
      problems.push(`${owner.source}: "${field}": "${from}" is this collection's own "slug"`);
    } else if (live) {
      problems.push(
        `${live.source}: "slug": "${from}" is also in "redirectFrom" of ${owner.source} (an address can either be live or redirect, not both)`,
      );
    } else if (to) {
      redirects.set(from, to);
    }
  }

  return { slugs, redirects, problems };
}

export function readCollectionRoutes(): CollectionRoutes {
  return collectionRoutes(readCollectionSources());
}
