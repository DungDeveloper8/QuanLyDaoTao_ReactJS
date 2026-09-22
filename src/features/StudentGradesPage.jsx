import { useMemo, useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import { getAllData } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import ExcelExportButton from '../shared/components/ExcelExportButton.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatCard from '../shared/components/StatCard.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import {
  calculateWeightedAverage,
  isPassed,
  scoreClassification,
} from '../shared/utils/trainingRules.js';

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

  const exportRows = view.scores.map((score) => {
    const section = view.sections.find((item) => Number(item.id) === Number(score.courseSectionId));
    const subject = data.subjects.find((item) => Number(item.id) === Number(section?.subjectId));
    return {
      studentCode: student?.code || '',
      fullName: student?.fullName || '',
      classCode: classItem?.code || '',
      subjectCode: subject?.code || '',
      subjectName: subject?.name || '',
      kt1: score.kt1,
      kt2: score.kt2,
      kt3: score.kt3,
      exam: score.exam,
      total: score.total,
      letter: score.letter,
      result: isPassed(score.total) ? 'Đạt' : 'Không đạt',
    };
  });

  return (
    <div>
      <PageHeader
        title="Bảng điểm sinh viên"
        description={`${student?.code || ''} - ${student?.fullName || ''}${classItem ? ` · ${classItem.code}` : ''}`}
        actions={(
          <ExcelExportButton
            fileName={`bang-diem-${student?.code || 'sinh-vien'}.xls`}
            sheetName="Bang diem sinh vien"
            rows={exportRows}
            columns={[
              { label: 'Mã SV', value: 'studentCode' },
              { label: 'Họ tên', value: 'fullName', width: 170 },
              { label: 'Lớp', value: 'classCode' },
              { label: 'Mã môn', value: 'subjectCode' },
              { label: 'Môn học', value: 'subjectName', width: 190 },
              { label: 'KT1', value: 'kt1', type: 'Number' },
              { label: 'KT2', value: 'kt2', type: 'Number' },
              { label: 'KT3', value: 'kt3', type: 'Number' },
              { label: 'Điểm thi', value: 'exam', type: 'Number' },
              { label: 'Tổng kết', value: 'total', type: 'Number' },
              { label: 'Điểm chữ', value: 'letter' },
              { label: 'Kết quả', value: 'result' },
            ]}
          />
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
              <th>KT1</th>
              <th>KT2</th>
              <th>KT3</th>
              <th>Điểm thi</th>
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
