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
  letterGrade,
  scoreClassification,
} from '../shared/utils/trainingRules.js';
import { getExcelNumber, getExcelValue } from '../shared/utils/exportExcel.js';

const SCORE_FIELDS = ['attendance', 'midterm', 'final'];

const SCORE_EXCEL_COLUMNS = [
  { label: 'Mã sinh viên', value: 'studentCode', width: 95 },
  { label: 'Họ và tên', value: 'fullName', width: 170 },
  { label: 'Mã lớp học phần', value: 'sectionCode', width: 145 },
  { label: 'Chuyên cần', value: 'attendance', type: 'Number', width: 90 },
  { label: 'Giữa kỳ', value: 'midterm', type: 'Number', width: 85 },
  { label: 'Cuối kỳ', value: 'final', type: 'Number', width: 85 },
  { label: 'Tổng kết', value: 'total', type: 'Number', width: 85 },
  { label: 'Điểm chữ', value: 'letter', width: 75 },
  { label: 'Xếp loại', value: 'classification', width: 90 },
]

const SCORE_EXCEL_HEADERS = {
  studentCode: ['Mã sinh viên', 'Mã SV', 'studentCode'],
  sectionCode: ['Mã lớp học phần', 'Mã lớp HP', 'sectionCode'],
  attendance: ['Chuyên cần', 'Điểm chuyên cần', 'attendance'],
  midterm: ['Giữa kỳ', 'Điểm giữa kỳ', 'midterm'],
  final: ['Cuối kỳ', 'Điểm cuối kỳ', 'final'],
};

