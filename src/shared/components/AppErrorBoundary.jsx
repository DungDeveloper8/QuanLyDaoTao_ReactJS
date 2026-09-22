import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="fatal-error">
        <div className="fatal-error-card">
          <h1>Không thể hiển thị trang</h1>
          <p>
            Giao diện gặp lỗi khi xử lý dữ liệu. Bạn có thể tải lại trang; nếu lỗi lặp lại,
            hãy kiểm tra terminal chạy Vite để xem thông báo chi tiết.
          </p>
          {this.state.error?.message ? (
            <code>{this.state.error.message}</code>
          ) : null}
          <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      </main>
    );
  }
}
