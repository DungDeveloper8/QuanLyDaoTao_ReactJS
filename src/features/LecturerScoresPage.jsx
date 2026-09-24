import { useEffect, useMemo, useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import { createOne, getAllData, updateOne } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import ExcelExportButton, { ExcelImportButton } from '../shared/components/ExcelExportButton.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import {
  attendanceSummary,
  calculateTotalScore,
  isPassed,
  letterGrade,
  scoreClassification,
} from '../shared/utils/trainingRules.js';
import { getExcelNumber, getExcelValue } from '../shared/utils/exportExcel.js';

const SCORE_FIELDS = ['kt1', 'kt2', 'kt3', 'exam'];

const SCORE_EXCEL_COLUMNS = [
  { label: 'Mã sinh viên', value: 'studentCode', width: 72 },
  { label: 'Họ và tên', value: 'fullName', width: 135 },
  { label: 'Mã lớp học phần', value: 'sectionCode', width: 112 },
  { label: 'KT1 (Chuyên cần)', value: 'kt1', type: 'Number', width: 72 },
  { label: 'KT2 (Giữa kỳ 1)', value: 'kt2', type: 'Number', width: 72 },
  { label: 'KT3 (Giữa kỳ 2)', value: 'kt3', type: 'Number', width: 72 },
  { label: 'Thi cuối kỳ', value: 'exam', type: 'Number', width: 68 },
  { label: 'Tổng kết', value: 'total', type: 'Number', width: 62 },
  { label: 'Điểm chữ', value: 'letter', width: 55 },
  { label: 'Xếp loại', value: 'classification', width: 78 },
  { label: 'Kết quả', value: 'result', width: 72 },
];

const SCORE_EXCEL_HEADERS = {
  studentCode: ['Mã sinh viên', 'Mã SV', 'studentCode'],
  sectionCode: ['Mã lớp học phần', 'Mã lớp HP', 'sectionCode'],
  kt1: ['KT1 (Chuyên cần)', 'KT1', 'Điểm KT1', 'kt1'],
  kt2: ['KT2 (Giữa kỳ 1)', 'KT2', 'Điểm KT2', 'kt2'],
  kt3: ['KT3 (Giữa kỳ 2)', 'KT3', 'Điểm KT3', 'kt3'],
  exam: ['Thi cuối kỳ', 'Điểm thi', 'Thi', 'exam'],
};

function scorePayload(studentId, sectionId, draft, subject) {
  const total = calculateTotalScore(draft, subject);
  return {
    studentId: Number(studentId),
    courseSectionId: Number(sectionId),
    kt1: Number(draft.kt1),
    kt2: Number(draft.kt2),
    kt3: Number(draft.kt3),
    exam: Number(draft.exam),
    total,
    letter: letterGrade(total),
    classification: scoreClassification(total),
  };
}

