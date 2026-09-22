import { useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import { getAllData } from '../core/api/apiClient.js';
import { SHIFT_LABELS, WEEKDAY_LABELS } from '../shared/constants/academic.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import DayScheduleModal from '../shared/components/DayScheduleModal.jsx';

const WEEKDAYS = [2, 3, 4, 5, 6, 7, 8];

export default function StudentSchedulePage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(getAllData, []);
  const [selectedDay, setSelectedDay] = useState(null);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  const activeSemester = data.semesters.find((item) => item.active);
  const registeredSectionIds = new Set(
    data.registrations
      .filter(
        (item) =>
          Number(item.studentId) === Number(user.studentId) &&
          item.status === 'registered',
      )
      .map((item) => Number(item.courseSectionId)),
  );
  const sections = data.courseSections.filter(
    (item) =>
      registeredSectionIds.has(Number(item.id)) &&
      Number(item.semesterId) === Number(activeSemester?.id),
  );

  return (
    <div>
      <PageHeader
        title="Thời khóa biểu cá nhân"
        description={
          activeSemester
            ? `${activeSemester.name} - ${activeSemester.academicYear}`
            : 'Chưa có học kỳ hiện hành'
        }
      />

      <div className="schedule-grid">
        {WEEKDAYS.map((day) => {
          const daySections = sections
            .filter((item) => Number(item.weekday) === day)
            .sort((a, b) => Number(a.shift) - Number(b.shift));

          return (
            <section className="schedule-day" key={day}>
              <div className="schedule-day-head">
                <h2>{WEEKDAY_LABELS[day]}</h2>
                <button
                  className="schedule-day-open"
                  type="button"
                  onClick={() => setSelectedDay(day)}
                >
                  Xem cả ngày
                </button>
              </div>

              {daySections.map((section) => {
                const subject = data.subjects.find(
                  (item) => Number(item.id) === Number(section.subjectId),
                );
                const lecturer = data.lecturers.find(
                  (item) => Number(item.id) === Number(section.lecturerId),
                );

                return (
                  <article className="schedule-item" key={section.id}>
                    <strong>{SHIFT_LABELS[section.shift]}</strong>
                    <span>{subject?.name}</span>
                    <small>
                      {section.code} · Phòng {section.room} · {lecturer?.fullName}
                    </small>
                  </article>
                );
              })}

              {!daySections.length ? (
                <span className="muted schedule-empty-label">Không có lịch</span>
              ) : null}
            </section>
          );
        })}
      </div>

      <DayScheduleModal
        day={selectedDay}
        sections={sections}
        data={data}
        mode="student"
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}
