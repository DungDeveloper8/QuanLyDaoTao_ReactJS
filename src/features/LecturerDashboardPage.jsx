import useAuth from '../core/auth/useAuth.js';
import { getAllData } from '../core/api/apiClient.js';
import BarChart from '../shared/components/BarChart.jsx';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatCard from '../shared/components/StatCard.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';

export default function LecturerDashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(getAllData, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const activeSemester = data.semesters.find((item) => item.active);
  const sections = data.courseSections.filter(
    (item) => Number(item.lecturerId) === Number(user.lecturerId) && Number(item.semesterId) === Number(activeSemester?.id),
  );
  const sectionIds = new Set(sections.map((item) => Number(item.id)));
  const registrations = data.registrations.filter(
    (item) => sectionIds.has(Number(item.courseSectionId)) && item.status === 'registered',
  );
  const uniqueStudentIds = new Set(registrations.map((item) => Number(item.studentId)));
  const sessions = data.attendanceSessions.filter((item) => sectionIds.has(Number(item.courseSectionId)));
  const scores = data.scores.filter((item) => sectionIds.has(Number(item.courseSectionId)));
  const expectedScores = registrations.length;
  const scoreProgress = sections.map((section) => {
    const studentCount = registrations.filter((item) => Number(item.courseSectionId) === Number(section.id)).length;
    const scoreCount = scores.filter((item) => Number(item.courseSectionId) === Number(section.id)).length;
    return {
      label: section.code,
      value: studentCount ? Math.round((scoreCount / studentCount) * 100) : 0,
    };
  });

  return (
    <div>
      <PageHeader
        title="Tổng quan giảng viên"
        description={activeSemester ? `${activeSemester.name} · ${activeSemester.academicYear}` : 'Chưa có học kỳ hiện hành'}
      />

      <div className="stats-grid">
        <StatCard label="Lớp học phần phụ trách" value={sections.length} />
        <StatCard label="Sinh viên đang học" value={uniqueStudentIds.size} />
        <StatCard label="Buổi đã điểm danh" value={sessions.length} />
        <StatCard label="Bài điểm đã nhập" value={`${scores.length}/${expectedScores}`} />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Tiến độ nhập điểm</h2>
              <span>Tỷ lệ sinh viên đã có bảng điểm theo lớp học phần</span>
            </div>
          </div>
          <BarChart items={scoreProgress} valueFormatter={(value) => `${value}%`} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Lớp đang phụ trách</h2>
              <span>{sections.length} lớp trong học kỳ hiện hành</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lớp HP</th>
                  <th>Môn học</th>
                  <th>Lớp</th>
                  <th>Sĩ số</th>
                  <th>Điểm</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => {
                  const subject = data.subjects.find((item) => Number(item.id) === Number(section.subjectId));
                  const classItem = data.classes.find((item) => Number(item.id) === Number(section.classId));
                  const studentCount = registrations.filter((item) => Number(item.courseSectionId) === Number(section.id)).length;
                  const scoreCount = scores.filter((item) => Number(item.courseSectionId) === Number(section.id)).length;
                  const complete = studentCount > 0 && scoreCount >= studentCount;
                  return (
                    <tr key={section.id}>
                      <td><strong>{section.code}</strong></td>
                      <td>{subject?.name}</td>
                      <td>{classItem?.code}</td>
                      <td>{studentCount}</td>
                      <td>
                        <StatusBadge tone={complete ? 'success' : 'warning'}>
                          {complete ? 'Đã đủ' : `${scoreCount}/${studentCount}`}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })}
                {!sections.length ? <tr><td colSpan="5" className="table-empty">Chưa có lớp học phần được phân công.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
