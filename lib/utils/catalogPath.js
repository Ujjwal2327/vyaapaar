/**
 * lib/utils/catalogPath.js
 *
 * How a spot in the catalog tree — Pipe › CPVC › 1" › Appolo Sdr 13.5 — is
 * written down as ONE string and read back again.
 *
 * The catalog used to build these with `${parent}.${key}` and take them apart
 * with path.split("."). That stops working the moment a name has a dot in it,
 * and in a hardware or grocery catalog plenty do: "Appolo Sdr 13.5", '1.5"',
 * "0.5 HP". `Pipe.CPVC.1".Appolo Sdr 13.5` split into five pieces instead of
 * four, so getItemAtPath found nothing and edit/delete either silently did
 * nothing or threw.
 *
 * The format below keeps "." as the separator but escapes it — and the escape
 * character itself — inside a name:
 *
 *   ["Pipe", "CPVC", '1"', "Appolo Sdr 13.5"]  <->  Pipe.CPVC.1".Appolo Sdr 13\.5
 *
 * Three properties matter to the rest of the app:
 *
 *  1. It is reversible for ANY names: splitPath(joinPath(x)) is x, and two
 *     different lists of names never give the same string ("13.5" as one name
 *     is 13\.5; "13" followed by "5" is 13.5).
 *
 *  2. For names with no ".", "\" or "›" in them — nearly all of them — the
 *     string is byte-for-byte what the old join(".") produced. Anything
 *     already saved under that format (the table/list choice remembered per
 *     category, carts saved from the business page) keeps matching without a
 *     migration.
 *
 *  3. "›" is escaped too, so a path can never contain " › " — the separator
 *     the marketplace search used for its cart keys. That is what lets
 *     lib/utils/cartKeys.js tell an old marketplace key from a current one
 *     without a version flag.
 *
 * A path is an opaque token: build it with joinPath/appendPath and take it
 * apart with splitPath/parentPathOf/lastSegmentOf. Never split(".") it.
 *
 * Nothing here touches window or localStorage, so it is safe on the server.
 */

const SEPARATOR = ".";
const ESCAPE = "\\";
// The separator, the escape character, and "›" (property 3 above).
const NEEDS_ESCAPING = /[\\.›]/g;

/** Escape one name so it can sit between separators. */
export const escapeSegment = (segment) =>
  String(segment).replace(NEEDS_ESCAPING, (ch) => ESCAPE + ch);

/** ["Pipe", "CPVC"] -> "Pipe.CPVC" */
export const joinPath = (segments) =>
  (segments ?? []).map(escapeSegment).join(SEPARATOR);

/** Add one more name to the end of a path. `parentPath` may be "" (the root). */
export const appendPath = (parentPath, segment) =>
  parentPath
    ? `${parentPath}${SEPARATOR}${escapeSegment(segment)}`
    : escapeSegment(segment);

/** Inverse of joinPath. "" is the root, i.e. no segments. */
export const splitPath = (path) => {
  if (!path) return [];
  const segments = [];
  let current = "";
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === ESCAPE && i + 1 < path.length) {
      current += path[++i]; // whatever follows an escape is literal
    } else if (ch === SEPARATOR) {
      segments.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  segments.push(current);
  return segments;
};

/** Path of the node that contains `path` ("" when `path` is at the root). */
export const parentPathOf = (path) => joinPath(splitPath(path).slice(0, -1));

/** The node's own name — the last segment. */
export const lastSegmentOf = (path) => {
  const segments = splitPath(path);
  return segments[segments.length - 1];
};

/**
 * The string the old join(".") would have produced for this path. Only for
 * looking up things that were saved under the old format — never parse it.
 */
export const toLegacyDotPath = (path) => splitPath(path).join(SEPARATOR);

/**
 * Calls visit(segments, item) for every item in a catalog tree, skipping the
 * "__orderKeys"-style bookkeeping keys the same way every other walk over the
 * tree in this app does.
 */
export const forEachCatalogItem = (tree, visit, parentSegments = []) => {
  Object.entries(tree || {}).forEach(([key, node]) => {
    if (key.startsWith("__") || !node || typeof node !== "object") return;
    const segments = [...parentSegments, key];
    if (node.type === "item") {
      visit(segments, node);
    } else if (node.type === "category" && node.children) {
      forEachCatalogItem(node.children, visit, segments);
    }
  });
};
