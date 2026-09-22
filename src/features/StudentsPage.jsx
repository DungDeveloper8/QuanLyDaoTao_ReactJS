import { useEffect, useMemo, useState } from 'react'
import { createOne, getAllData, removeOne, updateOne } from '../core/api/apiClient.js'
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx'
import Modal from '../shared/components/Modal.jsx'
import ExcelExportButton, { ExcelImportButton } from '../shared/components/ExcelExportButton.jsx'
import PageHeader from '../shared/components/PageHeader.jsx'
import Pagination from '../shared/components/Pagination.jsx'
import StatusBadge from '../shared/components/StatusBadge.jsx'
import { formatDate } from '../shared/utils/date.js'
import { getExcelValue, normalizeExcelDate } from '../shared/utils/exportExcel.js'

const PAGE_SIZE = 10

const STUDENT_EXCEL_COLUMNS = [
  { label: 'Mã sinh viên', value: 'code', width: 95 },
  { label: 'Họ và tên', value: 'fullName', width: 170 },
  { label: 'Giới tính', value: 'gender', width: 80 },
  { label: 'Ngày sinh', value: 'birthDate', width: 95 },
  { label: 'Mã lớp', value: 'classCode', width: 120 },
  { label: 'Email', value: 'email', width: 190 },
  { label: 'Số điện thoại', value: 'phone', width: 110 },
  { label: 'Địa chỉ', value: 'address', width: 150 },
  { label: 'Trạng thái', value: 'status', width: 100 },
]

const STUDENT_EXCEL_HEADERS = {
  code: ['Mã sinh viên', 'Mã SV', 'studentCode', 'code'],
  fullName: ['Họ và tên', 'Họ tên', 'fullName', 'name'],
  gender: ['Giới tính', 'gender'],
  birthDate: ['Ngày sinh', 'birthDate'],
  classCode: ['Mã lớp', 'Lớp', 'classCode'],
  email: ['Email'],
  phone: ['Số điện thoại', 'Điện thoại', 'phone'],
  address: ['Địa chỉ', 'address'],
  status: ['Trạng thái', 'status'],
}

const STUDENT_EXCEL_TEMPLATE = [{
  code: 'SV004',
  fullName: 'Nguyễn Văn Mẫu',
  gender: 'Nam',
  birthDate: '2006-10-15',
  classCode: 'CNTT-LTM-K16A',
  email: 'sv004@sv.bachkhoa.edu.vn',
  phone: '0912000004',
  address: 'Hà Nội',
  status: 'Đang học',
}]

function normalizeGender(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['nam', 'male', 'm'].includes(normalized)) return 'male';
  if (['nữ', 'nu', 'female', 'f'].includes(normalized)) return 'female';
  if (['khác', 'khac', 'other'].includes(normalized)) return 'other';
  return '';
}

function normalizeStudentStatus(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['đang học', 'dang hoc', 'studying', 'active'].includes(normalized)) return 'studying';
  if (['bảo lưu', 'bao luu', 'reserved'].includes(normalized)) return 'reserved';
  if (['thôi học', 'thoi hoc', 'dropped', 'inactive'].includes(normalized)) return 'dropped';
  return '';
}

function genderLabel(gender) {
  if (gender === 'female') return 'Nữ';
  if (gender === 'other') return 'Khác';
  return 'Nam';
}

const emptyForm = {
  code: '',
  fullName: '',
  gender: 'male',
  birthDate: '',
  classId: '',
  email: '',
  phone: '',
  address: '',
  status: 'studying',
}


function initialStudentPassword(code) {
  return `${String(code || '').trim().toLowerCase()}123`;
}

function getStudentStatusLabel(status) {
  if (status === 'studying') {
    return 'Đang học'
  }

  if (status === 'reserved') {
    return 'Bảo lưu'
  }

  return 'Thôi học'
}

