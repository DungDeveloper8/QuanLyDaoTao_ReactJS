import { useEffect, useMemo, useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import { createOne, getAllData, updateOne } from '../core/api/apiClient.js';
import { SHIFT_LABELS, WEEKDAY_LABELS } from '../shared/constants/academic.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import { todayString } from '../shared/utils/date.js';
import { registrationCount, validateRegistration } from '../shared/utils/trainingRules.js';

export default function StudentRegistrationPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('info');

  async function load() {
    setLoading(true);
    setError('');

    try {
      setData(await getAllData());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const view = useMemo(() => {
    if (!data) {
      return null;
    }

    const student = data.students.find(
      (item) => Number(item.id) === Number(user.studentId),
    );
    const classItem = data.classes.find(
      (item) => Number(item.id) === Number(student?.classId),
    );
    const activeSemester = data.semesters.find((item) => item.active);
    const curriculum = data.curricula.find(
      (item) => Number(item.majorId) === Number(classItem?.majorId) && item.active,
    );
    const allowedSubjectIds = new Set((curriculum?.subjectIds || []).map(Number));
    const keyword = query.trim().toLowerCase();

    const sections = data.courseSections.filter((section) => {
      if (Number(section.semesterId) !== Number(activeSemester?.id)) {
        return false;
      }

      if (!allowedSubjectIds.has(Number(section.subjectId))) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const subject = data.subjects.find(
        (item) => Number(item.id) === Number(section.subjectId),
      );
      return (
        section.code.toLowerCase().includes(keyword) ||
        subject?.name.toLowerCase().includes(keyword)
      );
    });

    return {
      student,
      classItem,
      activeSemester,
      curriculum,
      sections,
    };
  }, [data, query, user.studentId]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const today = todayString();
  const registrationOpen = Boolean(
    view.activeSemester &&
      today >= view.activeSemester.registrationStart &&
      today <= view.activeSemester.registrationEnd,
  );

  async function handleRegister(section) {
    setMessage('');
    setMessageTone('info');

    if (!registrationOpen) {
      setMessageTone('error');
      setMessage('Hiện không nằm trong thời gian đăng ký học phần.');
      return;
    }

    const subject = data.subjects.find(
      (item) => Number(item.id) === Number(section.subjectId),
    );
    const validation = validateRegistration({
      studentId: view.student.id,
      section,
      subject,
      registrations: data.registrations,
      courseSections: data.courseSections,
      subjects: data.subjects,
      scores: data.scores,
    });

    if (!validation.ok) {
      setMessageTone('error');
      setMessage(validation.message);
      return;
    }

    try {
      await createOne('registrations', {
        studentId: view.student.id,
        courseSectionId: section.id,
        registeredAt: today,
        status: 'registered',
      });

      setMessageTone('success');
      setMessage(`Đã đăng ký ${section.code}.`);
      await load();
    } catch (requestError) {
      setMessageTone('error');
      setMessage(requestError.message || 'Không thể đăng ký lớp học phần.');
    }
  }

  async function handleCancel(registration) {
    setMessageTone('info');
    if (!registrationOpen) {
      setMessageTone('error');
      setMessage('Đã hết thời gian cho phép hủy đăng ký.');
      return;
    }

    if (!window.confirm('Hủy lớp học phần đã đăng ký?')) {
      return;
    }

    try {
      await updateOne('registrations', registration.id, {
        ...registration,
        status: 'cancelled',
      });

      setMessageTone('success');
      setMessage('Đã hủy đăng ký.');
      await load();
    } catch (requestError) {
      setMessageTone('error');
      setMessage(requestError.message || 'Không thể hủy đăng ký học phần.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Đăng ký học phần"
        description={
          view.activeSemester
            ? `${view.activeSemester.name} · ${view.activeSemester.academicYear} · ` +
              `Đăng ký từ ${view.activeSemester.registrationStart} ` +
              `đến ${view.activeSemester.registrationEnd}`
            : 'Chưa có học kỳ hiện hành'
        }
      />

      <div className={`form-alert ${registrationOpen ? '' : 'form-alert-warning'}`}>
        {registrationOpen ? 'Cổng đăng ký đang mở.' : 'Cổng đăng ký hiện đang đóng.'}
      </div>

      {message ? (
        <div className={`form-alert ${messageTone === 'error' ? 'form-alert-error' : ''}`}>
          {message}
        </div>
      ) : null}

      <div className="toolbar">
        <input
          placeholder="Tìm mã lớp hoặc tên môn..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Lớp HP</th>
              <th>Môn học</th>
              <th>TC</th>
              <th>Lịch</th>
              <th>Giảng viên</th>
              <th>Chỗ trống</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {view.sections.map((section) => {
              const subject = data.subjects.find(
                (item) => Number(item.id) === Number(section.subjectId),
              );
              const lecturer = data.lecturers.find(
                (item) => Number(item.id) === Number(section.lecturerId),
              );
              const registeredCount = registrationCount(section.id, data.registrations);
              const registration = data.registrations.find(
                (item) =>
                  Number(item.studentId) === Number(view.student.id) &&
                  Number(item.courseSectionId) === Number(section.id) &&
                  item.status === 'registered',
              );

              return (
                <tr key={section.id}>
                  <td>
                    <strong>{section.code}</strong>
                  </td>
                  <td>{subject?.name}</td>
                  <td>{subject?.credits}</td>
                  <td>
                    {WEEKDAY_LABELS[section.weekday]} · {SHIFT_LABELS[section.shift]}
                  </td>
                  <td>{lecturer?.fullName}</td>
                  <td>
                    {Math.max(0, Number(section.capacity) - registeredCount)}/{section.capacity}
                  </td>
                  <td>
                    <StatusBadge tone={section.status === 'open' ? 'success' : 'neutral'}>
                      {section.status === 'open' ? 'Mở' : 'Đóng'}
                    </StatusBadge>
                  </td>
                  <td>
                    {registration ? (
                      <button
                        className="btn btn-danger btn-xs"
                        type="button"
                        onClick={() => handleCancel(registration)}
                      >
                        Hủy
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-xs"
                        type="button"
                        disabled={
                          !registrationOpen ||
                          section.status !== 'open' ||
                          registeredCount >= Number(section.capacity)
                        }
                        onClick={() => handleRegister(section)}
                      >
                        Đăng ký
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {!view.sections.length ? (
              <tr>
                <td colSpan="8" className="table-empty">
                  Không có lớp học phần phù hợp với chương trình đào tạo.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
