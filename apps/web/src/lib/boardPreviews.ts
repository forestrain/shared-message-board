import type { BoardListItem, PostBrief, QuotedPostBrief } from "./api";
import { authorLabel } from "./api";

export type BoardPreviewLine = {
  id: string;
  authorLabel: string;
  content: string;
  quotedPost?: QuotedPostBrief | null;
  pinned: boolean;
};

function briefToPreviewLine(p: PostBrief, allBriefs: PostBrief[]): BoardPreviewLine {
  let quotedPost = p.quoted_post ?? null;
  if (!quotedPost && p.quoted_post_id) {
    const target = allBriefs.find((x) => x.id === p.quoted_post_id);
    if (target) {
      quotedPost = {
        id: target.id,
        content: target.content,
        author: target.author,
      };
    }
  }
  return {
    id: p.id,
    authorLabel: authorLabel(p.author),
    content: p.content,
    quotedPost,
    pinned: Boolean(p.pinned_at),
  };
}

/** 列表卡片展示：置顶帖优先，最多 2 条；无留言时返回空 */
export function getBoardListPreviews(board: BoardListItem, max = 2): BoardPreviewLine[] {
  const briefs = (board.recent_posts ?? []).slice(0, max);
  return briefs.map((p) => briefToPreviewLine(p, briefs));
}
