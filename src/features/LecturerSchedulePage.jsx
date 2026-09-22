import { useState } from 'react';
import useAuth from '../core/auth/useAuth.js';
import useFetch from '../shared/hooks/useFetch.js';
import { getAllData } from '../core/api/apiClient.js';
import PageHeader from '../shared/components/PageHeader.jsx';
import {
  ErrorState,
  LoadingState,
} from '../shared/components/DataState.jsx';
import {
  SHIFT_LABELS,
  WEEKDAY_LABELS,
} from '../shared/constants/academic.js';
import DayScheduleModal from '../shared/components/DayScheduleModal.jsx';

const WEEKDAYS = [2, 3, 4, 5, 6, 7, 8];

export default function LecturerSchedule() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(getAllData, []);
  const [selectedDay, setSelectedDay] = useState(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const active = data.semesters.find((x) => x.active);
  const sections = data.courseSections
    .filter(
      (x) =>
        Number(x.lecturerId) === Number(user.lecturerId) &&
        Number(x.semesterId) === Number(active?.id),
    )
    .sort((a, b) => a.weekday - b.weekday || a.shift - b.shift);

  return (
    <div>
      <PageHeader
        title="Thời khóa biểu giảng viên"
        description={active ? `${active.name} - ${active.academicYear}` : ''}
      />

      <div className="schedule-grid">
        {WEEKDAYS.map((day) => {
          const daySections = sections.filter((x) => Number(x.weekday) === day);

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

              {daySections.map((section) => (
                <article className="schedule-item" key={section.id}>
                  <strong>{SHIFT_LABELS[section.shift]}</strong>
                  <span>
                    {
                      data.subjects.find(
                        (x) => Number(x.id) === Number(section.subjectId),
                      )?.name
                    }
                  </span>
                  <small>
                    {section.code} ·{' '}
                    {
                      data.classes.find(
                        (x) => Number(x.id) === Number(section.classId),
                      )?.code
                    }{' '}
                    · Phòng {section.room}
                  </small>
                </article>
              ))}

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
        mode="lecturer"
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}
