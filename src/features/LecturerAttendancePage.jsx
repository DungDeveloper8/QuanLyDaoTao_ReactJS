import { useEffect, useMemo, useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import { createOne, getAllData, updateOne } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import {
  buildMonthCells,
  monthLabel,
  moveMonth,
  scheduledDatesInMonth,
  toDateKey,
} from '../shared/utils/schedule.js';
import { attendanceSummary } from '../shared/utils/trainingRules.js';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const TODAY = toDateKey(new Date());

function normalizeAttendanceRecord({ sessionId, studentId, draft, maxPeriods }) {
  const status = draft?.status === 'absent' ? 'absent' : 'present';

  return {
    sessionId: Number(sessionId),
    studentId: Number(studentId),
    status,
    absentPeriods:
      status === 'absent'
        ? Math.min(maxPeriods, Math.max(1, Number(draft?.absentPeriods || 1)))
        : 0,
    note: '',
  };
}

async function saveAttendanceSheet({ data, section, date, students, drafts }) {
  let session = data.attendanceSessions.find(
    (item) => Number(item.courseSectionId) === Number(section.id) && item.date === date,
  );

  if (!session) {
    const response = await createOne('attendanceSessions', {
      courseSectionId: Number(section.id),
      date,
      topic: 'Nội dung học theo kế hoạch',
      periods: Number(section.periodsPerSession || 3),
    });
    session = response.data;
  }

  await Promise.all(students.map((student) => {
    const payload = normalizeAttendanceRecord({
      sessionId: session.id,
      studentId: student.id,
      draft: drafts[student.id],
      maxPeriods: Number(session.periods || section.periodsPerSession || 3),
    });
    const existing = data.attendanceRecords.find(
      (item) =>
        Number(item.sessionId) === Number(session.id) &&
        Number(item.studentId) === Number(student.id),
    );

    return existing
      ? updateOne('attendanceRecords', existing.id, { ...existing, ...payload })
      : createOne('attendanceRecords', payload);
  }));

  return session;
}

function createDefaultDrafts(students) {
  return Object.fromEntries(
    students.map((student) => [
      student.id,
      {
        status: 'present',
        absentPeriods: 0,
      },
    ]),
  );
}

function semesterContainsToday(semester) {
  if (!semester) {
    return false;
  }

  return TODAY >= semester.startDate && TODAY <= semester.endDate;
}

export default function LecturerAttendancePage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [monthDate, setMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

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

  const activeSemester = useMemo(
    () => data?.semesters.find((item) => item.active),
    [data],
  );

  const sections = useMemo(() => {
    if (!data || !activeSemester) {
      return [];
    }

    return data.courseSections.filter(
      (item) =>
        Number(item.lecturerId) === Number(user.lecturerId) &&
        Number(item.semesterId) === Number(activeSemester.id),
    );
  }, [activeSemester, data, user.lecturerId]);

  const section = useMemo(
    () => data?.courseSections.find((item) => Number(item.id) === Number(sectionId)),
    [data, sectionId],
  );

  const subject = useMemo(
    () => data?.subjects.find((item) => Number(item.id) === Number(section?.subjectId)),
    [data, section],
  );

  const classItem = useMemo(
    () => data?.classes.find((item) => Number(item.id) === Number(section?.classId)),
    [data, section],
  );

  const students = useMemo(() => {
    if (!data || !sectionId) {
      return [];
    }

    const registeredStudentIds = new Set(
      data.registrations
        .filter(
          (item) =>
            Number(item.courseSectionId) === Number(sectionId) &&
            item.status === 'registered',
        )
        .map((item) => Number(item.studentId)),
    );

    return data.students
      .filter((item) => registeredStudentIds.has(Number(item.id)))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [data, sectionId]);

  const sectionSessions = useMemo(() => {
    if (!data || !sectionId) {
      return [];
    }

    return data.attendanceSessions.filter(
      (item) => Number(item.courseSectionId) === Number(sectionId),
    );
  }, [data, sectionId]);

  const sessionByDate = useMemo(
    () => new Map(sectionSessions.map((item) => [item.date, item])),
    [sectionSessions],
  );

  const scheduledDates = useMemo(
    () => scheduledDatesInMonth(section, activeSemester, monthDate),
    [section, activeSemester, monthDate],
  );

  const scheduledDateSet = useMemo(
    () => new Set(scheduledDates),
    [scheduledDates],
  );

  const monthCells = useMemo(
    () => buildMonthCells(monthDate),
    [monthDate],
  );

  useEffect(() => {
    if (!activeSemester || semesterContainsToday(activeSemester)) {
      return;
    }

    setMonthDate(new Date(`${activeSemester.startDate}T00:00:00`));
  }, [activeSemester?.id]);

  useEffect(() => {
    if (!scheduledDates.length) {
      setSelectedDate('');
      return;
    }

    const todayInMonth = scheduledDates.includes(TODAY) ? TODAY : '';
    const latestPastDate = scheduledDates.filter((date) => date <= TODAY).at(-1) || '';

    setSelectedDate((current) => {
      if (scheduledDates.includes(current)) {
        return current;
      }

      return todayInMonth || latestPastDate || scheduledDates[0];
    });
  }, [scheduledDates]);

  useEffect(() => {
    if (!data || !selectedDate) {
      setDrafts({});
      return;
    }

    const session = sessionByDate.get(selectedDate);
    const nextDrafts = createDefaultDrafts(students);

    if (session) {
      students.forEach((student) => {
        const record = data.attendanceRecords.find(
          (item) =>
            Number(item.sessionId) === Number(session.id) &&
            Number(item.studentId) === Number(student.id),
        );

        if (record) {
          nextDrafts[student.id] = {
            status: record.status === 'absent' ? 'absent' : 'present',
            absentPeriods: Number(record.absentPeriods || 0),
          };
        }
      });
    }

    setDrafts(nextDrafts);
    setMessage('');
  }, [data, selectedDate, sessionByDate, students]);

  function updateDraft(studentId, patch) {
    setDrafts((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        ...patch,
      },
    }));
  }

  function changeStatus(studentId, status) {
    updateDraft(studentId, {
      status,
      absentPeriods:
        status === 'present'
          ? 0
          : Math.max(1, Number(drafts[studentId]?.absentPeriods || 1)),
    });
  }

  function changeAbsentPeriods(studentId, value) {
    const maxPeriods = Number(section?.periodsPerSession || 3);
    const numericValue = Number(value);
    const normalizedValue = Number.isFinite(numericValue)
      ? Math.min(maxPeriods, Math.max(1, numericValue))
      : 1;

    updateDraft(studentId, {
      absentPeriods: normalizedValue,
    });
  }

  async function handleSave() {
    if (!selectedDate || !section || selectedDate > TODAY) {
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      await saveAttendanceSheet({
        data,
        section,
        date: selectedDate,
        students,
        drafts,
      });
      await load();
      setMessage(
        `Đã lưu điểm danh ngày ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('vi-VN')}.`,
      );
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

  const selectedSession = sessionByDate.get(selectedDate);
  const selectedIsFuture = Boolean(selectedDate && selectedDate > TODAY);

  return (
    <div>
      <PageHeader
        title="Điểm danh lớp học phần"
        description="Chọn ngày học và cập nhật trạng thái điểm danh."
        actions={
          <button
            className="btn btn-primary"
            type="button"
            disabled={!selectedDate || selectedIsFuture || saving || !students.length}
            onClick={handleSave}
          >
            {saving ? 'Đang lưu...' : 'Lưu điểm danh'}
          </button>
        }
      />

      <div className="filter-bar attendance-filter">
        <label className="filter-field">
          <span>Lớp học phần</span>
          <select
            value={sectionId}
            onChange={(event) => {
              setSectionId(event.target.value);
              setMessage('');
            }}
          >
            {!sections.length ? <option value="">Không có lớp học phần</option> : null}
            {sections.map((item) => {
              const itemSubject = data.subjects.find(
                (subjectItem) => Number(subjectItem.id) === Number(item.subjectId),
              );

              return (
                <option key={item.id} value={item.id}>
                  {item.code} · {itemSubject?.name}
                </option>
              );
            })}
          </select>
        </label>

        <div className="attendance-context">
          <strong>{subject?.name || 'Chưa chọn môn học'}</strong>
          <span>
            {classItem?.name || '—'} · Phòng {section?.room || '—'} ·{' '}
            {section?.periodsPerSession || 3} tiết/buổi
          </span>
        </div>
      </div>

      {!section ? (
        <div className="empty-state">Giảng viên chưa được phân công lớp học phần trong học kỳ hiện tại.</div>
      ) : (
        <div className="attendance-layout">
          <section className="panel attendance-calendar-panel">
            <div className="panel-head calendar-toolbar">
              <button
                className="btn btn-light btn-sm"
                type="button"
                onClick={() => setMonthDate(moveMonth(monthDate, -1))}
              >
                ← Tháng trước
              </button>

              <div>
                <h2>{monthLabel(monthDate)}</h2>
                <span>Ngày học lấy tự động từ thời khóa biểu.</span>
              </div>

              <button
                className="btn btn-light btn-sm"
                type="button"
                onClick={() => setMonthDate(moveMonth(monthDate, 1))}
              >
                Tháng sau →
              </button>
            </div>

            <div className="calendar-legend">
              <span>
                <i className="legend-dot saved" /> Đã điểm danh
              </span>
              <span>
                <i className="legend-dot pending" /> Chưa điểm danh
              </span>
              <span>
                <i className="legend-dot future" /> Sắp học
              </span>
            </div>

            <div className="month-calendar" aria-label="Lịch điểm danh theo tháng">
              {WEEKDAYS.map((label) => (
                <div className="calendar-weekday" key={label}>
                  {label}
                </div>
              ))}

              {monthCells.map((date, index) => {
                if (!date) {
                  return <div className="calendar-cell empty" key={`empty-${index}`} />;
                }

                const dateKey = toDateKey(date);
                const isScheduled = scheduledDateSet.has(dateKey);
                const session = sessionByDate.get(dateKey);
                const state = !isScheduled
                  ? 'off'
                  : session
                    ? 'saved'
                    : dateKey > TODAY
                      ? 'future'
                      : 'pending';

                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={!isScheduled}
                    className={`calendar-cell ${state} ${selectedDate === dateKey ? 'selected' : ''}`}
                    onClick={() => setSelectedDate(dateKey)}
                  >
                    <strong>{date.getDate()}</strong>
                    {isScheduled ? (
                      <small>
                        {state === 'saved'
                          ? 'Đã lưu'
                          : state === 'future'
                            ? 'Sắp học'
                            : 'Chưa lưu'}
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel attendance-sheet-panel">
            <div className="panel-head attendance-sheet-head">
              <div>
                <h2>
                  {selectedDate
                    ? `Điểm danh ngày ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('vi-VN')}`
                    : 'Chọn một ngày học'}
                </h2>
                <span>
                  {selectedSession
                    ? 'Dữ liệu đã lưu · có thể chỉnh sửa và lưu lại'
                    : selectedIsFuture
                      ? 'Ngày học chưa diễn ra'
                      : 'Chưa lưu điểm danh'}
                </span>
              </div>
              {selectedSession ? <StatusBadge tone="success">Đã lưu</StatusBadge> : null}
            </div>

            {message ? <div className="form-alert attendance-message">{message}</div> : null}

            {selectedDate ? (
              <div className="table-wrap">
                <table className="attendance-table">
                  <colgroup>
                    <col className="attendance-col-index" />
                    <col className="attendance-col-student" />
                    <col className="attendance-col-status" />
                    <col className="attendance-col-periods" />
                    <col className="attendance-col-summary" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Sinh viên</th>
                      <th>Trạng thái</th>
                      <th>Số tiết vắng</th>
                      <th>Tổng chuyên cần</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student, index) => {
                      const draft = drafts[student.id] || {
                        status: 'present',
                        absentPeriods: 0,
                      };
                      const summary = attendanceSummary(
                        student.id,
                        Number(sectionId),
                        data.attendanceSessions,
                        data.attendanceRecords,
                        subject?.maxAbsenceRate,
                      );

                      return (
                        <tr key={student.id}>
                          <td>{index + 1}</td>
                          <td>
                            <strong>{student.code}</strong>
                            <br />
                            <span>{student.fullName}</span>
                          </td>
                          <td>
                            <div
                              className="attendance-choice"
                              role="group"
                              aria-label={`Trạng thái của ${student.fullName}`}
                            >
                              <button
                                type="button"
                                className={draft.status === 'present' ? 'active present' : ''}
                                onClick={() => changeStatus(student.id, 'present')}
                                disabled={selectedIsFuture}
                              >
                                Có mặt
                              </button>
                              <button
                                type="button"
                                className={draft.status === 'absent' ? 'active absent' : ''}
                                onClick={() => changeStatus(student.id, 'absent')}
                                disabled={selectedIsFuture}
                              >
                                Vắng
                              </button>
                            </div>
                          </td>
                          <td>
                            <div
                              className={`period-input-wrap ${
                                draft.status === 'present' ? 'is-present' : 'is-absent'
                              }`}
                            >
                              <input
                                className="period-input"
                                type="number"
                                min={draft.status === 'present' ? 0 : 1}
                                max={section.periodsPerSession || 3}
                                value={draft.status === 'present' ? 0 : draft.absentPeriods}
                                onChange={(event) =>
                                  changeAbsentPeriods(student.id, event.target.value)
                                }
                                disabled={selectedIsFuture || draft.status === 'present'}
                                aria-label={`Số tiết vắng của ${student.fullName}`}
                              />
                              <span className="period-input-unit">
                                / {section.periodsPerSession || 3} tiết
                              </span>
                            </div>
                          </td>
                          <td>
                            <span>
                              {summary.absentPeriods}/{summary.totalPeriods} tiết vắng
                            </span>
                            <br />
                            <StatusBadge tone={summary.eligible ? 'success' : 'danger'}>
                              {summary.eligible ? 'Đủ điều kiện' : 'Không đủ điều kiện'}
                            </StatusBadge>
                          </td>
                        </tr>
                      );
                    })}

                    {!students.length ? (
                      <tr>
                        <td colSpan="5" className="table-empty">
                          Chưa có sinh viên đăng ký lớp học phần này.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">Tháng này không có ngày học theo thời khóa biểu.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
