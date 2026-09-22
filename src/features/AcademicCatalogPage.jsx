import { useEffect, useMemo, useState } from 'react'
import { getAllData } from '../core/api/apiClient.js'
import CrudPanel from '../shared/components/CrudPanel.jsx'
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx'
import PageHeader from '../shared/components/PageHeader.jsx'
import { formatDate } from '../shared/utils/date.js'

const tabs = [
  ['faculties', 'Khoa'],
  ['majors', 'Ngành'],
  ['cohorts', 'Khóa'],
  ['classes', 'Lớp'],
  ['semesters', 'Học kỳ'],
]

const referenceResources = [
  'faculties',
  'majors',
  'cohorts',
  'classes',
  'students',
  'courseSections',
];

function hasDuplicateCode(items, editing, code) {
  const normalizedCode = code.trim().toLowerCase()

  return items.some(
    (item) =>
      item.id !== editing?.id &&
      String(item.code).trim().toLowerCase() === normalizedCode,
  )
}

export default function AcademicCatalogPage() {
  const [tab, setTab] = useState('faculties')
  const [refs, setRefs] = useState({
    faculties: [],
    majors: [],
    cohorts: [],
    classes: [],
    students: [],
    courseSections: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadRefs() {
    setLoading(true);
    setError('');

    try {
      const snapshot = await getAllData();
      const nextRefs = Object.fromEntries(
        referenceResources.map((resource) => [resource, snapshot[resource] || []]),
      );

      setRefs(nextRefs);
    } catch (requestError) {
      setError(requestError?.message || 'Không thể tải dữ liệu danh mục.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRefs();
  }, []);

  function handleResourceChanged(resource, items) {
    setRefs((current) => ({
      ...current,
      [resource]: items,
    }));
  }

  const configs = useMemo(() => {
    const facultyOptions = refs.faculties.map((item) => ({
      value: item.id,
      label: item.name,
    }))
    const majorOptions = refs.majors.map((item) => ({
      value: item.id,
      label: item.name,
    }))
    const cohortOptions = refs.cohorts.map((item) => ({
      value: item.id,
      label: item.name,
    }))

    return {
      faculties: {
        title: 'Khoa',
        fields: [
          { name: 'code', label: 'Mã khoa' },
          { name: 'name', label: 'Tên khoa' },
          {
            name: 'description',
            label: 'Mô tả',
            type: 'textarea',
            full: true,
          },
        ],
        columns: [
          { key: 'code', label: 'Mã' },
          { key: 'name', label: 'Tên khoa' },
          { key: 'description', label: 'Mô tả' },
        ],
        validate(data, items, editing) {
          if (!data.code.trim() || !data.name.trim()) {
            return 'Mã và tên khoa là bắt buộc.'
          }

          if (hasDuplicateCode(items, editing, data.code)) {
            return 'Mã khoa đã tồn tại.'
          }

          return ''
        },
        async canDelete(item) {
          const hasMajor = refs.majors.some(
            (major) => Number(major.facultyId) === Number(item.id),
          )

          return hasMajor ? 'Không thể xóa khoa đang có ngành trực thuộc.' : ''
        },
      },
      majors: {
        title: 'Ngành',
        fields: [
          { name: 'code', label: 'Mã ngành' },
          { name: 'name', label: 'Tên ngành' },
          {
            name: 'facultyId',
            label: 'Khoa',
            type: 'select-number',
            options: facultyOptions,
          },
          {
            name: 'totalCredits',
            label: 'Tổng tín chỉ',
            type: 'number',
            min: 1,
          },
          {
            name: 'description',
            label: 'Mô tả',
            type: 'textarea',
            full: true,
          },
        ],
        columns: [
          { key: 'code', label: 'Mã' },
          { key: 'name', label: 'Tên ngành' },
          {
            key: 'facultyId',
            label: 'Khoa',
            render(item) {
              return refs.faculties.find(
                (faculty) => Number(faculty.id) === Number(item.facultyId),
              )?.name || '—'
            },
          },
          { key: 'totalCredits', label: 'Tín chỉ' },
        ],
        validate(data, items, editing) {
          if (
            !data.code.trim() ||
            !data.name.trim() ||
            !data.facultyId ||
            Number(data.totalCredits) <= 0
          ) {
            return 'Vui lòng nhập đủ thông tin hợp lệ.'
          }

          if (hasDuplicateCode(items, editing, data.code)) {
            return 'Mã ngành đã tồn tại.'
          }

          return ''
        },
        async canDelete(item) {
          const hasClass = refs.classes.some(
            (classItem) => Number(classItem.majorId) === Number(item.id),
          )

          return hasClass ? 'Không thể xóa ngành đang có lớp.' : ''
        },
      },
      cohorts: {
        title: 'Khóa',
        fields: [
          { name: 'code', label: 'Mã khóa' },
          { name: 'name', label: 'Tên khóa' },
          { name: 'startYear', label: 'Năm bắt đầu', type: 'number', min: 2000 },
          { name: 'endYear', label: 'Năm kết thúc', type: 'number', min: 2000 },
        ],
        columns: [
          { key: 'code', label: 'Mã' },
          { key: 'name', label: 'Tên khóa' },
          { key: 'startYear', label: 'Bắt đầu' },
          { key: 'endYear', label: 'Kết thúc' },
        ],
        validate(data, items, editing) {
          if (!data.code.trim() || Number(data.endYear) < Number(data.startYear)) {
            return 'Mã khóa bắt buộc và năm kết thúc phải sau năm bắt đầu.'
          }

          if (hasDuplicateCode(items, editing, data.code)) {
            return 'Mã khóa đã tồn tại.'
          }

          return ''
        },
        async canDelete(item) {
          const hasClass = refs.classes.some(
            (classItem) => Number(classItem.cohortId) === Number(item.id),
          )

          return hasClass ? 'Không thể xóa khóa đang có lớp.' : ''
        },
      },
      classes: {
        title: 'Lớp',
        fields: [
          { name: 'code', label: 'Mã lớp' },
          { name: 'name', label: 'Tên lớp' },
          {
            name: 'majorId',
            label: 'Ngành',
            type: 'select-number',
            options: majorOptions,
          },
          {
            name: 'cohortId',
            label: 'Khóa',
            type: 'select-number',
            options: cohortOptions,
          },
        ],
        columns: [
          { key: 'code', label: 'Mã' },
          { key: 'name', label: 'Tên lớp' },
          {
            key: 'majorId',
            label: 'Ngành',
            render(item) {
              return refs.majors.find(
                (major) => Number(major.id) === Number(item.majorId),
              )?.name || '—'
            },
          },
          {
            key: 'cohortId',
            label: 'Khóa',
            render(item) {
              return refs.cohorts.find(
                (cohort) => Number(cohort.id) === Number(item.cohortId),
              )?.name || '—'
            },
          },
        ],
        validate(data, items, editing) {
          if (!data.code.trim() || !data.majorId || !data.cohortId) {
            return 'Mã lớp, ngành và khóa là bắt buộc.'
          }

          if (hasDuplicateCode(items, editing, data.code)) {
            return 'Mã lớp đã tồn tại.'
          }

          return ''
        },
        async canDelete(item) {
          const hasStudent = refs.students.some(
            (student) => Number(student.classId) === Number(item.id),
          )

          return hasStudent ? 'Không thể xóa lớp đang có sinh viên.' : ''
        },
      },
      semesters: {
        title: 'Học kỳ – Năm học',
        fields: [
          { name: 'code', label: 'Mã học kỳ' },
          { name: 'name', label: 'Tên học kỳ' },
          { name: 'academicYear', label: 'Năm học' },
          { name: 'startDate', label: 'Ngày bắt đầu', type: 'date' },
          { name: 'endDate', label: 'Ngày kết thúc', type: 'date' },
          { name: 'registrationStart', label: 'Mở đăng ký', type: 'date' },
          { name: 'registrationEnd', label: 'Đóng đăng ký', type: 'date' },
          {
            name: 'active',
            label: 'Học kỳ hiện hành',
            type: 'checkbox',
            defaultValue: false,
          },
        ],
        columns: [
          { key: 'code', label: 'Mã' },
          { key: 'name', label: 'Học kỳ' },
          { key: 'academicYear', label: 'Năm học' },
          {
            key: 'startDate',
            label: 'Bắt đầu',
            render: (item) => formatDate(item.startDate),
          },
          {
            key: 'endDate',
            label: 'Kết thúc',
            render: (item) => formatDate(item.endDate),
          },
        ],
        validate(data, items, editing) {
          const invalidTimeline =
            !data.code.trim() ||
            !data.startDate ||
            !data.endDate ||
            data.endDate <= data.startDate ||
            data.registrationEnd < data.registrationStart

          if (invalidTimeline) {
            return 'Kiểm tra lại mã và các mốc thời gian của học kỳ.'
          }

          if (hasDuplicateCode(items, editing, data.code)) {
            return 'Mã học kỳ đã tồn tại.'
          }

          const anotherActiveSemester = items.some(
            (item) => item.id !== editing?.id && item.active,
          )

          if (data.active && anotherActiveSemester) {
            return 'Chỉ được có một học kỳ hiện hành.'
          }

          return ''
        },
        async canDelete(item) {
          const hasCourseSection = refs.courseSections.some(
            (section) => Number(section.semesterId) === Number(item.id),
          )

          return hasCourseSection
            ? 'Không thể xóa học kỳ đang có lớp học phần.'
            : ''
        },
      },
    }
  }, [refs])

  if (loading) {
    return <LoadingState />
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadRefs} />
  }

  const config = configs[tab]

  return (
    <div>
      <PageHeader
        title="Danh mục đào tạo"
        description="Khoa, ngành, khóa, lớp và học kỳ – năm học."
      />

      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <CrudPanel
        key={tab}
        resource={tab}
        initialItems={refs[tab]}
        {...config}
        onChanged={(items) => handleResourceChanged(tab, items)}
      />
    </div>
  )
}
