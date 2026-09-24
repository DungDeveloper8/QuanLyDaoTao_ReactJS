import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SCHOOL_NAME } from "../../app/config.js";
import SchoolLogo from "../../shared/components/SchoolLogo.jsx";
import useAuth from "./useAuth.js";

const HOME_BY_ROLE = {
  admin: "/admin",
  lecturer: "/lecturer",
  student: "/student",
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError("");
  }, [form.username, form.password]);

  if (user) {
    return <Navigate to={HOME_BY_ROLE[user.role] || "/login"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const username = form.username.trim();
    if (!username || !form.password) {
      setError("Vui lòng nhập đầy đủ tài khoản và mật khẩu.");
      return;
    }

    setSubmitting(true);

    try {
      const signedIn = await login(username, form.password);
      const roleHome = HOME_BY_ROLE[signedIn.role] || "/login";
      const previousPath = location.state?.from;
      const destination = previousPath?.startsWith(roleHome)
        ? previousPath
        : roleHome;

      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message || "Tên đăng nhập hoặc mật khẩu không đúng.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel" aria-label="Thông tin hệ thống">
        <div className="auth-brand">
          <div className="auth-logo-box">
            <SchoolLogo />
          </div>
          <div>
            <strong>{SCHOOL_NAME}</strong>
            <span>Cổng quản lý đào tạo</span>
          </div>
        </div>

        <div className="auth-intro">
          <span className="auth-kicker">Hệ thống nội bộ</span>
          <h1>Quản lý đào tạo</h1>
          <p>Dành cho Phòng Đào tạo, giảng viên và sinh viên.</p>
        </div>

        <div className="auth-footer-note">
          <span>Trường Cao đẳng Bách Khoa</span>
          <span>Phòng Quản lý đào tạo</span>
        </div>
      </section>

      <section className="auth-form-panel">
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          aria-labelledby="login-title"
        >
          <div className="auth-form-head">
            <span>Đăng nhập</span>
            <h2 id="login-title">Chào mừng quay lại</h2>
            <p>Nhập tài khoản được cấp để tiếp tục.</p>
          </div>

          <label>
            Tên đăng nhập
            <input
              value={form.username}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  username: event.target.value,
                }));
              }}
              autoComplete="username"
              placeholder="Ví dụ: admin"
              autoFocus
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              value={form.password}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }));
              }}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
            />
          </label>

          {error ? (
            <div className="form-alert form-alert-error" role="alert">
              {error}
            </div>
          ) : null}

          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Đang đăng nhập..." : "Đăng nhập hệ thống"}
          </button>
          <Link className="btn btn-light auth-public-link" to="/thong-tin">
            Xem thông tin đào tạo công khai
          </Link>

          <div className="auth-demo" aria-label="Tài khoản demo">
            <span className="auth-demo-title">Tài khoản demo</span>
            <div className="auth-demo-row">
              <span>Admin</span>
              <strong>admin / admin123</strong>
            </div>
            <div className="auth-demo-row">
              <span>Giảng viên</span>
              <strong>gv001 / gv123</strong>
            </div>
            <div className="auth-demo-row">
              <span>Sinh viên</span>
              <strong>sv001 / sv123</strong>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
