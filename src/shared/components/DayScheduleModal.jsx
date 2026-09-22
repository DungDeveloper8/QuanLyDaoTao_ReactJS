import Modal from './Modal.jsx';
import { SHIFT_LABELS, WEEKDAY_LABELS } from '../constants/academic.js';

const SHIFTS = [1, 2, 3, 4, 5];

export default function DayScheduleModal({
  day,
  sections = [],
  data,
  mode = 'student',
  onClose,
}) {
  const open = Boolean(day);
  const daySections = open
    ? sections
        .filter((item) => Number(item.weekday) === Number(day))
        .sort((a, b) => Number(a.shift) - Number(b.shift))
    : [];

  return (
    <Modal
      open={open}
      title={day ? `${WEEKDAY_LABELS[day]} · Lịch học cả ngày` : 'Lịch học cả ngày'}
      onClose={onClose}
      width={820}
    >
      <div className="day-schedule-detail">
        <div className="day-schedule-summary">
          <div>
            <strong>{daySections.length}</strong>
            <span>ca có lịch</span>
          </div>
          <p>Hiển thị đủ 5 ca trong ngày để dễ kiểm tra khoảng trống và lịch học.</p>
        </div>

        <div className="day-shift-list">
          {SHIFTS.map((shift) => {
            const shiftSections = daySections.filter(
              (item) => Number(item.shift) === Number(shift),
            );

            return (
              <section
                className={`day-shift-row ${shiftSections.length ? 'has-class' : 'is-empty'}`}
                key={shift}
              >
                <div className="day-shift-time">
                  <strong>{SHIFT_LABELS[shift]?.split(' (')[0] || `Ca ${shift}`}</strong>
                  <span>
                    {SHIFT_LABELS[shift]?.match(/\((.*)\)/)?.[1] || ''}
                  </span>
                </div>

                <div className="day-shift-content">
                  {shiftSections.length ? (
                    shiftSections.map((section) => {
                      const subject = data?.subjects.find(
                        (item) => Number(item.id) === Number(section.subjectId),
                      );
                      const classItem = data?.classes.find(
                        (item) => Number(item.id) === Number(section.classId),
                      );
                      const lecturer = data?.lecturers.find(
                        (item) => Number(item.id) === Number(section.lecturerId),
                      );

                      return (
                        <article className="day-shift-class" key={section.id}>
                          <div className="day-shift-class-main">
                            <strong>{subject?.name || 'Môn học'}</strong>
                            <span>{section.code}</span>
                          </div>
                          <div className="day-shift-meta">
                            <span>Phòng {section.room || '—'}</span>
                            <span>
                              {mode === 'lecturer'
                                ? `Lớp ${classItem?.code || classItem?.name || '—'}`
                                : lecturer?.fullName || 'Chưa có giảng viên'}
                            </span>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <span className="day-shift-free">Không có lịch</span>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
