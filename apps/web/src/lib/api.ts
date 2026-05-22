export type UserPublic = {
  id: string;
  email: string;
  nickname: string | null;
};

export type CreatorBrief = {
  id: string;
  email: string;
  nickname: string | null;
};

export type BoardOut = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  created_at: string;
  creator: CreatorBrief;
};

export type PostBrief = {
  id: string;
  content: string;
  author: CreatorBrief;
};

export type BoardListItem = BoardOut & {
  recent_posts: PostBrief[];
};

export type BoardListResponse = {
  items: BoardListItem[];
  total: number;
  skip: number;
  limit: number;
};

/** 兼容旧版 API（无 recent_posts 字段） */
export function normalizeBoardListItem(raw: BoardOut & { recent_posts?: PostBrief[] }): BoardListItem {
  return {
    ...raw,
    recent_posts: Array.isArray(raw.recent_posts) ? raw.recent_posts : [],
  };
}

export function parseBoardListResponse(data: Partial<BoardListResponse> | null | undefined): BoardListItem[] {
  if (!data?.items || !Array.isArray(data.items)) return [];
  return data.items.map((item) =>
    normalizeBoardListItem(item as BoardOut & { recent_posts?: PostBrief[] }),
  );
}

export type PostOut = {
  id: string;
  board_id: string;
  content: string;
  created_at: string;
  author: CreatorBrief;
};

export type PostListResponse = {
  items: PostOut[];
  total: number;
  skip: number;
  limit: number;
};

export async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function formatApiError(res: Response, body: unknown): string {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item !== "object" || item === null) return String(item);
          const o = item as Record<string, unknown>;
          if (typeof o.msg === "string") return o.msg;
          if (typeof o.message === "string") return o.message;
          return JSON.stringify(item);
        })
        .join("；");
    }
    try {
      return JSON.stringify(detail);
    } catch {
      // fall through
    }
  }
  return `请求失败（HTTP ${res.status}）`;
}