export default function StudentsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [facultyId, setFacultyId] = useState('all')
  const [majorId, setMajorId] = useState('all')
  const [cohortId, setCohortId] = useState('all')
  const [sortBy, setSortBy] = useState('code')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(undefined)
  const [viewing, setViewing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    setError('')

    try {
      const snapshot = await getAllData()

      setData({
        students: snapshot.students,
        classes: snapshot.classes,
        majors: snapshot.majors,
        faculties: snapshot.faculties,
        cohorts: snapshot.cohorts,
        users: snapshot.users,
        registrations: snapshot.registrations,
        scores: snapshot.scores,
      })
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
  }, [query, facultyId, majorId, cohortId, sortBy])

  const filteredStudents = useMemo(() => {
    if (!data) {
      return []
    }

    const keyword = query.trim().toLowerCase()

    return data.students
      .filter((student) => {
        const studentClass = data.classes.find(
          (item) => Number(item.id) === Number(student.classId),
        )
        const major = data.majors.find(
          (item) => Number(item.id) === Number(studentClass?.majorId),
        )
        const matchesKeyword =
          !keyword ||
          student.code.toLowerCase().includes(keyword) ||
          student.fullName.toLowerCase().includes(keyword)
        const matchesFaculty =
          facultyId === 'all' || Number(major?.facultyId) === Number(facultyId)
        const matchesMajor =
          majorId === 'all' || Number(studentClass?.majorId) === Number(majorId)
        const matchesCohort =
          cohortId === 'all' || Number(studentClass?.cohortId) === Number(cohortId)

        return matchesKeyword && matchesFaculty && matchesMajor && matchesCohort
      })
      .sort((first, second) => {
        if (sortBy === 'name') {
          return first.fullName.localeCompare(second.fullName, 'vi')
        }

        if (sortBy === 'class') {
          const firstClass = data.classes.find(
            (item) => Number(item.id) === Number(first.classId),
          )?.code || ''
          const secondClass = data.classes.find(
            (item) => Number(item.id) === Number(second.classId),
          )?.code || ''

          return firstClass.localeCompare(secondClass, 'vi')
        }

        return first.code.localeCompare(second.code, 'vi', { numeric: true })
      })
  }, [data, query, facultyId, majorId, cohortId, sortBy])

  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE))
  const pagedStudents = filteredStudents.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )
  const majorOptions = data.majors.filter(
    (major) => facultyId === 'all' || Number(major.facultyId) === Number(facultyId),
  )

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setFieldErrors({})
  }

  function openEdit(student) {
    setEditing(student)
    setForm({
      ...student,
      classId: String(student.classId),
    })
    setFormError('')
    setFieldErrors({})
  }

  function updateFormField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => ({ ...current, [name]: '' }))
  }

  function validateForm() {
    const errors = {}

    if (!form.code.trim()) errors.code = 'Vui lòng nhập mã sinh viên.'
    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.'
    if (!form.classId) errors.classId = 'Vui lòng chọn lớp.'
    if (!form.birthDate) errors.birthDate = 'Vui lòng chọn ngày sinh.'
    if (!form.email.trim()) {
      errors.email = 'Vui lòng nhập email.'
    } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      errors.email = 'Email không đúng định dạng.'
    }

    const duplicatedCode = data.students.some(
      (item) =>
        item.id !== editing?.id &&
        item.code.toLowerCase() === form.code.trim().toLowerCase(),
    )

    if (duplicatedCode) errors.code = 'Mã sinh viên đã tồn tại.'
    return errors
  }

  async function saveStudent(event) {
    event.preventDefault()
    setFormError('')

    const errors = validateForm()
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      setFormError('Vui lòng kiểm tra các trường được đánh dấu.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        classId: Number(form.classId),
      }

      if (editing) {
        await updateOne('students', editing.id, {
          ...editing,
          ...payload,
        })

        const user = data.users.find(
          (item) => Number(item.studentId) === Number(editing.id),
        )

        if (user) {
          await updateOne('users', user.id, {
            ...user,
            fullName: payload.fullName,
          })
        }
      } else {
        const response = await createOne('students', payload)
        const username = payload.code.toLowerCase()
        const usernameExists = data.users.some(
          (item) => item.username.toLowerCase() === username,
        )

        if (!usernameExists) {
          await createOne('users', {
            username,
            password: initialStudentPassword(payload.code),
            fullName: payload.fullName,
            role: 'student',
            studentId: response.data.id,
            active: true,
          })
        }
      }

      setEditing(undefined)
      await load()
    } catch (requestError) {
      setFormError(requestError.message || 'Không thể lưu sinh viên.')
    } finally {
      setSaving(false)
    }
  }

  async function importStudents(rows) {
    setNotice('')
    if (!rows.length) throw new Error('Tệp Excel không có dữ liệu sinh viên.')

    const classByCode = new Map(
      data.classes.map((item) => [item.code.trim().toUpperCase(), item]),
    )
    const existingByCode = new Map(
      data.students.map((item) => [item.code.trim().toUpperCase(), item]),
    )
    const seenCodes = new Set()

    const candidates = rows.map((row, index) => {
      const rowNumber = index + 2
      const code = String(getExcelValue(row, STUDENT_EXCEL_HEADERS.code) || '').trim().toUpperCase()
      const fullName = String(getExcelValue(row, STUDENT_EXCEL_HEADERS.fullName) || '').trim()
      const classCode = String(getExcelValue(row, STUDENT_EXCEL_HEADERS.classCode) || '').trim().toUpperCase()
      const email = String(getExcelValue(row, STUDENT_EXCEL_HEADERS.email) || '').trim()
      const birthDate = normalizeExcelDate(getExcelValue(row, STUDENT_EXCEL_HEADERS.birthDate))
      const gender = normalizeGender(getExcelValue(row, STUDENT_EXCEL_HEADERS.gender) || 'Nam')
      const status = normalizeStudentStatus(getExcelValue(row, STUDENT_EXCEL_HEADERS.status) || 'Đang học')
      const phone = String(getExcelValue(row, STUDENT_EXCEL_HEADERS.phone) || '').trim()
      const address = String(getExcelValue(row, STUDENT_EXCEL_HEADERS.address) || '').trim()

      if (!code || !fullName || !classCode || !email || !birthDate) {
        throw new Error(`Dòng ${rowNumber}: mã SV, họ tên, ngày sinh, mã lớp và email là bắt buộc.`)
      }
      if (seenCodes.has(code)) throw new Error(`Dòng ${rowNumber}: mã sinh viên ${code} bị lặp trong tệp.`)
      seenCodes.add(code)
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error(`Dòng ${rowNumber}: email không đúng định dạng.`)
      if (!gender) throw new Error(`Dòng ${rowNumber}: giới tính chỉ nhận Nam/Nữ/Khác.`)
      if (!status) throw new Error(`Dòng ${rowNumber}: trạng thái chỉ nhận Đang học/Bảo lưu/Thôi học.`)

      const classItem = classByCode.get(classCode)
      if (!classItem) throw new Error(`Dòng ${rowNumber}: không tìm thấy lớp ${classCode}.`)

      return {
        existing: existingByCode.get(code),
        rowNumber,
        payload: {
          code,
          fullName,
          gender,
          birthDate,
          classId: Number(classItem.id),
          email,
          phone,
          address,
          status,
        },
      }
    })

    setImporting(true)
    try {
      const usernames = new Set(data.users.map((item) => item.username.toLowerCase()))
      let created = 0
      let updated = 0

      for (const candidate of candidates) {
        if (candidate.existing) {
          await updateOne('students', candidate.existing.id, {
            ...candidate.existing,
            ...candidate.payload,
          })
          const linkedUser = data.users.find(
            (item) => Number(item.studentId) === Number(candidate.existing.id),
          )
          if (linkedUser) {
            await updateOne('users', linkedUser.id, {
              ...linkedUser,
              fullName: candidate.payload.fullName,
            })
          }
          updated += 1
          continue
        }

        const response = await createOne('students', candidate.payload)
        const username = candidate.payload.code.toLowerCase()
        if (!usernames.has(username)) {
          await createOne('users', {
            username,
            password: initialStudentPassword(candidate.payload.code),
            fullName: candidate.payload.fullName,
            role: 'student',
            studentId: response.data.id,
            active: true,
          })
          usernames.add(username)
        }
        created += 1
      }

      await load()
      setPage(1)
      setNotice(`Đã nhập ${candidates.length} sinh viên từ Excel: ${created} thêm mới, ${updated} cập nhật.`)
    } finally {
      setImporting(false)
    }
  }

  async function removeStudent(student) {
    const hasRegistration = data.registrations.some(
      (item) => Number(item.studentId) === Number(student.id),
    )
    const hasScore = data.scores.some(
      (item) => Number(item.studentId) === Number(student.id),
    )

    if (hasRegistration || hasScore) {
      window.alert(
        'Không thể xóa sinh viên đã phát sinh đăng ký học phần hoặc điểm. Hãy chuyển trạng thái thôi học/bảo lưu.',
      )
      return
    }

    if (!window.confirm(`Xóa sinh viên ${student.code} - ${student.fullName}?`)) {
      return
    }

    const user = data.users.find(
      (item) => Number(item.studentId) === Number(student.id),
    )

    if (user) {
      await removeOne('users', user.id)
    }

    await removeOne('students', student.id)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Quản lý sinh viên"
        description="Danh sách và hồ sơ sinh viên."
        actions={(
          <div className="page-actions">
            <ExcelExportButton
              fileName="mau-nhap-sinh-vien.xls"
              sheetName="Mau nhap sinh vien"
              rows={STUDENT_EXCEL_TEMPLATE}
              columns={STUDENT_EXCEL_COLUMNS}
            >
              Tải mẫu Excel
            </ExcelExportButton>
            <ExcelImportButton
              onImport={importStudents}
              disabled={importing || saving}
              title="Nhập sinh viên từ Excel; mã SV đã có sẽ được cập nhật"
            >
              {importing ? 'Đang nhập...' : 'Nhập Excel'}
            </ExcelImportButton>
            <ExcelExportButton
              fileName="danh-sach-sinh-vien.xls"
              sheetName="Sinh vien"
              rows={filteredStudents.map((student) => ({
                ...student,
                gender: genderLabel(student.gender),
                classCode: data.classes.find(
                  (item) => Number(item.id) === Number(student.classId),
                )?.code || '',
                status: getStudentStatusLabel(student.status),
              }))}
              columns={STUDENT_EXCEL_COLUMNS}
            />
            <button className="btn btn-primary" onClick={openCreate}>
              + Thêm sinh viên
            </button>
          </div>
        )}
      />

      {notice ? <div className="form-alert page-notice" role="status">{notice}</div> : null}

      <div className="filter-bar">
        <input
          placeholder="Tìm theo mã hoặc họ tên..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          value={facultyId}
          onChange={(event) => {
            setFacultyId(event.target.value)
            setMajorId('all')
          }}
        >
          <option value="all">Tất cả khoa</option>
          {data.faculties.map((faculty) => (
            <option key={faculty.id} value={faculty.id}>
              {faculty.name}
            </option>
          ))}
        </select>

        <select value={majorId} onChange={(event) => setMajorId(event.target.value)}>
          <option value="all">Tất cả ngành</option>
          {majorOptions.map((major) => (
            <option key={major.id} value={major.id}>
              {major.name}
            </option>
          ))}
        </select>

        <select value={cohortId} onChange={(event) => setCohortId(event.target.value)}>
          <option value="all">Tất cả khóa</option>
          {data.cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </select>

        <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="code">Sắp xếp: Mã SV</option>
          <option value="name">Sắp xếp: Họ tên</option>
          <option value="class">Sắp xếp: Lớp</option>
        </select>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã SV</th>
              <th>Họ tên</th>
              <th>Lớp</th>
              <th>Ngành</th>
              <th>Email</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedStudents.map((student) => {
              const studentClass = data.classes.find(
                (item) => Number(item.id) === Number(student.classId),
              )
              const major = data.majors.find(
                (item) => Number(item.id) === Number(studentClass?.majorId),
              )

              return (
                <tr key={student.id}>
                  <td>
                    <strong>{student.code}</strong>
                  </td>
                  <td>{student.fullName}</td>
                  <td>{studentClass?.code || '—'}</td>
                  <td>{major?.name || '—'}</td>
                  <td>{student.email}</td>
                  <td>
                    <StatusBadge tone={student.status === 'studying' ? 'success' : 'warning'}>
                      {getStudentStatusLabel(student.status)}
                    </StatusBadge>
                  </td>
                  <td className="action-cell">
                    <button
                      className="btn btn-light btn-xs"
                      onClick={() => setViewing(student)}
                    >
                      Hồ sơ
                    </button>
                    <button
                      className="btn btn-light btn-xs"
                      onClick={() => openEdit(student)}
                    >
                      Sửa
                    </button>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => removeStudent(student)}
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
        title={editing ? 'Cập nhật sinh viên' : 'Thêm sinh viên'}
        onClose={() => setEditing(undefined)}
      >
        <form className="form-grid" onSubmit={saveStudent}>
          <label>
            Mã sinh viên
            <input
              value={form.code}
              onChange={(event) => updateFormField('code', event.target.value)}
              aria-invalid={Boolean(fieldErrors.code)}
            />
            {fieldErrors.code ? <span className="field-error">{fieldErrors.code}</span> : null}
          </label>

          <label>
            Họ và tên
            <input
              value={form.fullName}
              onChange={(event) => updateFormField('fullName', event.target.value)}
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
            {fieldErrors.fullName ? <span className="field-error">{fieldErrors.fullName}</span> : null}
          </label>

          <label>
            Giới tính
            <select
              value={form.gender}
              onChange={(event) => setForm({ ...form, gender: event.target.value })}
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </label>

          <label>
            Ngày sinh
            <input
              type="date"
              value={form.birthDate}
              onChange={(event) => updateFormField('birthDate', event.target.value)}
              aria-invalid={Boolean(fieldErrors.birthDate)}
            />
            {fieldErrors.birthDate ? <span className="field-error">{fieldErrors.birthDate}</span> : null}
          </label>

          <label>
            Lớp
            <select
              value={form.classId}
              onChange={(event) => updateFormField('classId', event.target.value)}
              aria-invalid={Boolean(fieldErrors.classId)}
            >
              <option value="">-- Chọn lớp --</option>
              {data.classes.map((studentClass) => (
                <option key={studentClass.id} value={studentClass.id}>
                  {studentClass.code} - {studentClass.name}
                </option>
              ))}
            </select>
            {fieldErrors.classId ? <span className="field-error">{fieldErrors.classId}</span> : null}
          </label>

          <label>
            Trạng thái
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              <option value="studying">Đang học</option>
              <option value="reserved">Bảo lưu</option>
              <option value="dropped">Thôi học</option>
            </select>
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateFormField('email', event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email ? <span className="field-error">{fieldErrors.email}</span> : null}
          </label>

          <label>
            Số điện thoại
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </label>

          <label className="full">
            Địa chỉ
            <input
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
          </label>

          {!editing ? (
            <div className="form-note full">
              Tài khoản sinh viên được tạo tự động theo mã sinh viên viết thường. Mật khẩu khởi tạo theo mẫu BK@MÃSV-2026! và được lưu dạng băm trên máy chủ.
            </div>
          ) : null}

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
              {saving ? 'Đang lưu...' : 'Lưu sinh viên'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title="Hồ sơ sinh viên"
        onClose={() => setViewing(null)}
      >
        {viewing ? (
          <div className="detail-grid">
            <div>
              <span>Mã sinh viên</span>
              <strong>{viewing.code}</strong>
            </div>
            <div>
              <span>Họ tên</span>
              <strong>{viewing.fullName}</strong>
            </div>
            <div>
              <span>Ngày sinh</span>
              <strong>{formatDate(viewing.birthDate)}</strong>
            </div>
            <div>
              <span>Lớp</span>
              <strong>
                {data.classes.find(
                  (item) => Number(item.id) === Number(viewing.classId),
                )?.name || '—'}
              </strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{viewing.email}</strong>
            </div>
            <div>
              <span>Điện thoại</span>
              <strong>{viewing.phone || '—'}</strong>
            </div>
            <div className="full">
              <span>Địa chỉ</span>
              <strong>{viewing.address || '—'}</strong>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
