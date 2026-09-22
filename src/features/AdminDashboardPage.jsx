import useFetch from "../shared/hooks/useFetch.js";
import { getAllData } from "../core/api/apiClient.js";
import PageHeader from "../shared/components/PageHeader.jsx";
import StatCard from "../shared/components/StatCard.jsx";
import BarChart from "../shared/components/BarChart.jsx";
import {
  ErrorState,
  LoadingState,
} from "../shared/components/DataState.jsx";
import {
  calculateWeightedAverage,
  isPassed,
} from '../shared/utils/trainingRules.js';
export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(getAllData, []);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const activeSemester = data.semesters.find((item) => item.active);
  const activeSections = data.courseSections.filter(
    (item) => Number(item.semesterId) === Number(activeSemester?.id),
  );
  const activeSectionIds = new Set(
    activeSections.map((item) => Number(item.id)),
  );
  const activeScores = data.scores.filter((item) =>
    activeSectionIds.has(Number(item.courseSectionId)),
  );
  const passRate = activeScores.length
    ? Math.round(
        (activeScores.filter((item) => isPassed(item.total)).length /
          activeScores.length) *
          100,
      )
    : 0;
  const averageForStudent = (studentId) =>
    calculateWeightedAverage(
      data.scores.filter(
        (score) => Number(score.studentId) === Number(studentId),
      ),
      data.courseSections,
      data.subjects,
    );
  const warningStudents = data.students.filter((student) => {
    const average = averageForStudent(student.id);
    return average > 0 && average < 5;
  });
  const studentByFaculty = data.faculties.map((faculty) => {
    const majorIds = new Set(
      data.majors
        .filter((major) => Number(major.facultyId) === Number(faculty.id))
        .map((major) => Number(major.id)),
    );
    const classIds = new Set(
      data.classes
        .filter((cls) => majorIds.has(Number(cls.majorId)))
        .map((cls) => Number(cls.id)),
    );
    return {
      label: faculty.code,
      value: data.students.filter((student) =>
        classIds.has(Number(student.classId)),
      ).length,
    };
  });
  const studentByMajor = data.majors.map((major) => {
    const classIds = new Set(
      data.classes
        .filter((cls) => Number(cls.majorId) === Number(major.id))
        .map((cls) => Number(cls.id)),
    );
    return {
      label: major.code,
      value: data.students.filter((student) =>
        classIds.has(Number(student.classId)),
      ).length,
    };
  });
  const subjectPassRates = data.subjects
    .map((subject) => {
      const sectionIds = new Set(
        activeSections
          .filter((section) => Number(section.subjectId) === Number(subject.id))
          .map((section) => Number(section.id)),
      );
      const subjectScores = activeScores.filter((score) =>
        sectionIds.has(Number(score.courseSectionId)),
      );
      const value = subjectScores.length
        ? Math.round(
            (subjectScores.filter((score) => isPassed(score.total)).length /
              subjectScores.length) *
              100,
          )
        : 0;
      return { label: subject.code, value };
    })
    .filter((item) => item.value > 0);
  const scoreDistribution = [
    {
      label: "8.5–10",
      value: activeScores.filter((x) => Number(x.total) >= 8.5).length,
    },
    {
      label: "7–<8.5",
      value: activeScores.filter(
        (x) => Number(x.total) >= 7 && Number(x.total) < 8.5,
      ).length,
    },
    {
      label: "5.5–<7",
      value: activeScores.filter(
        (x) => Number(x.total) >= 5.5 && Number(x.total) < 7,
      ).length,
    },
    {
      label: "4–<5.5",
      value: activeScores.filter(
        (x) => Number(x.total) >= 4 && Number(x.total) < 5.5,
      ).length,
    },
    {
      label: "<4",
      value: activeScores.filter((x) => Number(x.total) < 4).length,
    },
  ];
  return (
    <div>
      <PageHeader
        title="Tổng quan đào tạo"
        description={
          activeSemester
            ? `${activeSemester.name} · Năm học ${activeSemester.academicYear}`
            : "Chưa thiết lập học kỳ hiện hành"
        }
      />
      <div className="stats-grid">
        <StatCard
          label="Sinh viên đang học"
          value={data.students.filter((x) => x.status === "studying").length}
          hint={`${data.classes.length} lớp hành chính`}
        />
        <StatCard
          label="Lớp học phần học kỳ"
          value={activeSections.length}
          hint={`${data.subjects.length} môn học`}
        />
        <StatCard
          label="Tỷ lệ đạt"
          value={`${passRate}%`}
          hint={`${activeScores.length} kết quả đã nhập`}
        />
        <StatCard
          label="Cảnh báo học vụ"
          value={warningStudents.length}
          hint="Điểm TB tích lũy dưới 5.0"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Sĩ số theo khoa</h2>
              <span>Phân bố sinh viên hiện tại</span>
            </div>
          </div>
          <BarChart items={studentByFaculty} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Sĩ số theo ngành</h2>
              <span>Phân bố theo mã ngành</span>
            </div>
          </div>
          <BarChart items={studentByMajor} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Phổ điểm học kỳ</h2>
              <span>Theo thang điểm 10</span>
            </div>
          </div>
          <BarChart items={scoreDistribution} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Tỷ lệ đạt theo môn</h2>
              <span>Kết quả trong học kỳ hiện hành</span>
            </div>
          </div>
          <BarChart
            items={subjectPassRates}
            valueFormatter={(value) => `${value}%`}
          />
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Cảnh báo học vụ</h2>
            <span>Sinh viên có điểm trung bình tích lũy dưới 5.0</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã SV</th>
                <th>Họ tên</th>
                <th>Lớp</th>
                <th>Điểm TB</th>
              </tr>
            </thead>
            <tbody>
              {warningStudents.map((student) => (
                <tr key={student.id}>
                  <td>{student.code}</td>
                  <td>{student.fullName}</td>
                  <td>
                    {
                      data.classes.find(
                        (x) => Number(x.id) === Number(student.classId),
                      )?.code
                    }
                  </td>
                  <td>
                    <strong>{averageForStudent(student.id)}</strong>
                  </td>
                </tr>
              ))}
              {!warningStudents.length ? (
                <tr>
                  <td colSpan="4" className="table-empty">
                    Không có sinh viên trong diện cảnh báo.
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
