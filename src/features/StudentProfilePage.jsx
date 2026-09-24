import useAuth from '../core/auth/useAuth.js';
import { getAllData } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import Icon from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatCard from '../shared/components/StatCard.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import { calculateWeightedAverage, isPassed } from '../shared/utils/trainingRules.js';
import { createStudentTranscriptModel, downloadStudentTranscript } from '../shared/utils/transcriptExcel.js';

const GENDER_LABELS = { male: 'Nam', female: 'Nữ', other: 'Khác' };
const STATUS_LABELS = {
  studying: 'Đang học',
  paused: 'Bảo lưu',
  reserved: 'Bảo lưu',
  graduated: 'Đã tốt nghiệp',
  stopped: 'Thôi học',
  dropped: 'Thôi học',
};

export default function StudentProfilePage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(getAllData, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const student = data.students.find((item) => Number(item.id) === Number(user.studentId));
  const classItem = data.classes.find((item) => Number(item.id) === Number(student?.classId));
  const major = data.majors.find((item) => Number(item.id) === Number(classItem?.majorId));
  const faculty = data.faculties.find((item) => Number(item.id) === Number(major?.facultyId));
  const cohort = data.cohorts.find((item) => Number(item.id) === Number(classItem?.cohortId));
  const scores = data.scores.filter((item) => Number(item.studentId) === Number(student?.id));
  const average = calculateWeightedAverage(scores, data.courseSections, data.subjects);
  const passed = scores.filter((item) => isPassed(item.total)).length;
  const registered = data.registrations.filter((item) => Number(item.studentId) === Number(student?.id) && item.status === 'registered').length;
  const transcript = createStudentTranscriptModel(data, student?.id);

  return (
    <div>
      <PageHeader
        title="Hồ sơ sinh viên"
        description="Thông tin cá nhân và thông tin đào tạo đang được lưu trên hệ thống."
        actions={(
          <button
            className="btn btn-excel btn-sm"
            type="button"
            onClick={() => downloadStudentTranscript(data, student?.id)}
            disabled={!transcript.rows.length}
            title={transcript.rows.length ? 'Xuất các học phần đã đạt' : 'Chưa có học phần đạt để xuất'}
          >
            <Icon name="download" size={15} />
            <span>{transcript.graduated ? 'Xuất bảng điểm hoàn chỉnh' : 'Xuất bảng điểm'}</span>
          </button>
        )}
      />

      <div className="stats-grid">
        <StatCard label="Điểm TB tích lũy" value={scores.length ? average : '—'} />
        <StatCard label="Học phần đã đạt" value={passed} />
        <StatCard label="Đăng ký đang hiệu lực" value={registered} />
        <StatCard label="Khóa học" value={cohort?.code || '—'} />
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>{student?.code} - {student?.fullName}</h2>
            <span>{classItem?.code || 'Chưa xếp lớp'}</span>
          </div>
          <StatusBadge tone={student?.status === 'studying' ? 'success' : 'neutral'}>
            {STATUS_LABELS[student?.status] || student?.status || '—'}
          </StatusBadge>
        </div>

        <div className="table-wrap">
          <table>
            <tbody>
              <tr><th>Mã sinh viên</th><td>{student?.code || '—'}</td><th>Họ và tên</th><td>{student?.fullName || '—'}</td></tr>
              <tr><th>Giới tính</th><td>{GENDER_LABELS[student?.gender] || '—'}</td><th>Ngày sinh</th><td>{student?.birthDate || '—'}</td></tr>
              <tr><th>Email</th><td>{student?.email || '—'}</td><th>Điện thoại</th><td>{student?.phone || '—'}</td></tr>
              <tr><th>Địa chỉ</th><td>{student?.address || '—'}</td><th>Lớp</th><td>{classItem ? `${classItem.code} - ${classItem.name}` : '—'}</td></tr>
              <tr><th>Ngành</th><td>{major ? `${major.code} - ${major.name}` : '—'}</td><th>Khoa</th><td>{faculty?.name || '—'}</td></tr>
              <tr><th>Khóa</th><td>{cohort ? `${cohort.code} - ${cohort.name}` : '—'}</td><th>Trạng thái</th><td>{STATUS_LABELS[student?.status] || student?.status || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
