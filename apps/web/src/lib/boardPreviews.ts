import type { BoardListItem } from "./api";

export type BoardPreviewLine = {
  id: string;
  authorLabel: string;
  content: string;
  /** 仅 UI 占位；真实置顶 API 后续接入 */
  pinned: boolean;
};

/** 列表卡片展示：优先最新留言，无留言时展示 2 条置顶占位 */
export function getBoardListPreviews(board: BoardListItem, max = 2): BoardPreviewLine[] {
  const fromApi = (board.recent_posts ?? []).slice(0, max).map((p) => ({
    id: p.id,
    authorLabel: p.author.nickname || p.author.email,
    content: p.content,
    pinned: false,
  }));
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
