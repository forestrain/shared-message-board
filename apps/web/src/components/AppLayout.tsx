import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Popover, Toast } from "antd-mobile";
import { useAuth } from "../lib/AuthContext";

type AppLayoutProps = {
  children: React.ReactNode;
  /** 顶栏下方可选副标题 */
  tagline?: string;
  /** accent：渐变底图，用于留言板详情等页面 */
  headerTone?: "default" | "accent";
};

export default function AppLayout({ children, tagline, headerTone = "default" }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { me, logout } = useAuth();

  const menuActions = useMemo(() => {
    if (me) {
      return [
        { key: "user", text: me.nickname || me.email, disabled: true },
        { key: "home", text: "首页" },
        { key: "logout", text: "退出登录" },
      ];
    }
    return [
      { key: "home", text: "首页" },
      { key: "login", text: "登录" },
      { key: "register", text: "注册" },
    ];
  }, [me]);

  const handleMenu = async (item: { key?: string | number }) => {
    const key = String(item.key);
    if (key === "login") navigate("/login");
    else if (key === "register") navigate("/register");
    else if (key === "home") {
      if (location.pathname !== "/") navigate("/");
    } else if (key === "logout") {
      await logout();
      Toast.show({ content: "已退出" });
      navigate("/");
    }
  };

  return (
    <div className="app-shell">
      <header
        className={`app-header-frame${headerTone === "accent" ? " app-header-frame--accent" : ""}`}
      >
        <div className="app-header-inner">
          <div className="app-brand">
            <h1 className="app-title">交换心声</h1>
            <p className="app-tagline">{tagline ?? "用留言板，交换彼此的心情"}</p>
          </div>
          <Popover.Menu
            actions={menuActions}
            onAction={handleMenu}
            trigger="click"
            placement="bottom-end"
          >
            <button type="button" className="app-menu-btn" aria-label="打开菜单">
              <span className="app-menu-icon" />
              <span className="app-menu-label">菜单</span>
            </button>
          </Popover.Menu>
        </div>
        {me ? (
          <div className="app-user-chip">
            <span className="app-user-dot" />
            {me.nickname || me.email}
          </div>
        ) : null}
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
