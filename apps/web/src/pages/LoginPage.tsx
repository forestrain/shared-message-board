import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, Form, Input, Toast } from "antd-mobile";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../lib/AuthContext";
import type { UserPublic } from "../lib/api";
import { fetchApi, formatApiError, parseJson } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setMe } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const e = email.trim();
    if (!e || !password) {
      Toast.show({ content: "请填写邮箱和密码" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetchApi("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password }),
      });
      const body = await parseJson(res);
      if (!res.ok) {
        Toast.show({ content: formatApiError(res, body) });
        return;
      }
      setMe(body as UserPublic);
      Toast.show({ content: "登录成功" });
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "网络错误，请检查 API 是否已启动";
      Toast.show({ content: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout tagline="登录你的账号">
      <Card className="page-card">
        <h2 className="page-card-title">登录</h2>
        <p className="page-card-desc">登录后可创建留言板并发布帖子。</p>
        <Form layout="vertical" className="auth-form">
          <Form.Item label="邮箱">
            <Input type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          </Form.Item>
          <Form.Item label="密码">
            <Input type="password" placeholder="请输入密码" value={password} onChange={setPassword} />
          </Form.Item>
        </Form>
        <Button block color="primary" loading={submitting} onClick={() => void onSubmit()}>
          登录
        </Button>
        <p className="auth-switch">
          还没有账号？<Link to="/register">去注册</Link>
        </p>
      </Card>
    </AppLayout>
  );
}
