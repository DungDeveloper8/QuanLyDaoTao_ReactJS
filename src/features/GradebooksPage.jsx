import { useMemo, useState } from 'react';
import { getAllData } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import ExcelExportButton from '../shared/components/ExcelExportButton.jsx';
import Icon from '../shared/components/Icon.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import { isPassed, scoreClassification } from '../shared/utils/trainingRules.js';
import {
  createStudentTranscriptModel,
  downloadStudentTranscript,
} from '../shared/utils/transcriptExcel.js';

const TABS = [
  { id: 'section', label: 'Theo học phần' },
  { id: 'class', label: 'Theo lớp' },
  { id: 'faculty', label: 'Toàn khoa' },
  { id: 'student', label: 'Từng sinh viên' },
];

function enrichScore(score, data) {
  const student = data.students.find((item) => Number(item.id) === Number(score.studentId));
  const classItem = data.classes.find((item) => Number(item.id) === Number(student?.classId));
  const major = data.majors.find((item) => Number(item.id) === Number(classItem?.majorId));
  const faculty = data.faculties.find((item) => Number(item.id) === Number(major?.facultyId));
  const section = data.courseSections.find((item) => Number(item.id) === Number(score.courseSectionId));
  const subject = data.subjects.find((item) => Number(item.id) === Number(section?.subjectId));
  const semester = data.semesters.find((item) => Number(item.id) === Number(section?.semesterId));
  return { score, student, classItem, major, faculty, section, subject, semester };
}

function scoreRows(data) {
  const byStudentSection = new Map();

  data.scores.forEach((score) => {
    byStudentSection.set(`${score.studentId}-${score.courseSectionId}`, score);
  });

  data.registrations
    .filter((item) => item.status === 'registered')
    .forEach((registration) => {
      const key = `${registration.studentId}-${registration.courseSectionId}`;
      if (!byStudentSection.has(key)) {
        byStudentSection.set(key, {
          id: `pending-${key}`,
          studentId: registration.studentId,
          courseSectionId: registration.courseSectionId,
          kt1: null,
          kt2: null,
          kt3: null,
          exam: null,
          total: null,
          letter: '',
          classification: 'Chưa có',
        });
      }
    });

  return [...byStudentSection.values()].map((score) => enrichScore(score, data));
}

function exportColumns() {
  return [
    { label: 'Mã SV', value: (row) => row.student?.code || '' },
    { label: 'Họ tên', value: (row) => row.student?.fullName || '', width: 170 },
    { label: 'Lớp', value: (row) => row.classItem?.code || '' },
    { label: 'Mã học phần', value: (row) => row.section?.code || '', width: 145 },
    { label: 'Môn học', value: (row) => row.subject?.name || '', width: 190 },
    { label: 'KT1 (Chuyên cần)', value: (row) => row.score.kt1, type: 'Number' },
    { label: 'KT2 (Giữa kỳ 1)', value: (row) => row.score.kt2, type: 'Number' },
    { label: 'KT3 (Giữa kỳ 2)', value: (row) => row.score.kt3, type: 'Number' },
    { label: 'Thi cuối kỳ', value: (row) => row.score.exam, type: 'Number' },
    { label: 'Tổng kết', value: (row) => row.score.total, type: 'Number' },
    { label: 'Điểm chữ', value: (row) => row.score.letter },
    { label: 'Kết quả', value: (row) => row.score.total == null ? 'Chưa nhập' : isPassed(row.score.total) ? 'Đạt' : 'Không đạt' },
  ];
}

