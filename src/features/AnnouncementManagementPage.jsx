import { getAllData } from '../core/api/apiClient.js';
import CrudPanel from '../shared/components/CrudPanel.jsx';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import { todayString } from '../shared/utils/date.js';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Tất cả / Khách' },
  { value: 'student', label: 'Sinh viên' },
  { value: 'lecturer', label: 'Giảng viên' },
];

const AUDIENCE_LABELS = Object.fromEntries(AUDIENCE_OPTIONS.map((item) => [item.value, item.label]));

export default function AnnouncementManagementPage() {
  const { data, loading, error, reload } = useFetch(getAllData, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <PageHeader
        title="Quản lý thông báo"
        description="Đăng và cập nhật thông báo hiển thị cho khách, sinh viên hoặc giảng viên."
      />

      <CrudPanel
        title="Thông báo"
        resource="announcements"
        initialItems={data.announcements}
        pageSize={6}
        fields={[
          { name: 'title', label: 'Tiêu đề', full: true },
          { name: 'summary', label: 'Tóm tắt', type: 'textarea', full: true },
          { name: 'content', label: 'Nội dung', type: 'textarea', full: true },
          { name: 'publishedAt', label: 'Ngày đăng', type: 'date', defaultValue: todayString() },
          { name: 'audience', label: 'Đối tượng', type: 'select', options: AUDIENCE_OPTIONS, defaultValue: 'all' },
        ]}
        columns={[
          { key: 'title', label: 'Tiêu đề' },
          { key: 'publishedAt', label: 'Ngày đăng' },
          {
            key: 'audience',
            label: 'Đối tượng',
            render: (item) => AUDIENCE_LABELS[item.audience] || item.audience,
            exportValue: (item) => AUDIENCE_LABELS[item.audience] || item.audience,
          },
          { key: 'summary', label: 'Tóm tắt' },
        ]}
        validate={(form) => {
          if (!String(form.title || '').trim()) return 'Tiêu đề thông báo là bắt buộc.';
          if (!String(form.summary || '').trim()) return 'Tóm tắt thông báo là bắt buộc.';
          if (!String(form.content || '').trim()) return 'Nội dung thông báo là bắt buộc.';
          if (!form.publishedAt) return 'Ngày đăng là bắt buộc.';
          if (!AUDIENCE_LABELS[form.audience]) return 'Đối tượng nhận thông báo không hợp lệ.';
          return '';
        }}
      />
    </div>
  );
}