export default function LecturerScoresPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      const firstSection = nextData.courseSections.find(
        (item) =>
          Number(item.lecturerId) === Number(user.lecturerId) &&
          Number(item.semesterId) === Number(activeSemester?.id),
      );

      setData(nextData);
      setSectionId((current) => current || (firstSection ? String(firstSection.id) : ''));
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
    if (!data) {
      return [];
    }

    const activeSemester = data.semesters.find((item) => item.active);
    return data.courseSections.filter(
      (item) =>
        Number(item.lecturerId) === Number(user.lecturerId) &&
        Number(item.semesterId) === Number(activeSemester?.id),
    );
  }, [data, user.lecturerId]);

  const section = useMemo(
    () => data?.courseSections.find((item) => Number(item.id) === Number(sectionId)),
    [data, sectionId],
  );

  const subject = useMemo(
    () => data?.subjects.find((item) => Number(item.id) === Number(section?.subjectId)),
    [data, section],
  );

  const students = useMemo(() => {
    if (!data || !sectionId) {
      return [];
    }

    const studentIds = new Set(
      data.registrations
        .filter(
          (item) =>
            Number(item.courseSectionId) === Number(sectionId) &&
            item.status === 'registered',
        )
        .map((item) => Number(item.studentId)),
    );

    return data.students.filter((item) => studentIds.has(Number(item.id)));
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
        attendance: score?.attendance ?? '',
        midterm: score?.midterm ?? '',
        final: score?.final ?? '',
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
      const attendance = getExcelNumber(row, SCORE_EXCEL_HEADERS.attendance);
      const midterm = getExcelNumber(row, SCORE_EXCEL_HEADERS.midterm);
      const final = getExcelNumber(row, SCORE_EXCEL_HEADERS.final);

      if (!studentCode) throw new Error(`Dòng ${rowNumber}: thiếu mã sinh viên.`);
      if (seenCodes.has(studentCode)) throw new Error(`Dòng ${rowNumber}: mã ${studentCode} bị lặp trong tệp.`);
      seenCodes.add(studentCode);

      const student = studentByCode.get(studentCode);
      if (!student) {
        throw new Error(`Dòng ${rowNumber}: ${studentCode} không đăng ký lớp học phần đang chọn.`);
      }
      if (sectionCode && sectionCode !== String(section.code).toUpperCase()) {
        throw new Error(`Dòng ${rowNumber}: mã lớp học phần phải là ${section.code}.`);
      }

      for (const [label, value] of [['Chuyên cần', attendance], ['Giữa kỳ', midterm], ['Cuối kỳ', final]]) {
        if (!Number.isFinite(value) || value < 0 || value > 10) {
          throw new Error(`Dòng ${rowNumber}: điểm ${label} phải từ 0 đến 10.`);
        }
      }

      return { student, attendance, midterm, final };
    });

    setImporting(true);
    try {
      for (const candidate of candidates) {
        const total = calculateTotalScore(candidate, subject);
        const existing = data.scores.find(
          (item) =>
            Number(item.studentId) === Number(candidate.student.id) &&
            Number(item.courseSectionId) === Number(section.id),
        );
        const payload = {
          studentId: candidate.student.id,
          courseSectionId: Number(section.id),
          attendance: candidate.attendance,
          midterm: candidate.midterm,
          final: candidate.final,
          total,
          letter: letterGrade(total),
          classification: scoreClassification(total),
        };

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
    if (!subject) {
      return;
    }

    setMessage('');

    for (const student of students) {
      const draft = drafts[student.id] || {};
      const incomplete = SCORE_FIELDS.some(
        (field) => draft[field] === '' || Number.isNaN(Number(draft[field])),
      );

      if (incomplete) {
        setMessage(`Chưa nhập đủ điểm cho ${student.code}.`);
        return;
      }
    }

    setSaving(true);

    try {
      const requests = students.map((student) => {
        const draft = drafts[student.id];
        const total = calculateTotalScore(draft, subject);
        const existing = data.scores.find(
          (item) =>
            Number(item.studentId) === Number(student.id) &&
            Number(item.courseSectionId) === Number(sectionId),
        );
        const payload = {
          studentId: student.id,
          courseSectionId: Number(sectionId),
          attendance: Number(draft.attendance),
          midterm: Number(draft.midterm),
          final: Number(draft.final),
          total,
          letter: letterGrade(total),
          classification: scoreClassification(total),
        };

        if (existing) {
          return updateOne('scores', existing.id, {
            ...existing,
            ...payload,
          });
        }

        return createOne('scores', payload);
      });

      await Promise.all(requests);
      await load();
      setMessage('Đã lưu bảng điểm.');
    } catch (saveError) {
      setMessage(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div>
      <PageHeader
        title="Nhập điểm & Quản lý điểm"
        description="Cập nhật điểm theo lớp học phần."
        actions={(
          <div className="page-actions">
            <ExcelExportButton
              fileName={`mau-nhap-diem-${section?.code || 'lop-hoc-phan'}.xls`}
              sheetName="Mau nhap diem"
              rows={students.map((student) => ({
                studentCode: student.code,
                fullName: student.fullName,
                sectionCode: section?.code || '',
                attendance: drafts[student.id]?.attendance ?? '',
                midterm: drafts[student.id]?.midterm ?? '',
                final: drafts[student.id]?.final ?? '',
                total: '',
                letter: '',
                classification: '',
              }))}
              columns={SCORE_EXCEL_COLUMNS.slice(0, 6)}
            >
              Tải mẫu điểm
            </ExcelExportButton>
            <ExcelImportButton
              onImport={importScores}
              disabled={!sectionId || importing || saving}
              title="Nhập điểm chuyên cần, giữa kỳ, cuối kỳ theo mã sinh viên và tự lưu vào API"
            >
              {importing ? 'Đang nhập...' : 'Nhập điểm Excel'}
            </ExcelImportButton>
            <ExcelExportButton
              fileName={`bang-diem-${section?.code || 'lop-hoc-phan'}.xls`}
              sheetName="Bang diem"
              rows={students.map((student) => {
                const draft = drafts[student.id] || {};
                const complete = SCORE_FIELDS.every((field) => draft[field] !== '' && draft[field] != null);
                const total = complete ? calculateTotalScore(draft, subject) : '';
                return {
                  studentCode: student.code,
                  fullName: student.fullName,
                  sectionCode: section?.code || '',
                  attendance: draft.attendance ?? '',
                  midterm: draft.midterm ?? '',
                  final: draft.final ?? '',
                  total,
                  letter: total === '' ? '' : letterGrade(total),
                  classification: total === '' ? '' : scoreClassification(total),
                };
              })}
              columns={SCORE_EXCEL_COLUMNS}
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

        {subject ? (
          <span className="filter-note">
            Trọng số: CC {subject.attendanceWeight}% · GK {subject.midtermWeight}% · CK{' '}
            {subject.finalWeight}%
          </span>
        ) : null}
      </div>

      {message ? <div className="form-alert">{message}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sinh viên</th>
              <th>Chuyên cần</th>
              <th>Giữa kỳ</th>
              <th>Cuối kỳ</th>
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
                  <td>
                    <strong>{total ?? '—'}</strong>
                  </td>
                  <td>
                    {total == null
                      ? '—'
                      : `${letterGrade(total)} · ${scoreClassification(total)}`}
                  </td>
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
                <td colSpan="7" className="table-empty">
                  Chưa có sinh viên đăng ký.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
