import { useMemo, useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import { getAllData } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import Icon from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatCard from '../shared/components/StatCard.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import {
  calculateWeightedAverage,
  isPassed,
  scoreClassification,
} from '../shared/utils/trainingRules.js';
import {
  createStudentTranscriptModel,
  downloadStudentTranscript,
} from '../shared/utils/transcriptExcel.js';

export default function StudentGradesPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(getAllData, []);
  const [semesterId, setSemesterId] = useState('');

  const view = useMemo(() => {
    if (!data) return null;

    const activeSemester = data.semesters.find((item) => item.active);
    const selectedSemesterId = semesterId || String(activeSemester?.id || '');
    const sections = data.courseSections.filter(
      (item) => Number(item.semesterId) === Number(selectedSemesterId),
    );
    const sectionIds = new Set(sections.map((item) => Number(item.id)));
    const scores = data.scores.filter(
      (item) =>
        Number(item.studentId) === Number(user.studentId) &&
        sectionIds.has(Number(item.courseSectionId)),
    );

    return { selectedSemesterId, sections, scores };
  }, [data, semesterId, user.studentId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const student = data.students.find((item) => Number(item.id) === Number(user.studentId));
  const classItem = data.classes.find((item) => Number(item.id) === Number(student?.classId));
  const cumulativeScores = data.scores.filter(
    (item) => Number(item.studentId) === Number(user.studentId),
  );
  const transcript = createStudentTranscriptModel(data, user.studentId);


  return (
    <div>
      <PageHeader
        title="Bảng điểm sinh viên"
        description={`${student?.code || ''} - ${student?.fullName || ''}${classItem ? ` · ${classItem.code}` : ''}`}
        actions={(
          <button
            className="btn btn-excel btn-sm"
            type="button"
            onClick={() => downloadStudentTranscript(data, user.studentId)}
            disabled={!transcript.rows.length}
            title={transcript.rows.length ? 'Xuất các học phần đã đạt' : 'Chưa có học phần đạt để xuất'}
          >
            <Icon name="download" size={15} />
            <span>{transcript.graduated ? 'Xuất bảng điểm hoàn chỉnh' : 'Xuất bảng điểm'}</span>
          </button>
        )}
      />

      <div className="stats-grid">
        <StatCard
          label="Điểm TB học kỳ"
          value={view.scores.length ? calculateWeightedAverage(view.scores, data.courseSections, data.subjects) : '—'}
        />
        <StatCard
          label="Điểm TB tích lũy"
          value={cumulativeScores.length ? calculateWeightedAverage(cumulativeScores, data.courseSections, data.subjects) : '—'}
        />
        <StatCard label="Môn đã đạt" value={cumulativeScores.filter((item) => isPassed(item.total)).length} />
        <StatCard label="Môn chưa đạt" value={cumulativeScores.filter((item) => !isPassed(item.total)).length} />
      </div>

      <div className="filter-bar">
        <label className="filter-field">
          <span>Học kỳ</span>
          <select value={view.selectedSemesterId} onChange={(event) => setSemesterId(event.target.value)}>
            {data.semesters.map((item) => (
              <option key={item.id} value={item.id}>{item.name} - {item.academicYear}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Môn học</th>
              <th>KT1<br /><small>Chuyên cần</small></th>
              <th>KT2<br /><small>Giữa kỳ 1</small></th>
              <th>KT3<br /><small>Giữa kỳ 2</small></th>
              <th>Thi cuối kỳ</th>
              <th>Tổng kết</th>
              <th>Điểm chữ</th>
              <th>Xếp loại</th>
              <th>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {view.scores.map((score) => {
              const section = view.sections.find((item) => Number(item.id) === Number(score.courseSectionId));
              const subject = data.subjects.find((item) => Number(item.id) === Number(section?.subjectId));
              return (
                <tr key={score.id}>
                  <td><strong>{subject?.code}</strong><br />{subject?.name}</td>
                  <td>{score.kt1}</td>
                  <td>{score.kt2}</td>
                  <td>{score.kt3}</td>
                  <td>{score.exam}</td>
                  <td><strong>{score.total}</strong></td>
                  <td>{score.letter}</td>
                  <td>{scoreClassification(score.total)}</td>
                  <td>
                    <StatusBadge tone={isPassed(score.total) ? 'success' : 'danger'}>
                      {isPassed(score.total) ? 'Đạt' : 'Không đạt'}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
            {!view.scores.length ? (
              <tr><td colSpan="9" className="table-empty">Chưa có điểm trong học kỳ này.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
