import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicData } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import SchoolLogo from '../shared/components/SchoolLogo.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import { formatDate } from '../shared/utils/date.js';

export default function PublicInfoPage({ embedded = false }) {
  const { announcementId } = useParams();
  const { data, loading, error, reload } = useFetch(getPublicData, []);
  const [query, setQuery] = useState('');
  const basePath = embedded ? '/student/info' : '/thong-tin';

  const announcements = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const items = data?.announcements || [];
    return items
      .filter((item) => !keyword || `${item.title} ${item.summary}`.toLowerCase().includes(keyword))
      .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  }, [data, query]);

  const activeCurricula = useMemo(
    () => (data?.curricula || []).filter((item) => item.active),
    [data],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const selectedAnnouncement = announcementId
    ? data.announcements.find((item) => Number(item.id) === Number(announcementId))
    : null;

  const content = selectedAnnouncement ? (
    <article className="public-article panel">
      <Link className="public-back-link" to={basePath}>← Quay lại thông tin chung</Link>
      <span className="public-date">{formatDate(selectedAnnouncement.publishedAt)}</span>
      <h1>{selectedAnnouncement.title}</h1>
      <p className="public-lead">{selectedAnnouncement.summary}</p>
      <p>{selectedAnnouncement.content}</p>
    </article>
  ) : announcementId ? (
    <div className="page-state error-state">
      <strong>Không tìm thấy thông báo</strong>
      <span>Thông báo không thuộc phạm vi được xem hoặc đường dẫn không hợp lệ.</span>
      <Link className="btn btn-light" to={basePath}>Quay lại</Link>
    </div>
  ) : (
    <>
      <PageHeader
        title="Thông tin đào tạo & Thông báo"
        description="Khu vực tra cứu chương trình đào tạo, ngành tuyển sinh trong dữ liệu hệ thống và thông báo được phép công khai."
      />

      <section className="public-section-grid">
        <div className="panel public-section-card">
          <div className="public-section-head">
            <div>
              <span className="eyebrow">Thông báo mới</span>
              <h2>Tin tức - thông báo</h2>
            </div>
            <input
              className="public-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm thông báo..."
              aria-label="Tìm thông báo"
            />
          </div>

          <div className="announcement-list">
            {announcements.map((item) => (
              <Link
                className="announcement-item"
                key={item.id}
                to={`${basePath}/thong-bao/${item.id}`}
              >
                <span>{formatDate(item.publishedAt)}</span>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </Link>
            ))}
            {!announcements.length ? <div className="table-empty">Không có thông báo phù hợp.</div> : null}
          </div>
        </div>

        <div className="panel public-section-card">
          <div className="public-section-head">
            <div>
              <span className="eyebrow">Tra cứu</span>
              <h2>Chương trình đào tạo đang áp dụng</h2>
            </div>
          </div>

          <div className="curriculum-public-list">
            {activeCurricula.map((curriculum) => {
              const major = data.majors.find((item) => Number(item.id) === Number(curriculum.majorId));
              const subjects = (curriculum.subjectIds || [])
                .map((id) => data.subjects.find((item) => Number(item.id) === Number(id)))
                .filter(Boolean);
              const credits = subjects.reduce((sum, subject) => sum + Number(subject.credits || 0), 0);

              return (
                <article className="curriculum-public-item" key={curriculum.id}>
                  <div>
                    <strong>{major?.name || curriculum.name}</strong>
                    <span>Phiên bản {curriculum.version} · {subjects.length} môn · {credits} tín chỉ trong dữ liệu demo</span>
                  </div>
                  <div className="curriculum-subject-chips">
                    {subjects.map((subject) => (
                      <span key={subject.id} title={subject.name}>{subject.code}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="panel public-section-card public-section-wide">
          <div className="public-section-head">
            <div>
              <span className="eyebrow">Tuyển sinh</span>
              <h2>Ngành đang có trong hệ thống</h2>
            </div>
          </div>
          <p className="public-helper-text">
            Khu vực này chỉ tra cứu danh mục ngành và khoa từ dữ liệu của bài tập lớn; không công bố chỉ tiêu hoặc điểm chuẩn ngoài tài liệu đề bài.
          </p>
          <div className="admission-public-list">
            {(data.majors || []).map((major) => {
              const faculty = data.faculties.find((item) => Number(item.id) === Number(major.facultyId));
              return (
                <article className="admission-public-item" key={major.id}>
                  <strong>{major.code} · {major.name}</strong>
                  <span>{faculty?.name || 'Chưa xác định khoa phụ trách'}</span>
                  <p>{major.description || 'Chưa có mô tả trong dữ liệu.'}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <main className="public-shell">
      <header className="public-topbar">
        <Link className="public-brand" to="/thong-tin">
          <span className="public-logo-box"><SchoolLogo /></span>
          <span>
            <strong>Trường Cao đẳng Bách Khoa</strong>
            <small>Cổng thông tin đào tạo</small>
          </span>
        </Link>
        <Link className="btn btn-primary" to="/login">Đăng nhập hệ thống</Link>
      </header>
      <div className="public-main">{content}</div>
    </main>
  );
}
