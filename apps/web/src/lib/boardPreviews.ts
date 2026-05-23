import type { BoardListItem, PostBrief, QuotedPostBrief } from "./api";
import { authorLabel } from "./api";

export type BoardPreviewLine = {
  id: string;
  authorLabel: string;
  content: string;
  quotedPost?: QuotedPostBrief | null;
  /** 仅 UI 占位；真实置顶 API 后续接入 */
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
    pinned: false,
  };
}

/** 列表卡片展示：优先最新留言，无留言时展示 2 条置顶占位 */
export function getBoardListPreviews(board: BoardListItem, max = 2): BoardPreviewLine[] {
  const briefs = (board.recent_posts ?? []).slice(0, max);
  const fromApi = briefs.map((p) => briefToPreviewLine(p, briefs));
  if (fromApi.length > 0) {
    return fromApi;
  }
  return pinnedPlaceholderPreviews(board.id, board.title);
}

function pinnedPlaceholderPreviews(boardId: string, boardTitle: string): BoardPreviewLine[] {
  return [
    {
      id: `${boardId}-pin-1`,
      authorLabel: "版主",
      content: `欢迎来到「${boardTitle}」，在此分享你想说的话。`,
      pinned: true,
    },
    {
      id: `${boardId}-pin-2`,
      authorLabel: "系统",
      content: "置顶区预留：重要公告与规则将固定展示在此。",
      pinned: true,
    },
  ];
}
