import { useEffect, useMemo, useState } from 'react'
import { createOne, getAllData, removeOne, updateOne } from '../core/api/apiClient.js'
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx'
import Modal from '../shared/components/Modal.jsx'
import ExcelExportButton from '../shared/components/ExcelExportButton.jsx'
import PageHeader from '../shared/components/PageHeader.jsx'
import Pagination from '../shared/components/Pagination.jsx'
import StatusBadge from '../shared/components/StatusBadge.jsx'
import { SHIFT_LABELS, WEEKDAY_LABELS } from '../shared/constants/academic.js'
import { findTeachingConflict, registrationCount } from '../shared/utils/trainingRules.js'

const PAGE_SIZE = 9

const emptyForm = {
  code: '',
  subjectId: '',
  classId: '',
  lecturerId: '',
  semesterId: '',
  room: '',
  weekday: 2,
  shift: 1,
  capacity: 40,
  status: 'open',
}

const statusLabels = {
  draft: 'Nháp',
  open: 'Mở đăng ký',
  closed: 'Đóng đăng ký',
  finished: 'Đã kết thúc',
}

function statusTone(status) {
  if (status === 'open') {
    return 'success'
  }

  if (status === 'draft') {
    return 'warning'
  }

  return 'neutral'
}

export default function CourseSectionsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [semesterId, setSemesterId] = useState('all')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(undefined)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')

    try {
      const snapshot = await getAllData()

      setData({
        courseSections: snapshot.courseSections,
        subjects: snapshot.subjects,
        classes: snapshot.classes,
        lecturers: snapshot.lecturers,
        semesters: snapshot.semesters,
        registrations: snapshot.registrations,
      })

      if (semesterId === 'all') {
        const activeSemester = snapshot.semesters.find((item) => item.active)
        if (activeSemester) {
          setSemesterId(String(activeSemester.id))
        }
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, semesterId])

  const filteredSections = useMemo(() => {
    if (!data) {
      return []
    }

    const keyword = query.trim().toLowerCase()

    return data.courseSections.filter((section) => {
      const subject = data.subjects.find(
        (item) => Number(item.id) === Number(section.subjectId),
      )
      const lecturer = data.lecturers.find(
        (item) => Number(item.id) === Number(section.lecturerId),
      )
      const matchesSemester =
        semesterId === 'all' || Number(section.semesterId) === Number(semesterId)
      const matchesKeyword =
        !keyword ||
        section.code.toLowerCase().includes(keyword) ||
        subject?.name.toLowerCase().includes(keyword) ||
        lecturer?.fullName.toLowerCase().includes(keyword)

      return matchesSemester && matchesKeyword
    })
  }, [data, query, semesterId])

  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  const totalPages = Math.max(1, Math.ceil(filteredSections.length / PAGE_SIZE))
  const pagedSections = filteredSections.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )

  function openCreate() {
    const activeSemester = data.semesters.find((item) => item.active)

    setEditing(null)
    setForm({
      ...emptyForm,
      semesterId: activeSemester ? String(activeSemester.id) : '',
    })
    setFormError('')
  }

  function openEdit(item) {
    const stringFields = ['subjectId', 'classId', 'lecturerId', 'semesterId']
    const nextForm = Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        stringFields.includes(key) ? String(value) : value,
      ]),
    )

    setEditing(item)
    setForm(nextForm)
    setFormError('')
  }

  function validate(payload) {
    if (
      !payload.code.trim() ||
      !payload.subjectId ||
      !payload.classId ||
      !payload.lecturerId ||
      !payload.semesterId ||
      !payload.room.trim()
    ) {
      return 'Vui lòng nhập đầy đủ mã lớp học phần, môn, lớp, giảng viên, học kỳ và phòng.'
    }

    if (payload.capacity <= 0) {
      return 'Sĩ số tối đa phải lớn hơn 0.'
    }

    const duplicatedCode = data.courseSections.some(
      (item) =>
        item.id !== editing?.id &&
        item.code.toLowerCase() === payload.code.toLowerCase(),
    )

    if (duplicatedCode) {
      return 'Mã lớp học phần đã tồn tại.'
    }

    const conflict = findTeachingConflict(payload, data.courseSections)
    if (conflict) {
      const reasons = []

      if (Number(conflict.lecturerId) === Number(payload.lecturerId)) {
        reasons.push('giảng viên')
      }
      if (Number(conflict.classId) === Number(payload.classId)) {
        reasons.push('lớp')
      }
      if (conflict.room.trim().toLowerCase() === payload.room.trim().toLowerCase()) {
        reasons.push('phòng')
      }

      return `Trùng lịch ${reasons.join(', ')} với lớp học phần ${conflict.code}.`
    }

    const currentCount = editing
      ? registrationCount(editing.id, data.registrations)
      : 0
    const changedAcademicIdentity =
      editing &&
      currentCount > 0 &&
      (
        Number(payload.subjectId) !== Number(editing.subjectId) ||
        Number(payload.classId) !== Number(editing.classId) ||
        Number(payload.semesterId) !== Number(editing.semesterId)
      )

    if (changedAcademicIdentity) {
      return 'Không thể đổi môn, lớp hoặc học kỳ sau khi đã có sinh viên đăng ký.'
    }

    if (payload.capacity < currentCount) {
      return `Sĩ số tối đa không thể nhỏ hơn ${currentCount} sinh viên đã đăng ký.`
    }

    return ''
  }

  function buildPayload() {
    return {
      ...form,
      code: form.code.trim().toUpperCase(),
      subjectId: Number(form.subjectId),
      classId: Number(form.classId),
      lecturerId: Number(form.lecturerId),
      semesterId: Number(form.semesterId),
      room: form.room.trim().toUpperCase(),
      weekday: Number(form.weekday),
      shift: Number(form.shift),
      capacity: Number(form.capacity),
    }
  }

  async function save(event) {
    event.preventDefault()
    setFormError('')

    const payload = buildPayload()
    const message = validate(payload)

    if (message) {
      setFormError(message)
      return
    }

    setSaving(true)

    try {
      if (editing) {
        await updateOne('courseSections', editing.id, {
          ...editing,
          ...payload,
        })
      } else {
        await createOne('courseSections', payload)
      }

      setEditing(undefined)
      await load()
    } catch (requestError) {
      setFormError(requestError.message || 'Không thể lưu lớp học phần.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(item) {
    const hasRegistration = data.registrations.some(
      (registration) => Number(registration.courseSectionId) === Number(item.id),
    )

    if (hasRegistration) {
      window.alert(
        'Không thể xóa lớp học phần đã phát sinh đăng ký. Có thể chuyển trạng thái sang Đã kết thúc.',
      )
      return
    }

    if (!window.confirm(`Xóa lớp học phần ${item.code}?`)) {
      return
    }

    await removeOne('courseSections', item.id)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Phân công & Thời khóa biểu"
        description="Phân công giảng dạy và thời khóa biểu lớp học phần."
        actions={(
          <div className="page-actions">
            <ExcelExportButton
              fileName="phan-cong-thoi-khoa-bieu.xls"
              sheetName="Phan cong TKB"
              rows={filteredSections}
              columns={[
                { label: 'Mã lớp học phần', value: 'code', width: 115 },
                {
                  label: 'Môn học',
                  value: (section) => data.subjects.find(
                    (item) => Number(item.id) === Number(section.subjectId),
                  )?.name || '',
                  width: 210,
                },
                {
                  label: 'Lớp',
                  value: (section) => data.classes.find(
                    (item) => Number(item.id) === Number(section.classId),
                  )?.code || '',
                  width: 90,
                },
                {
                  label: 'Giảng viên',
                  value: (section) => data.lecturers.find(
                    (item) => Number(item.id) === Number(section.lecturerId),
                  )?.fullName || '',
                  width: 170,
                },
                {
                  label: 'Lịch học',
                  value: (section) => `${WEEKDAY_LABELS[section.weekday]} - ${SHIFT_LABELS[section.shift]}`,
                  width: 120,
                },
                { label: 'Phòng', value: 'room', width: 80 },
                {
                  label: 'Đã đăng ký',
                  value: (section) => registrationCount(section.id, data.registrations),
                  type: 'Number',
                  width: 80,
                },
                { label: 'Sĩ số tối đa', value: 'capacity', type: 'Number', width: 80 },
                {
                  label: 'Trạng thái',
                  value: (section) => statusLabels[section.status] || section.status,
                  width: 100,
                },
              ]}
            />
            <button className="btn btn-primary" onClick={openCreate}>
              + Tạo lớp học phần
            </button>
          </div>
        )}
      />

      <div className="filter-bar">
        <input
          placeholder="Tìm mã lớp, môn, giảng viên..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          value={semesterId}
          onChange={(event) => setSemesterId(event.target.value)}
        >
          <option value="all">Tất cả học kỳ</option>
          {data.semesters.map((semester) => (
            <option key={semester.id} value={semester.id}>
              {semester.name} - {semester.academicYear}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã LHP</th>
              <th>Môn học</th>
              <th>Lớp</th>
              <th>Giảng viên</th>
              <th>Lịch học</th>
              <th>Phòng</th>
              <th>Sĩ số</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedSections.map((section) => {
              const count = registrationCount(section.id, data.registrations)
              const subject = data.subjects.find(
                (item) => Number(item.id) === Number(section.subjectId),
              )
              const studentClass = data.classes.find(
                (item) => Number(item.id) === Number(section.classId),
              )
              const lecturer = data.lecturers.find(
                (item) => Number(item.id) === Number(section.lecturerId),
              )

              return (
                <tr key={section.id}>
                  <td>
                    <strong>{section.code}</strong>
                  </td>
                  <td>{subject?.name || '—'}</td>
                  <td>{studentClass?.code || '—'}</td>
                  <td>{lecturer?.fullName || '—'}</td>
                  <td>
                    {WEEKDAY_LABELS[section.weekday]} · {SHIFT_LABELS[section.shift]}
                  </td>
                  <td>{section.room}</td>
                  <td>{count}/{section.capacity}</td>
                  <td>
                    <StatusBadge tone={statusTone(section.status)}>
                      {statusLabels[section.status] || section.status}
                    </StatusBadge>
                  </td>
                  <td className="action-cell">
                    <button
                      className="btn btn-light btn-xs"
                      onClick={() => openEdit(section)}
                    >
                      Sửa
                    </button>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => remove(section)}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <Modal
        open={editing !== undefined}
        title={editing ? 'Cập nhật lớp học phần' : 'Tạo lớp học phần'}
        onClose={() => setEditing(undefined)}
      >
        <form className="form-grid" onSubmit={save}>
          <label>
            Mã lớp học phần
            <input
              value={form.code || ''}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
          </label>

          <label>
            Môn học
            <select
              value={form.subjectId || ''}
              onChange={(event) => setForm({ ...form, subjectId: event.target.value })}
            >
              <option value="">-- Chọn môn --</option>
              {data.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} - {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Lớp hành chính
            <select
              value={form.classId || ''}
              onChange={(event) => setForm({ ...form, classId: event.target.value })}
            >
              <option value="">-- Chọn lớp --</option>
              {data.classes.map((studentClass) => (
                <option key={studentClass.id} value={studentClass.id}>
                  {studentClass.code} - {studentClass.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Giảng viên
            <select
              value={form.lecturerId || ''}
              onChange={(event) => setForm({ ...form, lecturerId: event.target.value })}
            >
              <option value="">-- Chọn giảng viên --</option>
              {data.lecturers.map((lecturer) => (
                <option key={lecturer.id} value={lecturer.id}>
                  {lecturer.code} - {lecturer.fullName}
                </option>
              ))}
            </select>
          </label>

          <label>
            Học kỳ
            <select
              value={form.semesterId || ''}
              onChange={(event) => setForm({ ...form, semesterId: event.target.value })}
            >
              <option value="">-- Chọn học kỳ --</option>
              {data.semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name} - {semester.academicYear}
                </option>
              ))}
            </select>
          </label>

          <label>
            Phòng học
            <input
              value={form.room || ''}
              onChange={(event) => setForm({ ...form, room: event.target.value })}
            />
          </label>

          <label>
            Thứ
            <select
              value={form.weekday}
              onChange={(event) => setForm({ ...form, weekday: event.target.value })}
            >
              {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Ca học
            <select
              value={form.shift}
              onChange={(event) => setForm({ ...form, shift: event.target.value })}
            >
              {Object.entries(SHIFT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Sĩ số tối đa
            <input
              type="number"
              min="1"
              value={form.capacity}
              onChange={(event) => setForm({ ...form, capacity: event.target.value })}
            />
          </label>

          <label>
            Trạng thái
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          {formError ? (
            <div className="form-alert form-alert-error full">{formError}</div>
          ) : null}

          <div className="form-actions full">
            <button
              type="button"
              className="btn btn-light"
              onClick={() => setEditing(undefined)}
            >
              Hủy
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu lớp học phần'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
