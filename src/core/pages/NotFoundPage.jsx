import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page-state">
      <h1>404</h1>
      <p>Không tìm thấy trang bạn yêu cầu.</p>
      <Link className="btn btn-primary" to="/login">
        Về đăng nhập
      </Link>
    </div>
  );
}
