import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../../shared/constants/academic.js';
import Icon from '../../shared/components/Icon.jsx';
import SchoolLogo from '../../shared/components/SchoolLogo.jsx';
import useAuth from '../auth/useAuth.js';

const menus = {
  admin: [
    { label: 'Tổng quan', to: '/admin', icon: 'dashboard' },
    { label: 'Danh mục đào tạo', to: '/admin/catalogs', icon: 'catalog' },
    { label: 'Sinh viên', to: '/admin/students', icon: 'users' },
    { label: 'Môn học & CTĐT', to: '/admin/subjects', icon: 'book' },
    { label: 'Giảng dạy & TKB', to: '/admin/course-sections', icon: 'calendar' },
    { label: 'Báo cáo & Excel', to: '/admin/reports', icon: 'report' },
    { label: 'Bảng điểm tổng hợp', to: '/admin/gradebooks', icon: 'score' },
  ],
  lecturer: [
    { label: 'Lịch dạy', to: '/lecturer/schedule', icon: 'clock' },
    { label: 'Điểm danh', to: '/lecturer/attendance', icon: 'attendance' },
    { label: 'Nhập điểm', to: '/lecturer/scores', icon: 'score' },
  ],
  student: [
    { label: 'Thời khóa biểu', to: '/student/schedule', icon: 'calendar' },
    { label: 'Đăng ký học phần', to: '/student/register', icon: 'book' },
    { label: 'Bảng điểm', to: '/student/grades', icon: 'score' },
    { label: 'Thông tin & thông báo', to: '/student/info', icon: 'report' },
  ],
};

function getCurrentPageLabel(items, pathname) {
  const exact = items.find((item) => item.to === pathname);
  if (exact) {
    return exact.label;
  }

  const nested = items.find((item) => pathname.startsWith(`${item.to}/`));
  return nested?.label || 'Quản lý đào tạo';
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'BK';
  }

  return parts.slice(-2).map((part) => part.charAt(0).toUpperCase()).join('');
}

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = menus[user?.role] || [];
  const pageLabel = getCurrentPageLabel(items, location.pathname);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <div className="portal-logo-box">
            <SchoolLogo />
          </div>
          <div>
            <strong>QL Đào tạo</strong>
            <span>Trường Cao đẳng Bách Khoa</span>
          </div>
        </div>

        <nav className="portal-nav" aria-label="Điều hướng hệ thống">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split('/').length === 2}
            >
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account">
          <div className="sidebar-account-row">
            <span className="account-avatar" aria-hidden="true">
              {getInitials(user?.fullName)}
            </span>
            <div className="sidebar-account-meta">
              <strong>{user?.fullName}</strong>
              <span>{ROLE_LABELS[user?.role]}</span>
            </div>
          </div>

          <button className="btn btn-sidebar" type="button" onClick={handleLogout}>
            <Icon name="logout" size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <div className="portal-content">
        <header className="portal-topbar">
          <div className="topbar-heading">
            <span className="topbar-context">Hệ thống quản lý đào tạo</span>
            <strong>{pageLabel}</strong>
          </div>

          <div className="portal-user-meta">
            <span className="topbar-avatar" aria-hidden="true">
              {getInitials(user?.fullName)}
            </span>
            <div>
              <strong>{user?.fullName}</strong>
              <span>{ROLE_LABELS[user?.role]}</span>
            </div>
          </div>
        </header>

        <main className="portal-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
