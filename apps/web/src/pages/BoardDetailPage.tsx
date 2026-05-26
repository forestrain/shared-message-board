import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Divider, Input, Popup, TextArea, Toast } from "antd-mobile";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../lib/AuthContext";
import PostImage from "../components/PostImage";
import PostQuoteBlock from "../components/PostQuoteBlock";
import type { BoardOut, PostListResponse, PostOut } from "../lib/api";
import { authorLabel, fetchApi, formatApiError, parseJson } from "../lib/api";
import { resolveQuotedPost } from "../lib/postQuote";

export default function BoardDetailPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [board, setBoard] = useState<BoardOut | null>(null);
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [draft, setDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [quotedPost, setQuotedPost] = useState<PostOut | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [memberEmails, setMemberEmails] = useState("");
  const [savingBoard, setSavingBoard] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
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

  const isOwner = Boolean(me && board && me.id === board.creator.id);
  const pinnedCount = posts.filter((p) => p.pinned_at).length;

  const canDeletePost = (p: PostOut) =>
    me && (me.id === p.author.id || (board && me.id === board.creator.id));

  const openEdit = () => {
    if (!board) return;
    setEditTitle(board.title);
    setEditDesc(board.description ?? "");
    setEditOpen(true);
  };

  const openAccess = () => {
    if (!board) return;
    setVisibility(board.visibility === "private" ? "private" : "public");
    setMemberEmails((board.allowed_members ?? []).map((m) => m.email).join("\n"));
    setAccessOpen(true);
  };

  const saveAccess = async () => {
    if (!boardId || !board) return;
    setSavingAccess(true);
    try {
      const payload: {
        visibility: "public" | "private";
        member_emails?: string[];
      } = { visibility };
      if (visibility === "private") {
        payload.member_emails = memberEmails
          .split(/[\n,，;；\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const res = await fetchApi(`/api/v1/boards/${boardId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await parseJson(res);
      if (!res.ok) {
        Toast.show({ content: formatApiError(res, body) });
        return;
      }
      setBoard(body as BoardOut);
      setAccessOpen(false);
      Toast.show({ content: visibility === "private" ? "已设为私密板" : "已设为公开板" });
    } catch {
      Toast.show({ content: "网络错误" });
    } finally {
      setSavingAccess(false);
    }
  };

  const saveBoard = async () => {
    if (!boardId || !board) return;
    const title = editTitle.trim();
    if (!title) {
      Toast.show({ content: "标题不能为空" });
      return;
    }
    setSavingBoard(true);
    try {
      const res = await fetch(`/api/v1/boards/${boardId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: editDesc.trim() || null }),
      });
      const body = await parseJson(res);
      if (!res.ok) {
        Toast.show({ content: formatApiError(res, body) });
        return;
      }
      setBoard(body as BoardOut);
      setEditOpen(false);
      Toast.show({ content: "已保存" });
    } catch {
      Toast.show({ content: "网络错误" });
    } finally {
      setSavingBoard(false);
    }
  };

  const clearPendingImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImage(null);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const onPickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      Toast.show({ content: "请选择图片文件" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Toast.show({ content: "图片不能超过 2MB" });
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setPendingImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const uploadPendingImage = async (): Promise<string | null> => {
    if (!pendingImage) return null;
    const form = new FormData();
    form.append("file", pendingImage);
    const res = await fetchApi("/api/v1/uploads/image", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const body = await parseJson(res);
    if (!res.ok) {
      Toast.show({ content: formatApiError(res, body) });
      return null;
    }
    return (body as { url: string }).url;
  };

  const publishPost = async () => {
    const c = draft.trim();
    if (!c && !pendingImage) {
      Toast.show({ content: "请输入文字或添加图片" });
      return;
    }
    try {
      let imageUrl: string | null = null;
      if (pendingImage) {
        imageUrl = await uploadPendingImage();
        if (!imageUrl) return;
      }
      const payload: { content: string; quoted_post_id?: string; image_url?: string } = {
        content: c,
      };
      if (quotedPost) payload.quoted_post_id = quotedPost.id;
      if (imageUrl) payload.image_url = imageUrl;
      const res = await fetch(`/api/v1/boards/${boardId}/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await parseJson(res);
      if (!res.ok) {
        Toast.show({ content: formatApiError(res, body) });
        return;
      }
      Toast.show({ content: "已发布" });
      setDraft("");
      setQuotedPost(null);
      clearPendingImage();
      await loadPosts();
    } catch {
      Toast.show({ content: "网络错误" });
    }
  };

  const togglePin = async (p: PostOut, pin: boolean) => {
    try {
      const res = await fetchApi(`/api/v1/posts/${p.id}/pin`, {
        method: pin ? "POST" : "DELETE",
        credentials: "include",
      });
      const body = await parseJson(res);
      if (!res.ok) {
        Toast.show({ content: formatApiError(res, body) });
        return;
      }
      Toast.show({ content: pin ? "已置顶" : "已取消置顶" });
      await loadPosts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "操作失败";
      Toast.show({ content: msg });
    }
  };

  const selectMention = (p: PostOut) => {
    setQuotedPost(p);
    setMentionOpen(false);
    Toast.show({ content: `已引用 @${authorLabel(p.author)} 的留言` });
  };

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
    <AppLayout tagline={board.title} headerTone="accent">
      <button type="button" className="back-link back-link--on-accent" onClick={() => navigate(-1)}>
        ← 返回
      </button>

      <Card className="page-card board-detail-card">
        <div className="board-detail-head">
          <h2 className="page-card-title">{board.title}</h2>
          {isOwner ? (
            <div className="board-owner-actions">
              <Button size="small" fill="outline" className="board-edit-btn" onClick={openEdit}>
                编辑
              </Button>
              <Button size="small" fill="outline" className="board-edit-btn" onClick={openAccess}>
                权限
              </Button>
            </div>
          ) : null}
        </div>
        {board.visibility === "private" ? (
          <span className="board-visibility-badge">私密 · 仅指定用户可见</span>
        ) : null}
        <p className="board-meta">
          {authorLabel(board.creator)} · {new Date(board.created_at).toLocaleString("zh-CN")}
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
            后可发帖。
          </div>
        ) : (
          <>
            {quotedPost ? (
              <div className="mention-chip">
                <div className="mention-chip-main">
                  <span className="mention-chip-label">引用</span>
                  <span className="mention-chip-text">
                    @{authorLabel(quotedPost.author)}：{quotedPost.content.slice(0, 60)}
                    {quotedPost.content.length > 60 ? "…" : ""}
                  </span>
                </div>
                <button type="button" className="mention-chip-clear" onClick={() => setQuotedPost(null)}>
                  取消
                </button>
              </div>
            ) : null}
            <TextArea
              placeholder="写点什么…（文字与图片至少一项，最多 2000 字）"
              value={draft}
              onChange={setDraft}
              rows={3}
              maxLength={2000}
              showCount
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="compose-image-input"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />
            {imagePreviewUrl ? (
              <div className="compose-image-preview">
                <img src={imagePreviewUrl} alt="待发布图片预览" className="compose-image-preview-img" />
                <button type="button" className="compose-image-remove" onClick={clearPendingImage}>
                  移除图片
                </button>
              </div>
            ) : null}
            <div className="compose-actions">
              <Button size="small" fill="outline" onClick={() => imageInputRef.current?.click()}>
                添加图片
              </Button>
              <Button
                size="small"
                fill="outline"
                disabled={posts.length === 0}
                onClick={() => setMentionOpen(true)}
              >
                @引用留言
              </Button>
              <Button block color="primary" className="publish-btn-inline" onClick={() => void publishPost()}>
                发布
              </Button>
            </div>
            <Divider className="section-divider" />
          </>
        )}

        {posts.length === 0 ? (
          <div className="empty-hint">还没有帖子，来做第一条吧。</div>
        ) : (
          <ul className="post-feed">
            {posts.map((p) => {
              const quote = resolveQuotedPost(p, posts);
              const isPinned = Boolean(p.pinned_at);
              return (
              <li
                key={p.id}
                className={`post-feed-item${isPinned ? " post-feed-item--pinned" : ""}${quote ? " post-feed-item--has-quote" : ""}`}
              >
                {isPinned ? <span className="post-feed-pin-badge">置顶</span> : null}
                {quote ? <PostQuoteBlock quote={quote} /> : null}
                {p.content.trim() ? <p className="post-feed-body">{p.content}</p> : null}
                {p.image_url ? <PostImage src={p.image_url} /> : null}
                <div className="post-feed-footer">
                  <span className="post-feed-meta">
                    {authorLabel(p.author)} · {new Date(p.created_at).toLocaleString("zh-CN")}
                  </span>
                  <div className="post-feed-actions">
                    {isOwner ? (
                      isPinned ? (
                        <Button
                          size="mini"
                          fill="outline"
                          onClick={() => void togglePin(p, false)}
                        >
                          取消置顶
                        </Button>
                      ) : pinnedCount < 2 ? (
                        <Button
                          size="mini"
                          color="primary"
                          fill="outline"
                          onClick={() => void togglePin(p, true)}
                        >
                          置顶
                        </Button>
                      ) : null
                    ) : null}
                    {canDeletePost(p) ? (
                    <Button
                      size="mini"
                      color="danger"
                      fill="outline"
                      onClick={async () => {
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
                          if (quotedPost?.id === p.id) setQuotedPost(null);
                          await loadPosts();
                        } catch {
                          Toast.show({ content: "网络错误" });
                        }
                      }}
                    >
                      删
                    </Button>
                  ) : null}
                  </div>
                </div>
              </li>
            );
            })}
          </ul>
        )}
      </Card>

      <Popup
        visible={accessOpen}
        onMaskClick={() => setAccessOpen(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}
      >
        <h3 className="popup-title">留言板权限</h3>
        <p className="popup-desc">私密板仅你与下列已注册用户可见、可留言。</p>
        <div className="visibility-toggle">
          <button
            type="button"
            className={`visibility-option${visibility === "public" ? " visibility-option--active" : ""}`}
            onClick={() => setVisibility("public")}
          >
            公开
          </button>
          <button
            type="button"
            className={`visibility-option${visibility === "private" ? " visibility-option--active" : ""}`}
            onClick={() => setVisibility("private")}
          >
            私密
          </button>
        </div>
        {visibility === "private" ? (
          <FormField label="可见用户邮箱（每行一个，或逗号分隔）">
            <TextArea
              value={memberEmails}
              onChange={setMemberEmails}
              placeholder="friend@example.com"
              rows={4}
            />
          </FormField>
        ) : null}
        <div className="popup-actions">
          <Button fill="outline" onClick={() => setAccessOpen(false)}>
            取消
          </Button>
          <Button color="primary" loading={savingAccess} onClick={() => void saveAccess()}>
            保存
          </Button>
        </div>
      </Popup>

      <Popup
        visible={editOpen}
        onMaskClick={() => setEditOpen(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 }}
      >
        <h3 className="popup-title">编辑留言板</h3>
        <FormField label="标题">
          <Input value={editTitle} onChange={setEditTitle} placeholder="留言板名称" maxLength={200} />
        </FormField>
        <FormField label="描述">
          <TextArea
            value={editDesc}
            onChange={setEditDesc}
            placeholder="介绍一下这块板（可选）"
            rows={3}
            maxLength={8000}
            showCount
          />
        </FormField>
        <div className="popup-actions">
          <Button fill="outline" onClick={() => setEditOpen(false)}>
            取消
          </Button>
          <Button color="primary" loading={savingBoard} onClick={() => void saveBoard()}>
            保存
          </Button>
        </div>
      </Popup>

      <Popup
        visible={mentionOpen}
        onMaskClick={() => setMentionOpen(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 16,
          maxHeight: "70vh",
          overflow: "auto",
        }}
      >
        <h3 className="popup-title">选择要引用的留言</h3>
        <ul className="mention-picker-list">
          {posts.map((p) => (
            <li key={p.id}>
              <button type="button" className="mention-picker-item" onClick={() => selectMention(p)}>
                <span className="mention-picker-author">@{authorLabel(p.author)}</span>
                <span className="mention-picker-preview">{p.content}</span>
              </button>
            </li>
          ))}
        </ul>
      </Popup>
    </AppLayout>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span className="form-field-label">{label}</span>
      {children}
    </label>
  );
}
