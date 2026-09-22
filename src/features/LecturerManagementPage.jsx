import { getAllData } from '../core/api/apiClient.js';
import CrudPanel from '../shared/components/CrudPanel.jsx';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import useFetch from '../shared/hooks/useFetch.js';

function normalizeText(value) {
  return String(value || '').trim();
}

export default function LecturerManagementPage() {
  const { data, loading, error, reload } = useFetch(getAllData, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const facultyOptions = data.faculties.map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.name}`,
  }));

  return (
    <div>
      <PageHeader
        title="Quản lý giảng viên"
        description="Cập nhật hồ sơ giảng viên và đơn vị công tác để phục vụ phân công giảng dạy."
      />

      <CrudPanel
        title="Giảng viên"
        resource="lecturers"
        initialItems={data.lecturers}
        fields={[
          { name: 'code', label: 'Mã giảng viên', transform: normalizeText },
          { name: 'fullName', label: 'Họ và tên', transform: normalizeText },
          { name: 'facultyId', label: 'Khoa', type: 'select-number', options: facultyOptions },
          { name: 'email', label: 'Email', type: 'email', transform: normalizeText },
          { name: 'phone', label: 'Điện thoại', transform: normalizeText },
        ]}
        columns={[
          { key: 'code', label: 'Mã GV' },
          { key: 'fullName', label: 'Họ tên' },
          {
            key: 'facultyId',
            label: 'Khoa',
            render: (item) => data.faculties.find((faculty) => Number(faculty.id) === Number(item.facultyId))?.name || '—',
            exportValue: (item) => data.faculties.find((faculty) => Number(faculty.id) === Number(item.facultyId))?.name || '',
          },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Điện thoại' },
        ]}
        validate={(form, items, editing) => {
          if (!form.code || !form.fullName || !form.facultyId) {
            return 'Mã giảng viên, họ tên và khoa là bắt buộc.';
          }
          if (!/^[A-Za-z0-9_-]{2,20}$/.test(form.code)) {
            return 'Mã giảng viên chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.';
          }
          if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) {
            return 'Email không đúng định dạng.';
          }
          const duplicateCode = items.some(
            (item) => Number(item.id) !== Number(editing?.id) && String(item.code).toLowerCase() === String(form.code).toLowerCase(),
          );
          if (duplicateCode) return 'Mã giảng viên đã tồn tại.';
          const duplicateEmail = form.email && items.some(
            (item) => Number(item.id) !== Number(editing?.id) && String(item.email || '').toLowerCase() === String(form.email).toLowerCase(),
          );
          if (duplicateEmail) return 'Email giảng viên đã tồn tại.';
          return '';
        }}
        canDelete={(lecturer) => {
          if (data.courseSections.some((item) => Number(item.lecturerId) === Number(lecturer.id))) {
            return 'Không thể xóa giảng viên đã được phân công lớp học phần.';
          }
          if (data.users.some((item) => Number(item.lecturerId) === Number(lecturer.id))) {
            return 'Không thể xóa giảng viên đang được liên kết với tài khoản đăng nhập.';
          }
          return '';
        }}
      />
    </div>
  );
}
