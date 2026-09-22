import { useEffect, useMemo, useState } from 'react'
import { createOne, getAllData, removeOne, updateOne } from '../core/api/apiClient.js'
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx'
import Modal from '../shared/components/Modal.jsx'
import ExcelExportButton, { ExcelImportButton } from '../shared/components/ExcelExportButton.jsx'
import PageHeader from '../shared/components/PageHeader.jsx'
import Pagination from '../shared/components/Pagination.jsx'
import StatusBadge from '../shared/components/StatusBadge.jsx'
import {
  getPrerequisiteCyclePath,
  prerequisiteWouldCreateCycle,
} from '../shared/utils/trainingRules.js'
import { getExcelNumber, getExcelValue } from '../shared/utils/exportExcel.js'

const PAGE_SIZE = 8

const SUBJECT_EXCEL_COLUMNS = [
  { label: 'Mã môn', value: 'code', width: 90 },
  { label: 'Tên môn học', value: 'name', width: 210 },
  { label: 'Tín chỉ', value: 'credits', type: 'Number', width: 70 },
  { label: 'Giờ lý thuyết', value: 'theoryHours', type: 'Number', width: 90 },
  { label: 'Giờ thực hành', value: 'practiceHours', type: 'Number', width: 90 },
  { label: 'Môn tiên quyết', value: 'prerequisites', width: 130 },
  { label: 'Điểm chuyên cần (%)', value: 'attendanceWeight', type: 'Number', width: 105 },
  { label: 'Điểm giữa kỳ (%)', value: 'midtermWeight', type: 'Number', width: 100 },
  { label: 'Điểm cuối kỳ (%)', value: 'finalWeight', type: 'Number', width: 100 },
  { label: 'Vắng tối đa (%)', value: 'maxAbsenceRate', type: 'Number', width: 100 },
]

const SUBJECT_EXCEL_HEADERS = {
  code: ['Mã môn', 'Ma mon', 'code'],
  name: ['Tên môn học', 'Ten mon hoc', 'Tên môn', 'name'],
  credits: ['Tín chỉ', 'Tin chi', 'credits'],
  theoryHours: ['Giờ lý thuyết', 'Gio ly thuyet', 'theoryHours'],
  practiceHours: ['Giờ thực hành', 'Gio thuc hanh', 'practiceHours'],
  prerequisites: ['Môn tiên quyết', 'Mon tien quyet', 'prerequisites'],
  attendanceWeight: ['Điểm chuyên cần (%)', 'Diem chuyen can (%)', 'attendanceWeight'],
  midtermWeight: ['Điểm giữa kỳ (%)', 'Diem giua ky (%)', 'midtermWeight'],
  finalWeight: ['Điểm cuối kỳ (%)', 'Diem cuoi ky (%)', 'finalWeight'],
  maxAbsenceRate: ['Vắng tối đa (%)', 'Vang toi da (%)', 'maxAbsenceRate'],
}

