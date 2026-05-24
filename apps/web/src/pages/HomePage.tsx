import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Divider, Form, Input, Toast } from "antd-mobile";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../lib/AuthContext";
import type { BoardListItem, BoardListResponse } from "../lib/api";
import { fetchApi, formatApiError, parseBoardListResponse, parseJson } from "../lib/api";
import PostQuoteBlock from "../components/PostQuoteBlock";
import { getBoardListPreviews } from "../lib/boardPreviews";

export default function HomePage() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const [boards, setBoards] = useState<BoardListItem[]>([]);
  const [boardTotal, setBoardTotal] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(true);

  const refreshBoards = useCallback(async () => {
    setLoadingBoards(true);
    try {
      const res = await fetchApi("/api/v1/boards?skip=0&limit=50", { credentials: "include" });
      if (!res.ok) return;
      const data = (await parseJson(res)) as BoardListResponse;
      setBoards(parseBoardListResponse(data));
      setBoardTotal(data.total ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      Toast.show({ content: msg });
    } finally {
      setLoadingBoards(false);
    }
  }, []);

  useEffect(() => {
    void refreshBoards();
  }, [refreshBoards]);

  return (
    <AppLayout headerTone="accent">
      <section className="hero-banner">
        <h2 className="hero-title">公开广场</h2>
        <p className="hero-desc">浏览大家的留言板，登录后可以创建自己的板并发帖。</p>
      </section>

      <Card
        className="page-card board-card"
        title={
          <div className="card-title-row">
            <span>留言板列表</span>
            <span className="count-badge">{boardTotal}</span>
          </div>
        }
        extra={
          <Button size="small" fill="outline" onClick={() => void refreshBoards()}>
            刷新
          </Button>
        }
      >
        {loadingBoards ? (
          <div className="empty-hint">加载中…</div>
        ) : boards.length === 0 ? (
          <div className="empty-hint">暂无留言板。登录后可在下方创建第一块板。</div>
        ) : (
          <ul className="board-list">
            {boards.map((b) => {
              const previewLines = getBoardListPreviews(b);
              return (
              <li key={b.id}>
                <button
                  type="button"
                  className="board-list-item"
                  onClick={() => navigate(`/boards/${b.id}`)}
                >
                  <div className="board-list-item-head">
                    <h3 className="board-item-title">{b.title}</h3>
                    <span className="board-item-arrow" aria-hidden>
                      ›
                    </span>
                  </div>
                  <p className="board-item-meta">
                    {b.creator.nickname || b.creator.email} ·{" "}
                    {new Date(b.created_at).toLocaleString("zh-CN")}
                  </p>
                  <ul className="board-preview-list">
                    {previewLines.length === 0 ? (
                      <li className="board-preview-empty">暂无留言</li>
                    ) : null}
                    {previewLines.map((line) => (
                      <li
                        key={line.id}
                        className={`board-preview-line${line.pinned ? " board-preview-line--pinned" : ""}${line.quotedPost ? " board-preview-line--has-quote" : ""}`}
                      >
                        {line.pinned ? <span className="board-preview-pin">置顶</span> : null}
                        {line.quotedPost ? <PostQuoteBlock quote={line.quotedPost} compact /> : null}
                        <p className="board-preview-text">
                          <span className="board-preview-author">{line.authorLabel}：</span>
                          {line.content}
                        </p>
                      </li>
                    ))}
                  </ul>
                </button>
              </li>
            );
            })}
          </ul>
        )}

        <Divider className="section-divider">创建公开留言板</Divider>

        {!me ? (
          <div className="empty-hint">
            请先
            <button type="button" className="text-link" onClick={() => navigate("/login")}>
              登录
            </button>
            后再创建留言板。
          </div>
        ) : (
          <div className="create-board-form">
            <Form layout="vertical">
              <Form.Item label="标题">
                <Input value={newTitle} onChange={setNewTitle} placeholder="给板起个名字" />
              </Form.Item>
              <Form.Item label="描述">
                <Input value={newDesc} onChange={setNewDesc} placeholder="可选，介绍一下这块板" />
              </Form.Item>
            </Form>
            <Button
              block
              color="primary"
              onClick={async () => {
                const title = newTitle.trim();
                if (!title) {
                  Toast.show({ content: "请填写标题" });
                  return;
                }
                try {
                  const res = await fetch("/api/v1/boards", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title,
                      description: newDesc.trim() || null,
                      visibility: "public",
                    }),
                  });
                  const body = await parseJson(res);
                  if (!res.ok) {
                    Toast.show({ content: formatApiError(res, body) });
                    return;
                  }
                  Toast.show({ content: "创建成功" });
                  setNewTitle("");
                  setNewDesc("");
                  await refreshBoards();
                } catch {
                  Toast.show({ content: "网络错误" });
                }
              }}
            >
              创建留言板
            </Button>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
