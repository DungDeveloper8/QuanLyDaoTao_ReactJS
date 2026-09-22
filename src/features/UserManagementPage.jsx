import useAuth from '../core/auth/useAuth.js';
import { getAllData } from '../core/api/apiClient.js';
import CrudPanel from '../shared/components/CrudPanel.jsx';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'lecturer', label: 'Giảng viên' },
  { value: 'student', label: 'Sinh viên' },
];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((item) => [item.value, item.label]));

export default function UserManagementPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(getAllData, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const lecturerOptions = data.lecturers.map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.fullName}`,
  }));
  const studentOptions = data.students.map((item) => ({
    value: item.id,
    label: `${item.code} - ${item.fullName}`,
  }));

  return (
    <div>
      <PageHeader
        title="Quản lý tài khoản"
        description="Tạo tài khoản, gán vai trò và kiểm soát quyền đăng nhập của người dùng."
      />

      <div className="form-alert page-notice">
        Khi cập nhật tài khoản, để trống mật khẩu nếu muốn giữ nguyên mật khẩu hiện tại.
      </div>

      <CrudPanel
        title="Tài khoản"
        resource="users"
        initialItems={data.users}
        fields={[
          {
            name: 'username',
            label: 'Tên đăng nhập',
            placeholder: 'Ví dụ: gv001',
            autoComplete: 'off',
          },
          {
            name: 'password',
            label: 'Mật khẩu',
            type: 'password',
            placeholder: 'Nhập mật khẩu',
            autoComplete: 'new-password',
          },
          { name: 'fullName', label: 'Tên hiển thị', placeholder: 'Họ và tên người dùng' },
          { name: 'role', label: 'Vai trò', type: 'select', options: ROLE_OPTIONS },
          {
            name: 'lecturerId',
            label: 'Liên kết giảng viên',
            type: 'select-number',
            options: lecturerOptions,
            visible: (form) => form.role === 'lecturer',
          },
          {
            name: 'studentId',
            label: 'Liên kết sinh viên',
            type: 'select-number',
            options: studentOptions,
            visible: (form) => form.role === 'student',
          },
          {
            name: 'active',
            label: 'Cho phép đăng nhập',
            type: 'checkbox',
            defaultValue: true,
            full: true,
            help: 'Tắt trạng thái này để khóa đăng nhập nhưng vẫn giữ tài khoản trong hệ thống.',
          },
        ]}
        columns={[
          { key: 'username', label: 'Tài khoản' },
          { key: 'fullName', label: 'Tên hiển thị' },
          {
            key: 'role',
            label: 'Vai trò',
            render: (item) => ROLE_LABELS[item.role] || item.role,
            exportValue: (item) => ROLE_LABELS[item.role] || item.role,
          },
          {
            key: 'linked',
            label: 'Liên kết',
            render: (item) => {
              if (item.role === 'lecturer') {
                return data.lecturers.find((lecturer) => Number(lecturer.id) === Number(item.lecturerId))?.code || '—';
              }
              if (item.role === 'student') {
                return data.students.find((student) => Number(student.id) === Number(item.studentId))?.code || '—';
              }
              return 'Phòng đào tạo';
            },
            exportValue: (item) => {
              if (item.role === 'lecturer') {
                return data.lecturers.find((lecturer) => Number(lecturer.id) === Number(item.lecturerId))?.code || '';
              }
              if (item.role === 'student') {
                return data.students.find((student) => Number(student.id) === Number(item.studentId))?.code || '';
              }
              return 'Phòng đào tạo';
            },
          },
          {
            key: 'active',
            label: 'Trạng thái',
            render: (item) => (
              <StatusBadge tone={item.active ? 'success' : 'neutral'}>
                {item.active ? 'Hoạt động' : 'Đã khóa'}
              </StatusBadge>
            ),
            exportValue: (item) => (item.active ? 'Hoạt động' : 'Đã khóa'),
          },
        ]}
        validate={(form, items, editing) => {
          const username = String(form.username || '').trim().toLowerCase();
          if (!username || !form.fullName || !form.role) {
            return 'Tên đăng nhập, tên hiển thị và vai trò là bắt buộc.';
          }
          if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
            return 'Tên đăng nhập từ 3–30 ký tự, chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.';
          }
          if (!editing && !String(form.password || '').trim()) {
            return 'Tài khoản mới phải có mật khẩu.';
          }
          if (form.password && String(form.password).length < 3) {
            return 'Mật khẩu demo phải có ít nhất 3 ký tự.';
          }
          if (form.role === 'lecturer' && !form.lecturerId) {
            return 'Tài khoản giảng viên phải liên kết với một giảng viên.';
          }
          if (form.role === 'student' && !form.studentId) {
            return 'Tài khoản sinh viên phải liên kết với một sinh viên.';
          }
          const duplicated = items.some(
            (item) => Number(item.id) !== Number(editing?.id) && String(item.username).toLowerCase() === username,
          );
          if (duplicated) return 'Tên đăng nhập đã tồn tại.';
          return '';
        }}
        canDelete={(item) => {
          if (Number(item.id) === Number(user.id)) return 'Không thể xóa tài khoản đang đăng nhập.';
          const activeAdmins = data.users.filter((current) => current.role === 'admin' && current.active);
          if (item.role === 'admin' && item.active && activeAdmins.length <= 1) {
            return 'Hệ thống phải còn ít nhất một tài khoản quản trị đang hoạt động.';
          }
          return '';
        }}
      />
    </div>
  );
}
