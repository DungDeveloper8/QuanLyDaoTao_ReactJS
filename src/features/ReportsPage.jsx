import { useMemo, useState } from 'react';
import PageHeader from '../shared/components/PageHeader.jsx';
import StatusBadge from '../shared/components/StatusBadge.jsx';
import useFetch from '../shared/hooks/useFetch.js';
import { getAllData } from '../core/api/apiClient.js';
import { ErrorState, LoadingState } from '../shared/components/DataState.jsx';
import { attendanceSummary } from '../shared/utils/trainingRules.js';
import { downloadExcel2003 } from '../shared/utils/exportExcel.js';
import Icon from '../shared/components/Icon.jsx';

export default function ReportsPage() {
  const { data, loading, error, reload } = useFetch(getAllData, []);
  const [semesterId, setSemesterId] = useState('');
  const selectedSemester = semesterId || String(data?.semesters.find((item) => item.active)?.id || '');

  const rows = useMemo(() => {
    if (!data || !selectedSemester) {
      return [];
    }

    const sections = data.courseSections.filter(
      (item) => Number(item.semesterId) === Number(selectedSemester),
    );

    return sections.flatMap((section) => {
      const subject = data.subjects.find((item) => Number(item.id) === Number(section.subjectId));

      return data.registrations
        .filter(
          (item) => Number(item.courseSectionId) === Number(section.id) && item.status === 'registered',
        )
        .map((registration) => {
          const student = data.students.find(
            (item) => Number(item.id) === Number(registration.studentId),
          );
          const summary = attendanceSummary(
            registration.studentId,
            section.id,
            data.attendanceSessions,
            data.attendanceRecords,
            subject?.maxAbsenceRate,
          );

          return {
            student,
            section,
            subject,
            summary,
          };
        });
    });
  }, [data, selectedSemester]);

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  function downloadTemplate() {
    downloadExcel2003({
      fileName: 'mau-bao-cao-chuyen-can.xls',
      sheetName: 'Mau bao cao',
      columns: [
        { label: 'Mã sinh viên', value: 'studentCode' },
        { label: 'Họ và tên', value: 'fullName' },
        { label: 'Lớp học phần', value: 'sectionCode' },
        { label: 'Môn học', value: 'subjectName' },
        { label: 'Tổng tiết đã học', value: 'totalPeriods' },
        { label: 'Số tiết vắng', value: 'absentPeriods' },
        { label: 'Tỷ lệ vắng (%)', value: 'absenceRate' },
        { label: 'Điều kiện dự thi', value: 'eligibility' },
      ],
      rows: [
        {
          studentCode: 'SV001',
          fullName: 'Nguyễn Văn A',
          sectionCode: 'REACT201-K16A',
          subjectName: 'Lập trình Web với ReactJS',
          totalPeriods: 9,
          absentPeriods: 0,
          absenceRate: 0,
          eligibility: 'Đủ điều kiện',
        },
      ],
    });
  }

  function exportReport() {
    downloadExcel2003({
      fileName: 'bao-cao-chuyen-can.xls',
      sheetName: 'Chuyen can',
      columns: [
        { label: 'Mã sinh viên', value: (row) => row.student?.code || '' },
        { label: 'Họ và tên', value: (row) => row.student?.fullName || '' },
        { label: 'Lớp học phần', value: (row) => row.section.code },
        { label: 'Môn học', value: (row) => row.subject?.name || '' },
        { label: 'Tổng tiết đã học', value: (row) => row.summary.totalPeriods, type: 'Number' },
        { label: 'Số tiết vắng', value: (row) => row.summary.absentPeriods, type: 'Number' },
        { label: 'Tỷ lệ vắng (%)', value: (row) => row.summary.absenceRate, type: 'Number' },
        {
          label: 'Điều kiện dự thi',
          value: (row) => (row.summary.eligible ? 'Đủ điều kiện' : 'Không đủ điều kiện'),
        },
      ],
      rows,
    });
  }

  return (
    <div>
      <PageHeader
        title="Báo cáo chuyên cần"
        description="Tổng hợp chuyên cần theo học kỳ."
        actions={
          <div className="page-actions">
            <button className="btn btn-light" type="button" onClick={downloadTemplate}>
              <Icon name="download" size={15} />
              <span>Lấy mẫu Excel</span>
            </button>
            <button className="btn btn-excel" type="button" onClick={exportReport}>
              <Icon name="download" size={15} />
              <span>Xuất Excel</span>
            </button>
          </div>
        }
      />

      <div className="filter-bar">
        <label className="filter-field">
          <span>Học kỳ</span>
          <select value={selectedSemester} onChange={(event) => setSemesterId(event.target.value)}>
            {data.semesters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} - {item.academicYear}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Danh sách chuyên cần</h2>
            <span>{rows.length} bản ghi</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Lớp HP</th>
                <th>Môn học</th>
                <th>Tổng tiết</th>
                <th>Tiết vắng</th>
                <th>Tỷ lệ vắng</th>
                <th>Điều kiện dự thi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.student?.id}-${row.section.id}`}>
                  <td>
                    <strong>{row.student?.code}</strong>
                    <br />
                    {row.student?.fullName}
                  </td>
                  <td>{row.section.code}</td>
                  <td>{row.subject?.name}</td>
                  <td>{row.summary.totalPeriods}</td>
                  <td>{row.summary.absentPeriods}</td>
                  <td>{row.summary.absenceRate}%</td>
                  <td>
                    <StatusBadge tone={row.summary.eligible ? 'success' : 'danger'}>
                      {row.summary.eligible ? 'Đủ điều kiện' : 'Không đủ điều kiện'}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan="7" className="table-empty">
                    Chưa có dữ liệu chuyên cần trong học kỳ này.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