function GradeTable({ rows, showSemester = false }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Sinh viên</th>
            <th>Lớp</th>
            {showSemester ? <th>Học kỳ</th> : null}
            <th>Học phần / Môn học</th>
            <th>KT1<br /><small>Chuyên cần</small></th>
            <th>KT2<br /><small>Giữa kỳ 1</small></th>
            <th>KT3<br /><small>Giữa kỳ 2</small></th>
            <th>Thi cuối kỳ</th>
            <th>Tổng kết</th>
            <th>Xếp loại</th>
            <th>Kết quả</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.score.id}-${row.section?.id}`}>
              <td><strong>{row.student?.code}</strong><br />{row.student?.fullName}</td>
              <td>{row.classItem?.code || '—'}</td>
              {showSemester ? <td>{row.semester ? `${row.semester.name} ${row.semester.academicYear}` : '—'}</td> : null}
              <td><strong>{row.section?.code}</strong><br />{row.subject?.name}</td>
              <td>{row.score.kt1 ?? '—'}</td>
              <td>{row.score.kt2 ?? '—'}</td>
              <td>{row.score.kt3 ?? '—'}</td>
              <td>{row.score.exam ?? '—'}</td>
              <td><strong>{row.score.total ?? '—'}</strong></td>
              <td>{row.score.total == null ? '—' : `${row.score.letter} · ${scoreClassification(row.score.total)}`}</td>
              <td>
                <StatusBadge tone={row.score.total == null ? 'neutral' : isPassed(row.score.total) ? 'success' : 'danger'}>
                  {row.score.total == null ? 'Chưa nhập' : isPassed(row.score.total) ? 'Đạt' : 'Không đạt'}
                </StatusBadge>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan={showSemester ? 11 : 10} className="table-empty">Không có dữ liệu bảng điểm phù hợp.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default function GradebooksPage() {
  const { data, loading, error, reload } = useFetch(getAllData, []);
  const [tab, setTab] = useState('section');
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [classId, setClassId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [studentId, setStudentId] = useState('');

  const view = useMemo(() => {
    if (!data) return null;
    const activeSemester = data.semesters.find((item) => item.active);
    const selectedSemesterId = semesterId || String(activeSemester?.id || data.semesters[0]?.id || '');
    const allRows = scoreRows(data);
    const semesterSections = data.courseSections.filter(
      (item) => Number(item.semesterId) === Number(selectedSemesterId),
    );
    const firstSectionId = sectionId || String(semesterSections[0]?.id || '');
    const firstClassId = classId || String(data.classes[0]?.id || '');
    const firstFacultyId = facultyId || String(data.faculties[0]?.id || '');
    const firstStudentId = studentId || String(data.students[0]?.id || '');

    let rows = [];
    if (tab === 'section') {
      rows = allRows.filter((row) => Number(row.section?.id) === Number(firstSectionId));
    } else if (tab === 'class') {
      rows = allRows.filter(
        (row) =>
          Number(row.classItem?.id) === Number(firstClassId) &&
          Number(row.section?.semesterId) === Number(selectedSemesterId),
      );
    } else if (tab === 'faculty') {
      rows = allRows.filter(
        (row) =>
          Number(row.faculty?.id) === Number(firstFacultyId) &&
          Number(row.section?.semesterId) === Number(selectedSemesterId),
      );
    } else {
      rows = allRows.filter((row) => Number(row.student?.id) === Number(firstStudentId));
    }

    rows.sort((a, b) => {
      const studentCompare = String(a.student?.code || '').localeCompare(String(b.student?.code || ''), 'vi');
      if (studentCompare) return studentCompare;
      return String(a.subject?.code || '').localeCompare(String(b.subject?.code || ''), 'vi');
    });

    return {
      selectedSemesterId,
      selectedSectionId: firstSectionId,
      selectedClassId: firstClassId,
      selectedFacultyId: firstFacultyId,
      selectedStudentId: firstStudentId,
      semesterSections,
      rows,
    };
  }, [data, tab, semesterId, sectionId, classId, facultyId, studentId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const fileSuffix = tab === 'section'
    ? data.courseSections.find((item) => String(item.id) === String(view.selectedSectionId))?.code
    : tab === 'class'
      ? data.classes.find((item) => String(item.id) === String(view.selectedClassId))?.code
      : tab === 'faculty'
        ? data.faculties.find((item) => String(item.id) === String(view.selectedFacultyId))?.code
        : data.students.find((item) => String(item.id) === String(view.selectedStudentId))?.code;
  const transcript = tab === 'student'
    ? createStudentTranscriptModel(data, view.selectedStudentId)
    : null;

  return (
    <div>
      <PageHeader
        title="Bảng điểm tổng hợp"
        description="Tra cứu bảng điểm theo học phần, lớp, khoa hoặc từng sinh viên."
        actions={tab === 'student' ? (
          <button
            className="btn btn-excel btn-sm"
            type="button"
            onClick={() => downloadStudentTranscript(data, view.selectedStudentId)}
            disabled={!transcript?.rows.length}
            title={transcript?.rows.length ? 'Xuất các học phần đã đạt' : 'Sinh viên chưa có học phần đạt'}
          >
            <Icon name="download" size={15} />
            <span>{transcript?.graduated ? 'Xuất bảng điểm hoàn chỉnh' : 'Xuất bảng điểm'}</span>
          </button>
        ) : (
          <ExcelExportButton
            className="btn-sm"
            fileName={`bang-diem-${tab}-${fileSuffix || 'tong-hop'}.xls`}
            sheetName="Bang diem"
            rows={view.rows}
            columns={exportColumns()}
          />
        )}
      />

      <div className="tabs">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} type="button" onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        {tab !== 'student' ? (
          <label className="filter-field">
            <span>Học kỳ</span>
            <select value={view.selectedSemesterId} onChange={(event) => { setSemesterId(event.target.value); setSectionId(''); }}>
              {data.semesters.map((item) => (
                <option key={item.id} value={item.id}>{item.name} - {item.academicYear}</option>
              ))}
            </select>
          </label>
        ) : null}

        {tab === 'section' ? (
          <label className="filter-field">
            <span>Lớp học phần</span>
            <select value={view.selectedSectionId} onChange={(event) => setSectionId(event.target.value)}>
              {view.semesterSections.map((item) => {
                const subject = data.subjects.find((subjectItem) => Number(subjectItem.id) === Number(item.subjectId));
                return <option key={item.id} value={item.id}>{item.code} - {subject?.name}</option>;
              })}
            </select>
          </label>
        ) : null}

        {tab === 'class' ? (
          <label className="filter-field">
            <span>Lớp</span>
            <select value={view.selectedClassId} onChange={(event) => setClassId(event.target.value)}>
              {data.classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
            </select>
          </label>
        ) : null}

        {tab === 'faculty' ? (
          <label className="filter-field">
            <span>Khoa</span>
            <select value={view.selectedFacultyId} onChange={(event) => setFacultyId(event.target.value)}>
              {data.faculties.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
            </select>
          </label>
        ) : null}

        {tab === 'student' ? (
          <label className="filter-field">
            <span>Sinh viên</span>
            <select value={view.selectedStudentId} onChange={(event) => setStudentId(event.target.value)}>
              {data.students.map((item) => {
                const classItem = data.classes.find((candidate) => Number(candidate.id) === Number(item.classId));
                return <option key={item.id} value={item.id}>{item.code} - {item.fullName} ({classItem?.code})</option>;
              })}
            </select>
          </label>
        ) : null}

        <span className="filter-note">{view.rows.length} dòng điểm</span>
      </div>

      <GradeTable rows={view.rows} showSemester={tab === 'student'} />
    </div>
  );
}
