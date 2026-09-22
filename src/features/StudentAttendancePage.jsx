import { useMemo, useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import { getAllData } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatCard from '../shared/components/StatCard.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import { attendanceSummary } from '../shared/utils/trainingRules.js';

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(getAllData, []);
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const view = useMemo(() => {
    if (!data) return null;
    const activeSemester = data.semesters.find((item) => item.active);
    const selectedSemesterId = semesterId || String(activeSemester?.id || data.semesters[0]?.id || '');
    const registeredSectionIds = new Set(
      data.registrations
        .filter((item) => Number(item.studentId) === Number(user.studentId) && item.status === 'registered')
        .map((item) => Number(item.courseSectionId)),
    );
    const sections = data.courseSections.filter(
      (item) => registeredSectionIds.has(Number(item.id)) && Number(item.semesterId) === Number(selectedSemesterId),
    );
    const selectedSectionId = sectionId && sections.some((item) => String(item.id) === String(sectionId))
      ? sectionId
      : String(sections[0]?.id || '');

    const summaries = sections.map((section) => {
      const subject = data.subjects.find((item) => Number(item.id) === Number(section.subjectId));
      return {
        section,
        subject,
        summary: attendanceSummary(
          user.studentId,
          section.id,
          data.attendanceSessions,
          data.attendanceRecords,
          subject?.maxAbsenceRate,
        ),
      };
    });

    const selectedSection = sections.find((item) => String(item.id) === String(selectedSectionId));
    const selectedSessions = data.attendanceSessions
      .filter((item) => Number(item.courseSectionId) === Number(selectedSection?.id))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const history = selectedSessions.map((session) => ({
      session,
      record: data.attendanceRecords.find(
        (item) => Number(item.sessionId) === Number(session.id) && Number(item.studentId) === Number(user.studentId),
      ),
    }));

    return { selectedSemesterId, selectedSectionId, sections, summaries, history };
  }, [data, semesterId, sectionId, user.studentId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const totalPeriods = view.summaries.reduce((sum, item) => sum + item.summary.totalPeriods, 0);
  const absentPeriods = view.summaries.reduce((sum, item) => sum + item.summary.absentPeriods, 0);
  const overallRate = totalPeriods ? Number(((absentPeriods / totalPeriods) * 100).toFixed(1)) : 0;
  const ineligibleCount = view.summaries.filter((item) => !item.summary.eligible).length;

  return (
    <div>
      <PageHeader
        title="Chuyên cần & điểm danh"
        description="Theo dõi lịch sử điểm danh, tỷ lệ vắng và điều kiện dự thi theo từng học phần."
      />

      <div className="stats-grid">
        <StatCard label="Học phần" value={view.sections.length} />
        <StatCard label="Tổng tiết đã ghi nhận" value={totalPeriods} />
        <StatCard label="Tiết vắng" value={absentPeriods} />
        <StatCard label="Tỷ lệ vắng chung" value={`${overallRate}%`} />
      </div>

      {ineligibleCount ? (
        <div className="form-alert form-alert-error">
          Có {ineligibleCount} học phần đang vượt ngưỡng vắng cho phép. Hãy kiểm tra chi tiết bên dưới.
        </div>
      ) : null}

      <div className="filter-bar">
        <label className="filter-field">
          <span>Học kỳ</span>
          <select value={view.selectedSemesterId} onChange={(event) => { setSemesterId(event.target.value); setSectionId(''); }}>
            {data.semesters.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.academicYear}</option>)}
          </select>
        </label>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><h2>Tổng hợp theo học phần</h2><span>{view.summaries.length} học phần</span></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Lớp HP</th><th>Môn học</th><th>Tổng tiết</th><th>Tiết vắng</th><th>Tỷ lệ vắng</th><th>Điều kiện dự thi</th><th>Chi tiết</th></tr>
            </thead>
            <tbody>
              {view.summaries.map((row) => (
                <tr key={row.section.id}>
                  <td><strong>{row.section.code}</strong></td>
                  <td>{row.subject?.name}</td>
                  <td>{row.summary.totalPeriods}</td>
                  <td>{row.summary.absentPeriods}</td>
                  <td>{row.summary.absenceRate}%</td>
                  <td><StatusBadge tone={row.summary.eligible ? 'success' : 'danger'}>{row.summary.eligible ? 'Đủ điều kiện' : 'Không đủ điều kiện'}</StatusBadge></td>
                  <td><button className="btn btn-light btn-xs" type="button" onClick={() => setSectionId(String(row.section.id))}>Xem buổi học</button></td>
                </tr>
              ))}
              {!view.summaries.length ? <tr><td colSpan="7" className="table-empty">Chưa có dữ liệu chuyên cần trong học kỳ này.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {view.selectedSectionId ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Lịch sử điểm danh</h2>
              <span>{view.sections.find((item) => String(item.id) === String(view.selectedSectionId))?.code}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ngày học</th><th>Nội dung</th><th>Số tiết</th><th>Trạng thái</th><th>Tiết vắng</th></tr></thead>
              <tbody>
                {view.history.map(({ session, record }) => (
                  <tr key={session.id}>
                    <td>{session.date}</td>
                    <td>{session.topic}</td>
                    <td>{session.periods}</td>
                    <td>
                      <StatusBadge tone={!record ? 'neutral' : record.status === 'present' ? 'success' : 'danger'}>
                        {!record ? 'Chưa ghi nhận' : record.status === 'present' ? 'Có mặt' : 'Vắng'}
                      </StatusBadge>
                    </td>
                    <td>{record?.status === 'absent' ? Number(record.absentPeriods || session.periods || 0) : 0}</td>
                  </tr>
                ))}
                {!view.history.length ? <tr><td colSpan="5" className="table-empty">Chưa có buổi điểm danh.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
