import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Divider, Form, Input, List, Toast } from "antd-mobile";
import type { BoardListResponse, BoardOut, UserPublic } from "../lib/api";
import { formatApiError, parseJson } from "../lib/api";

export default function HomePage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<string>("…");
  const [me, setMe] = useState<UserPublic | null>(null);
  const [boards, setBoards] = useState<BoardOut[]>([]);
  const [boardTotal, setBoardTotal] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/health", { credentials: "include" });
      const body = (await parseJson(res)) as { status?: string } | string;
      setHealth(res.ok && typeof body === "object" && body?.status === "ok" ? "ok" : `错误 (${res.status})`);
    } catch {
      setHealth("无法连接后端（请先启动 API）");
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/v1/users/me", { credentials: "include" });
    if (!res.ok) {
      setMe(null);
      return;
    }
    setMe((await parseJson(res)) as UserPublic);
  }, []);

  const refreshBoards = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/boards?skip=0&limit=50", { credentials: "include" });
      if (!res.ok) return;
      const data = (await parseJson(res)) as BoardListResponse;
      setBoards(data.items);
      setBoardTotal(data.total);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    void refreshMe();
    void refreshBoards();
  }, [refreshHealth, refreshMe, refreshBoards]);

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <Card title="交换心声 · 开发联调">
        <div>后端 /health：{health}</div>
        <Divider />
        {me ? (
          <div>
            <div>
              已登录：<strong>{me.email}</strong>
              {me.nickname ? `（${me.nickname}）` : null}
            </div>
            <Button
              color="danger"
              fill="outline"
              style={{ marginTop: 12 }}
              onClick={async () => {
                await fetch("/api/v1/auth/logout", {
                  method: "POST",
                  credentials: "include",
                });
                Toast.show({ content: "已退出" });
                setMe(null);
              }}
            >
              退出
            </Button>
          </div>
        ) : (
          <div style={{ color: "#666" }}>未登录</div>
        )}
      </Card>

      <Card
        title={`公开留言板（${boardTotal}）`}
        extra={
          <Button size="small" fill="outline" onClick={() => void refreshBoards()}>
            刷新
          </Button>
        }
        style={{ marginTop: 16 }}
      >
        <List style={{ margin: "-12px 0" }}>
          {boards.length === 0 ? (
            <div style={{ padding: "12px 0", color: "#999" }}>暂无留言板，登录后可创建。</div>
          ) : (
            boards.map((b) => (
              <List.Item
                key={b.id}
                title={b.title}
                description={`${b.creator.nickname || b.creator.email} · ${new Date(b.created_at).toLocaleString("zh-CN")}`}
                onClick={() => navigate(`/boards/${b.id}`)}
                clickable
                arrow
              />
            ))
          )}
        </List>
        <Divider>新建公开板（需登录）</Divider>
        {!me ? (
          <div style={{ color: "#999", fontSize: 13 }}>请先登录后再创建。</div>
        ) : (
          <>
            <Form layout="horizontal" style={{ marginTop: 8 }}>
              <Form.Item label="标题">
                <Input value={newTitle} onChange={setNewTitle} placeholder="给板起个名字" />
              </Form.Item>
              <Form.Item label="描述">
                <Input value={newDesc} onChange={setNewDesc} placeholder="可选" />
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
              创建
            </Button>
          </>
        )}
      </Card>

      <Card title="注册" style={{ marginTop: 16 }}>
        <Form
          layout="horizontal"
          footer={
            <Button
              block
              type="submit"
              color="primary"
              onClick={async () => {
                const email = (document.getElementById("reg-email") as HTMLInputElement)?.value?.trim();
                const password = (document.getElementById("reg-password") as HTMLInputElement)?.value ?? "";
                const nickname = (document.getElementById("reg-nickname") as HTMLInputElement)?.value?.trim();
                if (!email || !password) {
                  Toast.show({ content: "请填写邮箱和密码" });
                  return;
                }
                try {
                  const res = await fetch("/api/v1/auth/register", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, nickname: nickname || null }),
                  });
                  const body = await parseJson(res);
                  if (!res.ok) {
                    Toast.show({ content: formatApiError(res, body) });
                    return;
                  }
                  Toast.show({ content: "注册成功，请登录" });
                } catch {
                  Toast.show({ content: "网络错误，请检查 API 是否已启动" });
                }
              }}
            >
              注册
            </Button>
          }
        >
          <Form.Item label="邮箱">
            <Input id="reg-email" type="email" placeholder="you@example.com" />
          </Form.Item>
          <Form.Item label="密码">
            <Input id="reg-password" type="password" placeholder="至少 8 位" />
          </Form.Item>
          <Form.Item label="昵称">
            <Input id="reg-nickname" placeholder="可选" />
          </Form.Item>
        </Form>
      </Card>

      <Card title="登录" style={{ marginTop: 16 }}>
        <Form
          layout="horizontal"
          footer={
            <Button
              block
              type="submit"
              color="primary"
              onClick={async () => {
                const email = (document.getElementById("login-email") as HTMLInputElement)?.value?.trim();
                const password = (document.getElementById("login-password") as HTMLInputElement)?.value ?? "";
                if (!email || !password) {
                  Toast.show({ content: "请填写邮箱和密码" });
                  return;
                }
                try {
                  const res = await fetch("/api/v1/auth/login", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                  });
                  const body = await parseJson(res);
                  if (!res.ok) {
                    Toast.show({ content: formatApiError(res, body) });
                    return;
                  }
                  Toast.show({ content: "登录成功" });
                  setMe(body as UserPublic);
                } catch {
                  Toast.show({ content: "网络错误，请检查 API 是否已启动" });
                }
              }}
            >
              登录
            </Button>
          }
        >
          <Form.Item label="邮箱">
            <Input id="login-email" type="email" />
          </Form.Item>
          <Form.Item label="密码">
            <Input id="login-password" type="password" />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
