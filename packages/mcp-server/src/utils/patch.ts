/**
 * Shared patch (find/replace) logic for all _patch tools.
 *
 * All _patch tools accept patches: Array<{ find: string, replace: string }>
 * and apply them sequentially to a content string.
 */

export interface PatchOp {
  find: string;
  replace: string;
}

export interface PatchResult {
  content: string;
  applied: number;
  failed: string[];
}

/**
 * Apply a list of find/replace patches to content.
 * Each patch is applied sequentially. If a find string is not found, it's recorded as failed.
 */
export function applyPatches(content: string, patches: PatchOp[]): PatchResult {
  let result = content;
  let applied = 0;
  const failed: string[] = [];

  for (const patch of patches) {
    if (result.includes(patch.find)) {
      result = result.replace(patch.find, patch.replace);
      applied++;
    } else {
      failed.push(patch.find);
    }
  }

  return { content: result, applied, failed };
}
