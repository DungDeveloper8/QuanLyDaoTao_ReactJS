import { useMemo, useState } from 'react';
import { createOne, getAllData, updateOne } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import Modal from '../shared/components/Modal.jsx';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatCard from '../shared/components/StatCard.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import { todayString } from '../shared/utils/date.js';

export default function RegistrationManagementPage() {
  const { data, loading, error, reload } = useFetch(getAllData, []);
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState('');
  const [newSectionId, setNewSectionId] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const view = useMemo(() => {
    if (!data) return null;
    const activeSemester = data.semesters.find((item) => item.active);
    const selectedSemesterId = semesterId || String(activeSemester?.id || data.semesters[0]?.id || '');
    const sections = data.courseSections.filter((item) => Number(item.semesterId) === Number(selectedSemesterId));
    const selectedSectionId = sectionId || 'all';
    const sectionIds = new Set(sections.map((item) => Number(item.id)));
    const keyword = query.trim().toLowerCase();

    const rows = data.registrations
      .filter((item) => sectionIds.has(Number(item.courseSectionId)))
      .map((registration) => {
        const student = data.students.find((item) => Number(item.id) === Number(registration.studentId));
        const classItem = data.classes.find((item) => Number(item.id) === Number(student?.classId));
        const section = data.courseSections.find((item) => Number(item.id) === Number(registration.courseSectionId));
        const subject = data.subjects.find((item) => Number(item.id) === Number(section?.subjectId));
        return { registration, student, classItem, section, subject };
      })
      .filter((row) => selectedSectionId === 'all' || Number(row.section?.id) === Number(selectedSectionId))
      .filter((row) => status === 'all' || row.registration.status === status)
      .filter((row) => {
        if (!keyword) return true;
        return [row.student?.code, row.student?.fullName, row.classItem?.code, row.section?.code, row.subject?.name]
          .some((value) => String(value || '').toLowerCase().includes(keyword));
      })
      .sort((a, b) => String(a.student?.code || '').localeCompare(String(b.student?.code || ''), 'vi'));

    return { activeSemester, selectedSemesterId, selectedSectionId, sections, rows };
  }, [data, semesterId, sectionId, status, query]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const registeredCount = view.rows.filter((row) => row.registration.status === 'registered').length;
  const cancelledCount = view.rows.filter((row) => row.registration.status === 'cancelled').length;

  async function addRegistration(event) {
    event.preventDefault();
    setMessage('');
    if (!newStudentId || !newSectionId) {
      setMessage('Hãy chọn sinh viên và lớp học phần.');
      return;
    }
    setSaving(true);
    try {
      await createOne('registrations', {
        studentId: Number(newStudentId),
        courseSectionId: Number(newSectionId),
        registeredAt: todayString(),
        status: 'registered',
      });
      setModalOpen(false);
      setNewStudentId('');
      setNewSectionId('');
      await reload();
    } catch (requestError) {
      setMessage(requestError.message || 'Không thể thêm đăng ký học phần.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRegistration(row) {
    const nextStatus = row.registration.status === 'registered' ? 'cancelled' : 'registered';
    if (!window.confirm(nextStatus === 'registered' ? 'Khôi phục đăng ký này?' : 'Hủy đăng ký này?')) return;
    try {
      await updateOne('registrations', row.registration.id, {
        ...row.registration,
        status: nextStatus,
      });
      await reload();
    } catch (requestError) {
      window.alert(requestError.message || 'Không thể cập nhật trạng thái đăng ký.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Quản lý đăng ký học phần"
        description="Theo dõi danh sách đăng ký theo học kỳ, lớp học phần và sinh viên."
        actions={(
          <button className="btn btn-primary" type="button" onClick={() => { setModalOpen(true); setMessage(''); }}>
            + Thêm đăng ký
          </button>
        )}
      />

      <div className="stats-grid">
        <StatCard label="Kết quả đang hiển thị" value={view.rows.length} />
        <StatCard label="Đang đăng ký" value={registeredCount} />
        <StatCard label="Đã hủy" value={cancelledCount} />
        <StatCard label="Lớp học phần học kỳ" value={view.sections.length} />
      </div>

      <div className="filter-bar">
        <label className="filter-field">
          <span>Học kỳ</span>
          <select value={view.selectedSemesterId} onChange={(event) => { setSemesterId(event.target.value); setSectionId(''); }}>
            {data.semesters.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.academicYear}</option>)}
          </select>
        </label>
        <label className="filter-field">
          <span>Lớp học phần</span>
          <select value={view.selectedSectionId} onChange={(event) => setSectionId(event.target.value)}>
            <option value="all">Tất cả</option>
            {view.sections.map((item) => {
              const subject = data.subjects.find((subjectItem) => Number(subjectItem.id) === Number(item.subjectId));
              return <option key={item.id} value={item.id}>{item.code} - {subject?.name}</option>;
            })}
          </select>
        </label>
        <label className="filter-field">
          <span>Trạng thái</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="registered">Đang đăng ký</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Tìm sinh viên</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã SV, họ tên, lớp..." />
        </label>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Lớp</th>
                <th>Lớp học phần</th>
                <th>Môn học</th>
                <th>Ngày đăng ký</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((row) => (
                <tr key={row.registration.id}>
                  <td><strong>{row.student?.code}</strong><br />{row.student?.fullName}</td>
                  <td>{row.classItem?.code || '—'}</td>
                  <td>{row.section?.code || '—'}</td>
                  <td>{row.subject?.name || '—'}</td>
                  <td>{row.registration.registeredAt || '—'}</td>
                  <td>
                    <StatusBadge tone={row.registration.status === 'registered' ? 'success' : 'neutral'}>
                      {row.registration.status === 'registered' ? 'Đang đăng ký' : 'Đã hủy'}
                    </StatusBadge>
                  </td>
                  <td>
                    <button
                      className={`btn btn-xs ${row.registration.status === 'registered' ? 'btn-danger' : 'btn-light'}`}
                      type="button"
                      onClick={() => toggleRegistration(row)}
                    >
                      {row.registration.status === 'registered' ? 'Hủy' : 'Khôi phục'}
                    </button>
                  </td>
                </tr>
              ))}
              {!view.rows.length ? <tr><td colSpan="7" className="table-empty">Không có đăng ký phù hợp.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={modalOpen} title="Thêm đăng ký học phần" onClose={() => setModalOpen(false)}>
        <form className="form-grid" onSubmit={addRegistration}>
          <label className="full">
            Sinh viên
            <select value={newStudentId} onChange={(event) => setNewStudentId(event.target.value)}>
              <option value="">-- Chọn sinh viên --</option>
              {data.students.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.fullName}</option>)}
            </select>
          </label>
          <label className="full">
            Lớp học phần
            <select value={newSectionId} onChange={(event) => setNewSectionId(event.target.value)}>
              <option value="">-- Chọn lớp học phần --</option>
              {data.courseSections.map((item) => {
                const subject = data.subjects.find((subjectItem) => Number(subjectItem.id) === Number(item.subjectId));
                const semester = data.semesters.find((semesterItem) => Number(semesterItem.id) === Number(item.semesterId));
                return <option key={item.id} value={item.id}>{item.code} - {subject?.name} - {semester?.code}</option>;
              })}
            </select>
          </label>
          {message ? <div className="form-alert form-alert-error full">{message}</div> : null}
          <div className="form-actions full">
            <button className="btn btn-light" type="button" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu đăng ký'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
