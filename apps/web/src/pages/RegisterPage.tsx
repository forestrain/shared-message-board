import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, Form, Input, Toast } from "antd-mobile";
import AppLayout from "../components/AppLayout";
import { formatApiError, parseJson } from "../lib/api";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const e = email.trim();
    if (!e || !password) {
      Toast.show({ content: "请填写邮箱和密码" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password, nickname: nickname.trim() || null }),
      });
      const body = await parseJson(res);
      if (!res.ok) {
        Toast.show({ content: formatApiError(res, body) });
        return;
      }
      Toast.show({ content: "注册成功，请登录" });
      navigate("/login");
    } catch {
      Toast.show({ content: "网络错误，请检查 API 是否已启动" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout tagline="创建新账号">
      <Card className="page-card">
        <h2 className="page-card-title">注册</h2>
        <p className="page-card-desc">注册后即可使用公开留言板与发帖功能。</p>
        <Form layout="vertical" className="auth-form">
          <Form.Item label="邮箱">
            <Input type="email" placeholder="you@example.com" value={email} onChange={setEmail} />
          </Form.Item>
          <Form.Item label="密码">
            <Input type="password" placeholder="至少 8 位" value={password} onChange={setPassword} />
          </Form.Item>
          <Form.Item label="昵称">
            <Input placeholder="可选" value={nickname} onChange={setNickname} />
          </Form.Item>
        </Form>
        <Button block color="primary" loading={submitting} onClick={() => void onSubmit()}>
          注册
        </Button>
        <p className="auth-switch">
          已有账号？<Link to="/login">去登录</Link>
        </p>
      </Card>
    </AppLayout>
  );
}