export default function LecturerScoresPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const nextData = await getAllData();
      const activeSemester = nextData.semesters.find((item) => item.active);
      const nextSemesterId = semesterId || String(activeSemester?.id || '');
      const firstSection = nextData.courseSections.find(
        (item) =>
          Number(item.lecturerId) === Number(user.lecturerId) &&
          Number(item.semesterId) === Number(nextSemesterId),
      );

      setData(nextData);
      setSemesterId(nextSemesterId);
      setSectionId((current) => {
        const stillValid = nextData.courseSections.some(
          (item) =>
            String(item.id) === String(current) &&
            Number(item.lecturerId) === Number(user.lecturerId) &&
            Number(item.semesterId) === Number(nextSemesterId),
        );
        return stillValid ? current : firstSection ? String(firstSection.id) : '';
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sections = useMemo(() => {
    if (!data || !semesterId) return [];
    return data.courseSections.filter(
      (item) =>
        Number(item.lecturerId) === Number(user.lecturerId) &&
        Number(item.semesterId) === Number(semesterId),
    );
  }, [data, semesterId, user.lecturerId]);

  useEffect(() => {
    if (!sections.some((item) => String(item.id) === String(sectionId))) {
      setSectionId(sections[0] ? String(sections[0].id) : '');
    }
  }, [sections, sectionId]);

  const section = useMemo(
    () => data?.courseSections.find((item) => Number(item.id) === Number(sectionId)),
    [data, sectionId],
  );

  const subject = useMemo(
    () => data?.subjects.find((item) => Number(item.id) === Number(section?.subjectId)),
    [data, section],
  );

  const semester = useMemo(
    () => data?.semesters.find((item) => Number(item.id) === Number(semesterId)),
    [data, semesterId],
  );

  const lecturer = useMemo(
    () => data?.lecturers.find((item) => Number(item.id) === Number(user.lecturerId)),
    [data, user.lecturerId],
  );

  const students = useMemo(() => {
    if (!data || !sectionId) return [];

    const studentIds = new Set(
      data.registrations
        .filter(
          (item) =>
            Number(item.courseSectionId) === Number(sectionId) &&
            item.status === 'registered',
        )
        .map((item) => Number(item.studentId)),
    );

    return data.students
      .filter((item) => studentIds.has(Number(item.id)))
      .sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  }, [data, sectionId]);

  useEffect(() => {
    if (!data || !sectionId) {
      setDrafts({});
      return;
    }

    const nextDrafts = {};
    students.forEach((student) => {
      const score = data.scores.find(
        (item) =>
          Number(item.courseSectionId) === Number(sectionId) &&
          Number(item.studentId) === Number(student.id),
      );

      nextDrafts[student.id] = {
        kt1: score?.kt1 ?? '',
        kt2: score?.kt2 ?? '',
        kt3: score?.kt3 ?? '',
        exam: score?.exam ?? '',
      };
    });

    setDrafts(nextDrafts);
    setMessage('');
  }, [data, sectionId, students]);

  function setScore(studentId, field, value) {
    const numericValue = value === '' ? '' : Math.max(0, Math.min(10, Number(value)));
    setDrafts((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        [field]: numericValue,
      },
    }));
  }

  async function importScores(rows) {
    setMessage('');
    if (!section || !subject) throw new Error('Hãy chọn lớp học phần trước khi nhập điểm.');
    if (!rows.length) throw new Error('Tệp Excel không có dữ liệu điểm.');

    const studentByCode = new Map(students.map((item) => [item.code.toUpperCase(), item]));
    const seenCodes = new Set();
    const candidates = rows.map((row, index) => {
      const rowNumber = index + 2;
      const studentCode = String(getExcelValue(row, SCORE_EXCEL_HEADERS.studentCode) || '')
        .trim()
        .toUpperCase();
      const sectionCode = String(getExcelValue(row, SCORE_EXCEL_HEADERS.sectionCode) || '')
        .trim()
        .toUpperCase();
      const kt1 = getExcelNumber(row, SCORE_EXCEL_HEADERS.kt1);
      const kt2 = getExcelNumber(row, SCORE_EXCEL_HEADERS.kt2);
      const kt3 = getExcelNumber(row, SCORE_EXCEL_HEADERS.kt3);
      const exam = getExcelNumber(row, SCORE_EXCEL_HEADERS.exam);

      if (!studentCode) throw new Error(`Dòng ${rowNumber}: thiếu mã sinh viên.`);
      if (seenCodes.has(studentCode)) {
        throw new Error(`Dòng ${rowNumber}: mã ${studentCode} bị lặp trong tệp.`);
      }
      seenCodes.add(studentCode);

      const student = studentByCode.get(studentCode);
      if (!student) {
        throw new Error(`Dòng ${rowNumber}: ${studentCode} không đăng ký lớp học phần đang chọn.`);
      }
      if (sectionCode && sectionCode !== String(section.code).toUpperCase()) {
        throw new Error(`Dòng ${rowNumber}: mã lớp học phần phải là ${section.code}.`);
      }

      for (const [label, value] of [['KT1', kt1], ['KT2', kt2], ['KT3', kt3], ['Điểm thi', exam]]) {
        if (!Number.isFinite(value) || value < 0 || value > 10) {
          throw new Error(`Dòng ${rowNumber}: ${label} phải từ 0 đến 10.`);
        }
      }

      return { student, kt1, kt2, kt3, exam };
    });

    setImporting(true);
    try {
      for (const candidate of candidates) {
        const existing = data.scores.find(
          (item) =>
            Number(item.studentId) === Number(candidate.student.id) &&
            Number(item.courseSectionId) === Number(section.id),
        );
        const payload = scorePayload(candidate.student.id, section.id, candidate, subject);

        if (existing) {
          await updateOne('scores', existing.id, { ...existing, ...payload });
        } else {
          await createOne('scores', payload);
        }
      }

      await load();
      setMessage(`Đã nhập và lưu điểm Excel cho ${candidates.length} sinh viên.`);
    } finally {
      setImporting(false);
    }
  }

  async function handleSaveAll() {
    if (!subject || !sectionId) return;
    setMessage('');

    for (const student of students) {
      const draft = drafts[student.id] || {};
      const incomplete = SCORE_FIELDS.some(
        (field) => draft[field] === '' || Number.isNaN(Number(draft[field])),
      );
      if (incomplete) {
        setMessage(`Chưa nhập đủ KT1, KT2, KT3 và điểm thi cho ${student.code}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const requests = students.map((student) => {
        const draft = drafts[student.id];
        const existing = data.scores.find(
          (item) =>
            Number(item.studentId) === Number(student.id) &&
            Number(item.courseSectionId) === Number(sectionId),
        );
        const payload = scorePayload(student.id, sectionId, draft, subject);

        return existing
          ? updateOne('scores', existing.id, { ...existing, ...payload })
          : createOne('scores', payload);
      });

      await Promise.all(requests);
      await load();
      setMessage('Đã lưu bảng điểm học phần.');
    } catch (saveError) {
      setMessage(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Nhập điểm & Bảng điểm học phần"
        description="Nhập KT1 (chuyên cần), KT2–KT3 (giữa kỳ), thi cuối kỳ và xem kết quả theo lớp học phần."
        actions={(
          <div className="page-actions">
            <ExcelExportButton
              className="btn-sm"
              fileName={`mau-nhap-diem-${section?.code || 'lop-hoc-phan'}.xls`}
              sheetName="Mau nhap diem"
              rows={students.map((student) => ({
                studentCode: student.code,
                fullName: student.fullName,
                sectionCode: section?.code || '',
                kt1: drafts[student.id]?.kt1 ?? '',
                kt2: drafts[student.id]?.kt2 ?? '',
                kt3: drafts[student.id]?.kt3 ?? '',
                exam: drafts[student.id]?.exam ?? '',
              }))}
              columns={SCORE_EXCEL_COLUMNS.slice(0, 7)}
              title="MẪU NHẬP ĐIỂM HỌC PHẦN"
              variant="template"
              orientation="Landscape"
            >
              Tải mẫu điểm
            </ExcelExportButton>
            <ExcelImportButton
              className="btn-sm"
              onImport={importScores}
              disabled={!sectionId || importing || saving}
              title="Nhập KT1, KT2, KT3 và thi cuối kỳ theo mã sinh viên"
            >
              {importing ? 'Đang nhập...' : 'Nhập điểm Excel'}
            </ExcelImportButton>
            <ExcelExportButton
              className="btn-sm"
              fileName={`bang-diem-hoc-phan-${section?.code || 'lop-hoc-phan'}.xls`}
              sheetName="Bang diem hoc phan"
              rows={students.map((student) => {
                const draft = drafts[student.id] || {};
                const complete = SCORE_FIELDS.every((field) => draft[field] !== '' && draft[field] != null);
                const total = complete ? calculateTotalScore(draft, subject) : '';
                return {
                  studentCode: student.code,
                  fullName: student.fullName,
                  sectionCode: section?.code || '',
                  kt1: draft.kt1 ?? '',
                  kt2: draft.kt2 ?? '',
                  kt3: draft.kt3 ?? '',
                  exam: draft.exam ?? '',
                  total,
                  letter: total === '' ? '' : letterGrade(total),
                  classification: total === '' ? '' : scoreClassification(total),
                  result: total === '' ? 'Chưa nhập' : isPassed(total) ? 'Đạt' : 'Không đạt',
                };
              })}
              columns={SCORE_EXCEL_COLUMNS}
              title="BẢNG ĐIỂM HỌC PHẦN"
              subtitle={subject ? `${subject.code} - ${subject.name}` : ''}
              metadata={[
                { label: 'Lớp học phần', value: section?.code || '' },
                { label: 'Học kỳ', value: semester ? `${semester.name} - ${semester.academicYear}` : '' },
                { label: 'Số tín chỉ', value: subject?.credits ?? '' },
                { label: 'Giảng viên', value: lecturer?.fullName || '' },
              ]}
              orientation="Landscape"
            />
            <button
              className="btn btn-primary"
              type="button"
              disabled={!sectionId || saving || importing}
              onClick={handleSaveAll}
            >
              {saving ? 'Đang lưu...' : 'Lưu toàn bộ'}
            </button>
          </div>
        )}
      />

      <div className="filter-bar">
        <label className="filter-field">
          <span>Học kỳ</span>
          <select value={semesterId} onChange={(event) => setSemesterId(event.target.value)}>
            {data.semesters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.academicYear}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Lớp học phần</span>
          <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
            <option value="">-- Chọn lớp học phần --</option>
            {sections.map((item) => {
              const itemSubject = data.subjects.find(
                (subjectItem) => Number(subjectItem.id) === Number(item.subjectId),
              );
              return (
                <option key={item.id} value={item.id}>
                  {item.code} - {itemSubject?.name}
                </option>
              );
            })}
          </select>
        </label>
        {subject ? (
          <span className="filter-note">
            Trọng số: KT1 {subject.kt1Weight}% · KT2 {subject.kt2Weight}% · KT3 {subject.kt3Weight}% · Thi {subject.examWeight}%
          </span>
        ) : null}
      </div>

      {message ? <div className="form-alert">{message}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sinh viên</th>
              <th>KT1<br /><small>Chuyên cần</small></th>
              <th>KT2<br /><small>Giữa kỳ 1</small></th>
              <th>KT3<br /><small>Giữa kỳ 2</small></th>
              <th>Thi cuối kỳ</th>
              <th>Tổng kết</th>
              <th>Xếp loại</th>
              <th>Điều kiện thi</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const draft = drafts[student.id] || {};
              const complete = SCORE_FIELDS.every(
                (field) => draft[field] !== '' && draft[field] != null,
              );
              const total = complete ? calculateTotalScore(draft, subject) : null;
              const summary = attendanceSummary(
                student.id,
                Number(sectionId),
                data.attendanceSessions,
                data.attendanceRecords,
                subject?.maxAbsenceRate,
              );

              return (
                <tr key={student.id}>
                  <td>
                    <strong>{student.code}</strong>
                    <br />
                    {student.fullName}
                  </td>
                  {SCORE_FIELDS.map((field) => (
                    <td key={field}>
                      <input
                        className="score-input"
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={draft[field] ?? ''}
                        onChange={(event) => setScore(student.id, field, event.target.value)}
                      />
                    </td>
                  ))}
                  <td><strong>{total ?? '—'}</strong></td>
                  <td>{total == null ? '—' : `${letterGrade(total)} · ${scoreClassification(total)}`}</td>
                  <td>
                    <StatusBadge tone={summary.eligible ? 'success' : 'danger'}>
                      {summary.eligible ? 'Đủ ĐK' : 'Không đủ ĐK'}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
            {!students.length ? (
              <tr>
                <td colSpan="8" className="table-empty">Chưa có sinh viên đăng ký.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