function prerequisiteCodes(value) {
  return String(value || '')
    .split(/[,;|]/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

const emptySubject = {
  code: '',
  name: '',
  credits: 3,
  theoryHours: 30,
  practiceHours: 15,
  prerequisiteIds: [],
  attendanceWeight: 10,
  midtermWeight: 30,
  finalWeight: 60,
  maxAbsenceRate: 20,
}

const emptyCurriculum = {
  name: '',
  majorId: '',
  version: '2026',
  active: true,
  subjectIds: [],
}

export default function SubjectsCurriculaPage() {
  const [tab, setTab] = useState('subjects')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(undefined)
  const [form, setForm] = useState(emptySubject)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState(null)

  async function load() {
    setLoading(true)
    setError('')

    try {
      const snapshot = await getAllData()

      setData({
        subjects: snapshot.subjects,
        curricula: snapshot.curricula,
        majors: snapshot.majors,
        courseSections: snapshot.courseSections,
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
    setQuery('')
    setPage(1)
    setEditing(undefined)
    setNotice(null)
  }, [tab])

  const items = tab === 'subjects' ? data?.subjects || [] : data?.curricula || []

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    if (!keyword) {
      return items
    }

    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(keyword))
  }, [items, query])

  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const pagedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openCreate() {
    setEditing(null)
    setForm(tab === 'subjects' ? emptySubject : emptyCurriculum)
    setFormError('')
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      ...item,
      majorId: item.majorId != null ? String(item.majorId) : item.majorId,
    })
    setFormError('')
  }

  function toggleArrayValue(name, id) {
    const currentValues = (form[name] || []).map(Number)
    const numericId = Number(id)
    const nextValues = currentValues.includes(numericId)
      ? currentValues.filter((value) => value !== numericId)
      : [...currentValues, numericId]

    setForm({
      ...form,
      [name]: nextValues,
    })
  }

  function validateSubject(payload) {
    if (!payload.code.trim() || !payload.name.trim() || payload.credits <= 0) {
      return 'Mã môn, tên môn và số tín chỉ hợp lệ là bắt buộc.'
    }

    if (payload.theoryHours < 0 || payload.practiceHours < 0) {
      return 'Số giờ lý thuyết/thực hành không được âm.'
    }

    if (payload.attendanceWeight + payload.midtermWeight + payload.finalWeight !== 100) {
      return 'Tổng trọng số điểm phải bằng 100%.'
    }

    if (payload.maxAbsenceRate < 0 || payload.maxAbsenceRate > 100) {
      return 'Tỷ lệ vắng tối đa phải trong khoảng 0–100%.'
    }

    const duplicatedCode = data.subjects.some(
      (item) =>
        item.id !== editing?.id &&
        item.code.toLowerCase() === payload.code.toLowerCase(),
    )

    if (duplicatedCode) {
      return 'Mã môn học đã tồn tại.'
    }

    if (payload.prerequisiteIds.includes(Number(editing?.id))) {
      return 'Môn học không thể là tiên quyết của chính nó.'
    }

    if (editing?.id) {
      const cyclePath = getPrerequisiteCyclePath(
        editing.id,
        payload.prerequisiteIds,
        data.subjects,
      )

      if (cyclePath) {
        const codeById = new Map(data.subjects.map((subject) => [Number(subject.id), subject.code]))
        const cycleLabel = cyclePath
          .map((id) => codeById.get(Number(id)) || `#${id}`)
          .join(' → ')
        return `Quan hệ môn tiên quyết tạo vòng lặp: ${cycleLabel}. Hãy bỏ môn gây vòng.`
      }
    }

    return ''
  }

  function validateCurriculum(payload) {
    if (!payload.name.trim() || !payload.majorId || !payload.version.trim()) {
      return 'Tên chương trình, ngành và phiên bản là bắt buộc.'
    }

    if (!payload.subjectIds.length) {
      return 'Chương trình đào tạo phải có ít nhất một môn học.'
    }

    const duplicatedVersion = data.curricula.some(
      (item) =>
        item.id !== editing?.id &&
        Number(item.majorId) === Number(payload.majorId) &&
        item.version === payload.version,
    )

    if (duplicatedVersion) {
      return 'Ngành này đã có chương trình cùng phiên bản.'
    }

    const anotherActiveCurriculum = data.curricula.some(
      (item) =>
        item.id !== editing?.id &&
        Number(item.majorId) === Number(payload.majorId) &&
        item.active,
    )

    if (payload.active && anotherActiveCurriculum) {
      return 'Mỗi ngành chỉ được có một chương trình đào tạo đang áp dụng.'
    }

    return ''
  }

  function buildPayload() {
    if (tab === 'subjects') {
      return {
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        credits: Number(form.credits),
        theoryHours: Number(form.theoryHours),
        practiceHours: Number(form.practiceHours),
        prerequisiteIds: (form.prerequisiteIds || []).map(Number),
        attendanceWeight: Number(form.attendanceWeight),
        midtermWeight: Number(form.midtermWeight),
        finalWeight: Number(form.finalWeight),
        maxAbsenceRate: Number(form.maxAbsenceRate),
      }
    }

    return {
      ...form,
      name: form.name.trim(),
      majorId: Number(form.majorId),
      version: form.version.trim(),
      active: Boolean(form.active),
      subjectIds: (form.subjectIds || []).map(Number),
    }
  }

  async function save(event) {
    event.preventDefault()
    setFormError('')

    const payload = buildPayload()
    const message = tab === 'subjects'
      ? validateSubject(payload)
      : validateCurriculum(payload)

    if (message) {
      setFormError(message)
      return
    }

    setSaving(true)

    try {
      const resource = tab === 'subjects' ? 'subjects' : 'curricula'

      if (editing) {
        await updateOne(resource, editing.id, {
          ...editing,
          ...payload,
        })
      } else {
        await createOne(resource, payload)
      }

      setEditing(undefined)
      await load()
    } catch (requestError) {
      setFormError(requestError.message || 'Không thể lưu dữ liệu.')
    } finally {
      setSaving(false)
    }
  }

  async function importSubjects(rows) {
    setNotice(null)

    if (!rows.length) {
      throw new Error('Tệp Excel không có dữ liệu môn học.')
    }

    const existingByCode = new Map(
      data.subjects.map((subject) => [subject.code.trim().toUpperCase(), subject]),
    )
    const seenCodes = new Set()
    let nextTemporaryId = -1

    const candidates = rows.map((row, index) => {
      const rowNumber = index + 2
      const code = String(getExcelValue(row, SUBJECT_EXCEL_HEADERS.code) || '').trim().toUpperCase()
      const name = String(getExcelValue(row, SUBJECT_EXCEL_HEADERS.name) || '').trim()

      if (!code || !name) {
        throw new Error(`Dòng ${rowNumber}: mã môn và tên môn là bắt buộc.`)
      }
      if (seenCodes.has(code)) {
        throw new Error(`Dòng ${rowNumber}: mã môn ${code} bị lặp trong tệp.`)
      }
      seenCodes.add(code)

      const existing = existingByCode.get(code)
      const fallback = existing || emptySubject
      const candidate = {
        id: existing?.id ?? nextTemporaryId--,
        existing,
        rowNumber,
        code,
        name,
        credits: getExcelNumber(row, SUBJECT_EXCEL_HEADERS.credits, fallback.credits),
        theoryHours: getExcelNumber(row, SUBJECT_EXCEL_HEADERS.theoryHours, fallback.theoryHours),
        practiceHours: getExcelNumber(row, SUBJECT_EXCEL_HEADERS.practiceHours, fallback.practiceHours),
        attendanceWeight: getExcelNumber(row, SUBJECT_EXCEL_HEADERS.attendanceWeight, fallback.attendanceWeight),
        midtermWeight: getExcelNumber(row, SUBJECT_EXCEL_HEADERS.midtermWeight, fallback.midtermWeight),
        finalWeight: getExcelNumber(row, SUBJECT_EXCEL_HEADERS.finalWeight, fallback.finalWeight),
        maxAbsenceRate: getExcelNumber(row, SUBJECT_EXCEL_HEADERS.maxAbsenceRate, fallback.maxAbsenceRate),
        prerequisiteCodes: prerequisiteCodes(getExcelValue(row, SUBJECT_EXCEL_HEADERS.prerequisites)),
        prerequisiteIds: [],
      }

      const numericValues = [
        candidate.credits,
        candidate.theoryHours,
        candidate.practiceHours,
        candidate.attendanceWeight,
        candidate.midtermWeight,
        candidate.finalWeight,
        candidate.maxAbsenceRate,
      ]
      if (numericValues.some((value) => !Number.isFinite(value))) {
        throw new Error(`Dòng ${rowNumber}: có giá trị số không hợp lệ.`)
      }
      if (candidate.credits <= 0 || candidate.theoryHours < 0 || candidate.practiceHours < 0) {
        throw new Error(`Dòng ${rowNumber}: tín chỉ/giờ học không hợp lệ.`)
      }
      if (candidate.attendanceWeight + candidate.midtermWeight + candidate.finalWeight !== 100) {
        throw new Error(`Dòng ${rowNumber}: tổng trọng số điểm phải bằng 100%.`)
      }
      if (candidate.maxAbsenceRate < 0 || candidate.maxAbsenceRate > 100) {
        throw new Error(`Dòng ${rowNumber}: vắng tối đa phải trong khoảng 0–100%.`)
      }

      return candidate
    })

    const idByCode = new Map(data.subjects.map((subject) => [subject.code.toUpperCase(), Number(subject.id)]))
    candidates.forEach((candidate) => idByCode.set(candidate.code, Number(candidate.id)))

    for (const candidate of candidates) {
      candidate.prerequisiteIds = candidate.prerequisiteCodes.map((code) => {
        const id = idByCode.get(code)
        if (id == null) {
          throw new Error(`Dòng ${candidate.rowNumber}: không tìm thấy môn tiên quyết ${code}.`)
        }
        if (Number(id) === Number(candidate.id)) {
          throw new Error(`Dòng ${candidate.rowNumber}: môn ${candidate.code} không thể tiên quyết cho chính nó.`)
        }
        return Number(id)
      })
    }

    const importedCodes = new Set(candidates.map((candidate) => candidate.code))
    const mergedSubjects = [
      ...data.subjects.filter((subject) => !importedCodes.has(subject.code.toUpperCase())),
      ...candidates.map(({ existing, rowNumber, prerequisiteCodes: codes, ...subject }) => subject),
    ]
    const codeById = new Map(mergedSubjects.map((subject) => [Number(subject.id), subject.code]))

    for (const candidate of candidates) {
      const cyclePath = getPrerequisiteCyclePath(candidate.id, candidate.prerequisiteIds, mergedSubjects)
      if (cyclePath) {
        const label = cyclePath
          .map((id) => codeById.get(Number(id)) || `#${id}`)
          .join(' → ')
        throw new Error(`Dòng ${candidate.rowNumber}: môn tiên quyết tạo vòng lặp ${label}.`)
      }
    }

    setImporting(true)
    try {
      const realIdByCode = new Map(
        data.subjects.map((subject) => [subject.code.toUpperCase(), Number(subject.id)]),
      )

      for (const candidate of candidates) {
        if (candidate.existing) continue
        const response = await createOne('subjects', {
          code: candidate.code,
          name: candidate.name,
          credits: candidate.credits,
          theoryHours: candidate.theoryHours,
          practiceHours: candidate.practiceHours,
          prerequisiteIds: [],
          attendanceWeight: candidate.attendanceWeight,
          midtermWeight: candidate.midtermWeight,
          finalWeight: candidate.finalWeight,
          maxAbsenceRate: candidate.maxAbsenceRate,
        })
        realIdByCode.set(candidate.code, Number(response.data.id))
      }

      for (const candidate of candidates) {
        const realId = realIdByCode.get(candidate.code)
        const resolvedPrerequisites = candidate.prerequisiteCodes.map((code) => realIdByCode.get(code))
        const payload = {
          ...(candidate.existing || {}),
          code: candidate.code,
          name: candidate.name,
          credits: candidate.credits,
          theoryHours: candidate.theoryHours,
          practiceHours: candidate.practiceHours,
          prerequisiteIds: resolvedPrerequisites,
          attendanceWeight: candidate.attendanceWeight,
          midtermWeight: candidate.midtermWeight,
          finalWeight: candidate.finalWeight,
          maxAbsenceRate: candidate.maxAbsenceRate,
        }
        await updateOne('subjects', realId, payload)
      }

      await load()
      setPage(1)
      setNotice({
        tone: 'success',
        text: `Đã nhập ${candidates.length} môn học từ Excel (${candidates.filter((item) => item.existing).length} cập nhật, ${candidates.filter((item) => !item.existing).length} thêm mới).`,
      })
    } finally {
      setImporting(false)
    }
  }

  async function remove(item) {
    if (tab === 'subjects') {
      const hasCourseSection = data.courseSections.some(
        (section) => Number(section.subjectId) === Number(item.id),
      )
      const belongsToCurriculum = data.curricula.some((curriculum) =>
        (curriculum.subjectIds || []).map(Number).includes(Number(item.id)),
      )
      const isPrerequisite = data.subjects.some((subject) =>
        (subject.prerequisiteIds || []).map(Number).includes(Number(item.id)),
      )

      if (hasCourseSection) {
        window.alert('Không thể xóa môn đã có lớp học phần.')
        return
      }

      if (belongsToCurriculum) {
        window.alert('Không thể xóa môn đang thuộc chương trình đào tạo.')
        return
      }

      if (isPrerequisite) {
        window.alert('Không thể xóa môn đang là môn tiên quyết của môn khác.')
        return
      }
    }

    if (!window.confirm(`Xóa ${item.name}?`)) {
      return
    }

    await removeOne(tab === 'subjects' ? 'subjects' : 'curricula', item.id)
    await load()
  }

  return (
    <div>
      <PageHeader
        title="Môn học & Chương trình đào tạo"
        description="Danh mục môn học và chương trình đào tạo."
        actions={(
          <div className="page-actions">
            {tab === 'subjects' ? (
              <>
                <ExcelExportButton
                  fileName="mau-nhap-mon-hoc.xls"
                  sheetName="Mau nhap mon hoc"
                  rows={[{
                    code: 'WEB102',
                    name: 'Thiết kế giao diện Responsive',
                    credits: 3,
                    theoryHours: 30,
                    practiceHours: 30,
                    prerequisites: 'WEB101',
                    attendanceWeight: 10,
                    midtermWeight: 30,
                    finalWeight: 60,
                    maxAbsenceRate: 20,
                  }]}
                  columns={SUBJECT_EXCEL_COLUMNS}
                >
                  Tải mẫu Excel
                </ExcelExportButton>
                <ExcelImportButton
                  onImport={importSubjects}
                  disabled={importing || saving}
                  title="Nhập danh sách môn học từ Excel; mã đã tồn tại sẽ được cập nhật"
                />
                <ExcelExportButton
                  fileName="danh-sach-mon-hoc.xls"
                  sheetName="Mon hoc"
                  rows={filteredItems.map((item) => ({
                    ...item,
                    prerequisites: (item.prerequisiteIds || [])
                      .map((id) => data.subjects.find(
                        (subject) => Number(subject.id) === Number(id),
                      )?.code)
                      .filter(Boolean)
                      .join(', '),
                  }))}
                  columns={SUBJECT_EXCEL_COLUMNS}
                />
              </>
            ) : (
              <ExcelExportButton
                fileName="chuong-trinh-dao-tao.xls"
                sheetName="Chuong trinh dao tao"
                rows={filteredItems}
                columns={[
                  { label: 'Chương trình', value: 'name', width: 220 },
                  {
                    label: 'Ngành',
                    value: (item) => data.majors.find(
                      (major) => Number(major.id) === Number(item.majorId),
                    )?.name || '',
                    width: 190,
                  },
                  { label: 'Phiên bản', value: 'version', width: 90 },
                  {
                    label: 'Số môn',
                    value: (item) => item.subjectIds?.length || 0,
                    type: 'Number',
                    width: 75,
                  },
                  {
                    label: 'Trạng thái',
                    value: (item) => item.active ? 'Đang áp dụng' : 'Ngừng áp dụng',
                    width: 110,
                  },
                ]}
              />
            )}
            <button className="btn btn-primary" type="button" onClick={openCreate}>
              + Thêm mới
            </button>
          </div>
        )}
      />

      {notice ? (
        <div className="form-alert page-notice" role="status">{notice.text}</div>
      ) : null}

      <div className="tabs">
        <button
          className={tab === 'subjects' ? 'active' : ''}
          onClick={() => setTab('subjects')}
        >
          Môn học
        </button>
        <button
          className={tab === 'curricula' ? 'active' : ''}
          onClick={() => setTab('curricula')}
        >
          Chương trình đào tạo
        </button>
      </div>

      <div className="toolbar">
        <input
          placeholder="Tìm kiếm..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="table-wrap">
        {tab === 'subjects' ? (
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Môn học</th>
                <th>Tín chỉ</th>
                <th>LT/TH</th>
                <th>Tiên quyết</th>
                <th>Trọng số</th>
                <th>Vắng tối đa</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item) => {
                const prerequisiteCodes = (item.prerequisiteIds || [])
                  .map((id) =>
                    data.subjects.find(
                      (subject) => Number(subject.id) === Number(id),
                    )?.code,
                  )
                  .filter(Boolean)
                  .join(', ')

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.code}</strong>
                    </td>
                    <td>{item.name}</td>
                    <td>{item.credits}</td>
                    <td>{item.theoryHours}/{item.practiceHours}</td>
                    <td>{prerequisiteCodes || '—'}</td>
                    <td>
                      {item.attendanceWeight}/{item.midtermWeight}/{item.finalWeight}
                    </td>
                    <td>{item.maxAbsenceRate}%</td>
                    <td className="action-cell">
                      <button
                        className="btn btn-light btn-xs"
                        onClick={() => openEdit(item)}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => remove(item)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Chương trình</th>
                <th>Ngành</th>
                <th>Phiên bản</th>
                <th>Số môn</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item) => {
                const major = data.majors.find(
                  (candidate) => Number(candidate.id) === Number(item.majorId),
                )

                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>{major?.name || '—'}</td>
                    <td>{item.version}</td>
                    <td>{item.subjectIds?.length || 0}</td>
                    <td>
                      <StatusBadge tone={item.active ? 'success' : 'neutral'}>
                        {item.active ? 'Đang áp dụng' : 'Ngừng áp dụng'}
                      </StatusBadge>
                    </td>
                    <td className="action-cell">
                      <button
                        className="btn btn-light btn-xs"
                        onClick={() => openEdit(item)}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => remove(item)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <Modal
        open={editing !== undefined}
        title={
          tab === 'subjects'
            ? editing
              ? 'Cập nhật môn học'
              : 'Thêm môn học'
            : editing
              ? 'Cập nhật chương trình'
              : 'Thêm chương trình'
        }
        onClose={() => setEditing(undefined)}
        width={860}
      >
        {tab === 'subjects' ? (
          <form className="form-grid" onSubmit={save}>
            <label>
              Mã môn
              <input
                value={form.code || ''}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </label>
            <label>
              Tên môn
              <input
                value={form.name || ''}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              Số tín chỉ
              <input
                type="number"
                min="1"
                value={form.credits}
                onChange={(event) => setForm({ ...form, credits: event.target.value })}
              />
            </label>
            <label>
              Giờ lý thuyết
              <input
                type="number"
                min="0"
                value={form.theoryHours}
                onChange={(event) => setForm({ ...form, theoryHours: event.target.value })}
              />
            </label>
            <label>
              Giờ thực hành
              <input
                type="number"
                min="0"
                value={form.practiceHours}
                onChange={(event) => setForm({ ...form, practiceHours: event.target.value })}
              />
            </label>
            <label>
              Vắng tối đa (%)
              <input
                type="number"
                min="0"
                max="100"
                value={form.maxAbsenceRate}
                onChange={(event) => setForm({ ...form, maxAbsenceRate: event.target.value })}
              />
            </label>
            <label>
              Điểm chuyên cần (%)
              <input
                type="number"
                min="0"
                max="100"
                value={form.attendanceWeight}
                onChange={(event) => setForm({ ...form, attendanceWeight: event.target.value })}
              />
            </label>
            <label>
              Điểm giữa kỳ (%)
              <input
                type="number"
                min="0"
                max="100"
                value={form.midtermWeight}
                onChange={(event) => setForm({ ...form, midtermWeight: event.target.value })}
              />
            </label>
            <label>
              Điểm cuối kỳ (%)
              <input
                type="number"
                min="0"
                max="100"
                value={form.finalWeight}
                onChange={(event) => setForm({ ...form, finalWeight: event.target.value })}
              />
            </label>

            <div className="full">
              <span className="field-label">Môn tiên quyết</span>
              <div className="check-grid">
                {data.subjects
                  .filter((subject) => subject.id !== editing?.id)
                  .map((subject) => {
                    const checked = (form.prerequisiteIds || [])
                      .map(Number)
                      .includes(Number(subject.id))
                    const blockedByCycle = Boolean(editing?.id) &&
                      !checked &&
                      prerequisiteWouldCreateCycle(editing.id, subject.id, data.subjects)

                    return (
                      <label
                        className={`check-item ${blockedByCycle ? 'check-item-disabled' : ''}`.trim()}
                        key={subject.id}
                        title={blockedByCycle
                          ? `${subject.code} đã phụ thuộc trực tiếp/gián tiếp vào ${editing.code}; chọn môn này sẽ tạo vòng lặp.`
                          : ''}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={blockedByCycle}
                          onChange={() => toggleArrayValue('prerequisiteIds', subject.id)}
                        />
                        <span>
                          {subject.code} - {subject.name}
                          {blockedByCycle ? ' · khóa để tránh vòng lặp' : ''}
                        </span>
                      </label>
                    )
                  })}
              </div>
              {editing?.id ? (
                <div className="field-help">
                  Môn màu xám bị khóa vì đang phụ thuộc vào môn hiện tại; chọn lại sẽ tạo vòng tiên quyết.
                </div>
              ) : null}
            </div>

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
                {saving ? 'Đang lưu...' : 'Lưu môn học'}
              </button>
            </div>
          </form>
        ) : (
          <form className="form-grid" onSubmit={save}>
            <label className="full">
              Tên chương trình
              <input
                value={form.name || ''}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label>
              Ngành
              <select
                value={form.majorId || ''}
                onChange={(event) => setForm({ ...form, majorId: event.target.value })}
              >
                <option value="">-- Chọn ngành --</option>
                {data.majors.map((major) => (
                  <option key={major.id} value={major.id}>
                    {major.code} - {major.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phiên bản
              <input
                value={form.version || ''}
                onChange={(event) => setForm({ ...form, version: event.target.value })}
              />
            </label>
            <label className="check-item">
              <input
                type="checkbox"
                checked={Boolean(form.active)}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              Đang áp dụng
            </label>

            <div className="full">
              <span className="field-label">Danh sách môn học</span>
              <div className="check-grid">
                {data.subjects.map((subject) => (
                  <label className="check-item" key={subject.id}>
                    <input
                      type="checkbox"
                      checked={(form.subjectIds || [])
                        .map(Number)
                        .includes(Number(subject.id))}
                      onChange={() => toggleArrayValue('subjectIds', subject.id)}
                    />
                    <span>
                      {subject.code} - {subject.name} ({subject.credits} TC)
                    </span>
                  </label>
                ))}
              </div>
            </div>

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
                {saving ? 'Đang lưu...' : 'Lưu chương trình'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
