import type { JSONContent } from '@tiptap/core'

const COMMENT_IMAGES_BUCKET = 'comment-images'
const MARKER = `/object/public/${COMMENT_IMAGES_BUCKET}/`

/** Walks a Tiptap JSONContent tree and returns storage object paths for images in our bucket. */
export function extractStoragePaths(content: JSONContent): string[] {
  const paths: string[] = []
  function walk(node: JSONContent) {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      const idx = node.attrs.src.indexOf(MARKER)
      if (idx !== -1) paths.push(node.attrs.src.slice(idx + MARKER.length))
    }
    node.content?.forEach(walk)
  }
  walk(content)
  return paths
}

export { COMMENT_IMAGES_BUCKET }
