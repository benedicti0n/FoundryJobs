import type { SourceDto } from "@foundryjobs/shared";
import { createSource, listSources, setSourceActive, updateSource } from "../repositories/sources";
import { SOURCE_MANIFEST, validateManifest, type SourceDefinition } from "./manifest";

export type SourceSyncResult = {
  dryRun: boolean;
  added: string[];
  updated: string[];
  unchanged: string[];
  deactivated: string[];
};

function toComparable(source: SourceDto): Record<string, unknown> {
  return {
    name: source.name,
    type: source.type,
    platform: source.platform,
    atsType: source.atsType,
    trustLevel: source.trustLevel,
    fetchIntervalMinutes: source.fetchIntervalMinutes,
    isActive: source.isActive,
    category: source.category,
    region: source.region,
    priority: source.priority,
  };
}

function toDesired(definition: SourceDefinition): Record<string, unknown> {
  return {
    name: definition.name,
    type: definition.type,
    platform: definition.platform,
    atsType: definition.atsType,
    trustLevel: definition.trustLevel,
    fetchIntervalMinutes: definition.fetchIntervalMinutes,
    isActive: definition.isActive,
    category: definition.category,
    region: definition.region,
    priority: definition.priority,
  };
}

function changedFields(existing: SourceDto, definition: SourceDefinition): Record<string, unknown> {
  const current = toComparable(existing);
  const desired = toDesired(definition);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(desired)) {
    if (current[key] !== desired[key]) {
      patch[key] = desired[key];
    }
  }
  return patch;
}

export async function syncSources(
  options: { dryRun?: boolean; manifest?: SourceDefinition[] } = {},
): Promise<SourceSyncResult> {
  const dryRun = options.dryRun ?? false;
  const manifest = options.manifest ?? SOURCE_MANIFEST;

  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length > 0) {
    throw new Error(`Invalid source manifest: ${manifestErrors.join("; ")}`);
  }

  const existing = await listSources({ limit: 200 });
  const existingByUrl = new Map(existing.map((source) => [source.url, source]));
  const manifestUrls = new Set(manifest.map((definition) => definition.url));

  const result: SourceSyncResult = {
    dryRun,
    added: [],
    updated: [],
    unchanged: [],
    deactivated: [],
  };

  for (const definition of manifest) {
    const match = existingByUrl.get(definition.url);
    if (!match) {
      result.added.push(definition.slug);
      if (!dryRun) {
        await createSource({
          name: definition.name,
          type: definition.type,
          platform: definition.platform,
          url: definition.url,
          atsType: definition.atsType,
          trustLevel: definition.trustLevel,
          fetchIntervalMinutes: definition.fetchIntervalMinutes,
          isActive: definition.isActive,
          category: definition.category,
          region: definition.region,
          priority: definition.priority,
        });
      }
      continue;
    }

    const patch = changedFields(match, definition);
    if (Object.keys(patch).length === 0) {
      result.unchanged.push(definition.slug);
      continue;
    }

    result.updated.push(definition.slug);
    if (!dryRun) {
      await updateSource(match.id, patch);
    }
  }

  for (const source of existing) {
    if (manifestUrls.has(source.url) || !source.isActive) {
      continue;
    }
    result.deactivated.push(source.url);
    if (!dryRun) {
      await setSourceActive(source.id, false);
    }
  }

  return result;
}
