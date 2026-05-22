import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Divider, List, TextArea, Toast } from "antd-mobile";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../lib/AuthContext";
import type { BoardOut, PostListResponse, PostOut } from "../lib/api";
import { formatApiError, parseJson } from "../lib/api";

export default function BoardDetailPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [board, setBoard] = useState<BoardOut | null>(null);
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [draft, setDraft] = useState("");
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    if (!boardId) return;
    const res = await fetch(`/api/v1/boards/${boardId}`, { credentials: "include" });
    const body = await parseJson(res);
    if (!res.ok) {
      setLoadErr(formatApiError(res, body));
      setBoard(null);
      return;
    }
    setLoadErr(null);
    setBoard(body as BoardOut);
  }, [boardId]);

  const loadPosts = useCallback(async () => {
    if (!boardId) return;
    const res = await fetch(`/api/v1/boards/${boardId}/posts?skip=0&limit=50`, { credentials: "include" });
    if (!res.ok) return;
    const data = (await parseJson(res)) as PostListResponse;
    setPosts(data.items);
    setPostTotal(data.total);
  }, [boardId]);

  useEffect(() => {
    void loadBoard();
    void loadPosts();
  }, [loadBoard, loadPosts]);

  const canDeletePost = (p: PostOut) =>
    me && (me.id === p.author.id || (board && me.id === board.creator.id));

  if (!boardId) {
    return (
      <AppLayout tagline="页面错误">
        <Card className="page-card">
          <p>无效的板链接</p>
          <Button onClick={() => navigate("/")}>返回首页</Button>
        </Card>
      </AppLayout>
    );
  }

  if (loadErr || !board) {
    return (
      <AppLayout tagline="留言板">
        <Card className="page-card">
          <div className="error-text">{loadErr ?? "加载中…"}</div>
          <Button style={{ marginTop: 12 }} onClick={() => void loadBoard()}>
            重试
          </Button>
          <Button fill="outline" style={{ marginTop: 8 }} onClick={() => navigate("/")}>
            返回首页
          </Button>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout tagline={board.title}>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        ← 返回
      </button>

      <Card className="page-card">
        <h2 className="page-card-title">{board.title}</h2>
        <p className="board-meta">
          {board.creator.nickname || board.creator.email} · {new Date(board.created_at).toLocaleString("zh-CN")}
        </p>
        <div className="board-desc">{board.description || "（无描述）"}</div>
      </Card>

      <Card
        className="page-card"
        title={
          <div className="card-title-row">
            <span>帖子</span>
            <span className="count-badge">{postTotal}</span>
          </div>
        }
        extra={
          <Button size="small" fill="outline" onClick={() => void loadPosts()}>
            刷新
          </Button>
        }
      >
        {!me ? (
          <div className="empty-hint">
            <button type="button" className="text-link" onClick={() => navigate("/login")}>
              登录
            </button>
            后可发帖（列表所有人可见）。
          </div>
        ) : (
          <>
            <TextArea
              placeholder="写点什么…（1～2000 字）"
              value={draft}
              onChange={setDraft}
              rows={3}
              maxLength={2000}
              showCount
            />
            <Button
              block
              color="primary"
              className="publish-btn"
              onClick={async () => {
                const c = draft.trim();
                if (!c) {
                  Toast.show({ content: "请输入内容" });
                  return;
                }
                try {
                  const res = await fetch(`/api/v1/boards/${boardId}/posts`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: c }),
                  });
                  const body = await parseJson(res);
                  if (!res.ok) {
                    Toast.show({ content: formatApiError(res, body) });
                    return;
                  }
                  Toast.show({ content: "已发布" });
                  setDraft("");
                  await loadPosts();
                } catch {
                  Toast.show({ content: "网络错误" });
                }
              }}
            >
              发布
            </Button>
            <Divider className="section-divider" />
          </>
        )}

        <List className="post-list">
          {posts.length === 0 ? (
            <div className="empty-hint">还没有帖子，来做第一条吧。</div>
          ) : (
            posts.map((p) => (
              <List.Item
                key={p.id}
                className="post-list-item"
                title={<span className="post-content">{p.content}</span>}
                description={`${p.author.nickname || p.author.email} · ${new Date(p.created_at).toLocaleString("zh-CN")}`}
                extra={
                  canDeletePost(p) ? (
                    <Button
                      size="mini"
                      color="danger"
                      fill="outline"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm("确定删除这条帖子？")) return;
                        try {
                          const res = await fetch(`/api/v1/posts/${p.id}`, {
                            method: "DELETE",
                            credentials: "include",
                          });
                          if (!res.ok) {
                            const body = await parseJson(res);
                            Toast.show({ content: formatApiError(res, body) });
                            return;
                          }
                          Toast.show({ content: "已删除" });
                          await loadPosts();
                        } catch {
                          Toast.show({ content: "网络错误" });
                        }
                      }}
                    >
                      删
                    </Button>
                  ) : null
                }
              />
            ))
          )}
        </List>
      </Card>
    </AppLayout>
  );
}
