import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Divider, List, NavBar, TextArea, Toast } from "antd-mobile";
import type { BoardOut, PostListResponse, PostOut, UserPublic } from "../lib/api";
import { formatApiError, parseJson } from "../lib/api";

export default function BoardDetailPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<BoardOut | null>(null);
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [me, setMe] = useState<UserPublic | null>(null);
  const [draft, setDraft] = useState("");
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/v1/users/me", { credentials: "include" });
    if (!res.ok) {
      setMe(null);
      return;
    }
    setMe((await parseJson(res)) as UserPublic);
  }, []);

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
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    void loadBoard();
    void loadPosts();
  }, [loadBoard, loadPosts]);

  const canDeletePost = (p: PostOut) =>
    me && (me.id === p.author.id || (board && me.id === board.creator.id));

  if (!boardId) {
    return (
      <div style={{ padding: 16 }}>
        <NavBar onBack={() => navigate("/")}>错误</NavBar>
        <p>无效的板链接</p>
      </div>
    );
  }

  if (loadErr || !board) {
    return (
      <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
        <NavBar onBack={() => navigate(-1)}>留言板</NavBar>
        <Card style={{ marginTop: 12 }}>
          <div style={{ color: "#c00" }}>{loadErr ?? "加载中…"}</div>
          <Button style={{ marginTop: 12 }} onClick={() => void loadBoard()}>
            重试
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto", paddingBottom: 32 }}>
      <NavBar onBack={() => navigate(-1)}>{board.title}</NavBar>

      <Card style={{ marginTop: 12 }} title="板介绍">
        <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
          {board.creator.nickname || board.creator.email} · {new Date(board.created_at).toLocaleString("zh-CN")}
        </div>
        <div style={{ whiteSpace: "pre-wrap" }}>{board.description || "（无描述）"}</div>
      </Card>

      <Card
        style={{ marginTop: 16 }}
        title={`帖子（${postTotal}）`}
        extra={
          <Button size="small" fill="outline" onClick={() => void loadPosts()}>
            刷新
          </Button>
        }
      >
        {!me ? (
          <div style={{ color: "#999", fontSize: 13, marginBottom: 12 }}>登录后可发帖（公开板帖子列表所有人可见）。</div>
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
              style={{ marginTop: 8 }}
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
            <Divider />
          </>
        )}

        <List style={{ margin: "-8px 0" }}>
          {posts.length === 0 ? (
            <div style={{ padding: "12px 0", color: "#999" }}>还没有帖子，来做第一条吧。</div>
          ) : (
            posts.map((p) => (
              <List.Item
                key={p.id}
                title={<span style={{ whiteSpace: "pre-wrap", fontWeight: 500 }}>{p.content}</span>}
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
    </div>
  );
}
