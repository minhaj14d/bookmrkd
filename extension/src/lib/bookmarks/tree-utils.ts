/** Normalize getTree() — Firefox returns a single root wrapper; Chromium often returns top-level folders. */
export function normalizeBookmarkTreeRoots(
  nodes: chrome.bookmarks.BookmarkTreeNode[]
): chrome.bookmarks.BookmarkTreeNode[] {
  if (nodes.length !== 1 || nodes[0].url) return nodes;
  const root = nodes[0];
  const title = (root.title || "").trim();
  const isWrapper =
    !title ||
    root.id === "0" ||
    root.id === "root________" ||
    (root.children && root.children.length > 0 && !root.parentId);
  if (isWrapper && root.children) return root.children;
  return nodes;
}

/** Folder title for path segments; skip invisible root wrapper names. */
export function bookmarkFolderSegment(node: chrome.bookmarks.BookmarkTreeNode): string | null {
  if (node.url) return null;
  const title = (node.title || "").trim();
  if (!title) return null;
  return title;
}

function folderMatches(node: chrome.bookmarks.BookmarkTreeNode, segment: string): boolean {
  if (node.url) return false;
  const title = (node.title || "").trim();
  if (title === segment) return true;
  return title.toLowerCase() === segment.toLowerCase();
}

/**
 * Resolve a folder id from path segments produced by flattenChromeTree.
 */
export async function findFolderIdByPath(segments: string[]): Promise<string | null> {
  if (!segments.length) return null;
  const tree = await chrome.bookmarks.getTree();
  let nodes = normalizeBookmarkTreeRoots(tree);

  let lastId: string | null = null;
  for (const seg of segments) {
    const match = nodes.find((n) => folderMatches(n, seg));
    if (!match?.id) return null;
    lastId = match.id;
    nodes = match.children || [];
  }
  return lastId;
}

export async function findFolderIdByPathOrThrow(segments: string[]): Promise<string> {
  const id = await findFolderIdByPath(segments);
  if (!id) {
    throw new Error(`Folder not found: ${segments.join(" > ")}`);
  }
  return id;
}
