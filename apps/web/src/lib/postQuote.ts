import type { CreatorBrief, PostOut, QuotedPostBrief } from "./api";
import { authorLabel } from "./api";

const QUOTE_PREVIEW_MAX = 120;

export function truncateQuoteContent(text: string, maxLen = QUOTE_PREVIEW_MAX): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, maxLen - 1)}…`;
}

/** 从 API 的 quoted_post 或板内帖子列表解析被引用留言 */
export function resolveQuotedPost(post: PostOut, allPosts: PostOut[]): QuotedPostBrief | null {
  if (post.quoted_post) return post.quoted_post;
  const quotedId = post.quoted_post_id;
  if (!quotedId) return null;
  const target = allPosts.find((p) => p.id === quotedId);
  if (!target) return null;
  return {
    id: target.id,
    content: truncateQuoteContent(target.content),
    author: target.author,
  };
}

export function quoteDisplayLabel(author: CreatorBrief): string {
  return `@${authorLabel(author)}`;
}
