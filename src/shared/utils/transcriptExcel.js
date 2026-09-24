import { isPassed, letterGrade } from "./trainingRules.js";

const STUDENT_STATUS_LABELS = {
  studying: "Đang học",
  paused: "Bảo lưu",
  reserved: "Bảo lưu",
  graduated: "Đã tốt nghiệp",
  stopped: "Thôi học",
  dropped: "Thôi học",
};

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sanitizeSheetName(value) {
  return (
    String(value || "Bang diem")
      .replace(/[\\/?*\[\]:]/g, " ")
      .trim()
      .slice(0, 31) || "Bang diem"
  );
}

function cell(
  value,
  { style = "Cell", type = "String", mergeAcross = 0 } = {},
) {
  const merge = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : "";
  return `<Cell ss:StyleID="${style}"${merge}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function row(cells, { height } = {}) {
  const rowHeight = height ? ` ss:Height="${height}"` : "";
  return `<Row${rowHeight}>${cells.join("")}</Row>`;
}

function resolveStudentContext(data, studentId) {
  const student = data.students.find(
    (item) => Number(item.id) === Number(studentId),
  );
  const classItem = data.classes.find(
    (item) => Number(item.id) === Number(student?.classId),
  );
  const major = data.majors.find(
    (item) => Number(item.id) === Number(classItem?.majorId),
  );
  const faculty = data.faculties.find(
    (item) => Number(item.id) === Number(major?.facultyId),
  );
  const cohort = data.cohorts.find(
    (item) => Number(item.id) === Number(classItem?.cohortId),
  );
  return { student, classItem, major, faculty, cohort };
}

function getPassedRows(data, studentId) {
  return data.scores
    .filter(
      (score) =>
        Number(score.studentId) === Number(studentId) && isPassed(score.total),
    )
    .map((score) => {
      const section = data.courseSections.find(
        (item) => Number(item.id) === Number(score.courseSectionId),
      );
      const subject = data.subjects.find(
        (item) => Number(item.id) === Number(section?.subjectId),
      );
      const semester = data.semesters.find(
        (item) => Number(item.id) === Number(section?.semesterId),
      );
      return { score, section, subject, semester };
    })
    .filter((item) => item.section && item.subject)
    .sort((a, b) => {
      const dateCompare = String(a.semester?.startDate || "").localeCompare(
        String(b.semester?.startDate || ""),
      );
      if (dateCompare) return dateCompare;
      return String(a.subject?.code || "").localeCompare(
        String(b.subject?.code || ""),
        "vi",
      );
    });
}

function transcriptSummary(rows) {
  let weightedTotal = 0;
  let totalCredits = 0;

  rows.forEach(({ score, subject }) => {
    const credits = Number(subject?.credits || 0);
    if (credits <= 0) return;
    weightedTotal += Number(score.total) * credits;
    totalCredits += credits;
  });

  return {
    passedSubjects: rows.length,
    totalCredits,
    average: totalCredits
      ? Number((weightedTotal / totalCredits).toFixed(2))
      : 0,
  };
}

function groupRowsBySemester(rows) {
  const groups = [];
  const bySemester = new Map();

  rows.forEach((item) => {
    const key = String(item.semester?.id ?? "unknown");
    if (!bySemester.has(key)) {
      const group = { semester: item.semester, rows: [] };
      bySemester.set(key, group);
      groups.push(group);
    }
    bySemester.get(key).rows.push(item);
  });

  return groups;
}

export function createStudentTranscriptModel(data, studentId) {
  const context = resolveStudentContext(data, studentId);
  const rows = getPassedRows(data, studentId);
  const graduated = context.student?.status === "graduated";

  return {
    ...context,
    rows,
    groups: groupRowsBySemester(rows),
    summary: transcriptSummary(rows),
    graduated,
    title: graduated ? "BẢNG ĐIỂM HOÀN CHỈNH" : "BẢNG ĐIỂM HỌC TẬP",
    statusLabel:
      STUDENT_STATUS_LABELS[context.student?.status] ||
      context.student?.status ||
      "",
  };
}

export function buildStudentTranscriptXml(data, studentId) {
  const model = createStudentTranscriptModel(data, studentId);
  if (!model.student) throw new Error("Không tìm thấy sinh viên.");
  if (!model.rows.length)
    throw new Error("Sinh viên chưa có học phần đạt để xuất bảng điểm.");

  const body = [];
  body.push(
    row([cell(model.title, { style: "Title", mergeAcross: 5 })], {
      height: 30,
    }),
  );
  body.push(
    row(
      [
        cell("KẾT QUẢ HỌC TẬP THEO HỌC PHẦN ĐÃ ĐẠT", {
          style: "Subtitle",
          mergeAcross: 5,
        }),
      ],
      { height: 22 },
    ),
  );
  body.push(
    row([
      cell("Mã sinh viên", { style: "InfoLabel" }),
      cell(model.student.code || "", { style: "InfoValue", mergeAcross: 1 }),
      cell("Họ và tên", { style: "InfoLabel" }),
      cell(model.student.fullName || "", {
        style: "InfoValue",
        mergeAcross: 1,
      }),
    ]),
  );
  body.push(
    row([
      cell("Lớp", { style: "InfoLabel" }),
      cell(model.classItem?.code || "", { style: "InfoValue", mergeAcross: 1 }),
      cell("Ngành", { style: "InfoLabel" }),
      cell(model.major?.name || "", { style: "InfoValue", mergeAcross: 1 }),
    ]),
  );
  body.push(
    row([
      cell("Khoa", { style: "InfoLabel" }),
      cell(model.faculty?.name || "", { style: "InfoValue", mergeAcross: 1 }),
      cell("Khóa", { style: "InfoLabel" }),
      cell(model.cohort?.code || "", { style: "InfoValue", mergeAcross: 1 }),
    ]),
  );
  body.push(
    row([
      cell("Trạng thái", { style: "InfoLabel" }),
      cell(model.statusLabel, { style: "InfoValue", mergeAcross: 4 }),
    ]),
  );
  body.push(row([cell("", { mergeAcross: 5 })], { height: 8 }));
  body.push(
    row(
      [
        cell("TT", { style: "Header" }),
        cell("Mã môn", { style: "Header" }),
        cell("Tên học phần", { style: "Header" }),
        cell("Số TC", { style: "Header" }),
        cell("Điểm", { style: "Header" }),
        cell("Điểm chữ", { style: "Header" }),
      ],
      { height: 24 },
    ),
  );

  let order = 1;
  model.groups.forEach((group) => {
    const semesterTitle = group.semester
      ? `${group.semester.name} - ${group.semester.academicYear}`
      : "Học kỳ chưa xác định";
    body.push(
      row([cell(semesterTitle, { style: "Semester", mergeAcross: 5 })], {
        height: 22,
      }),
    );

    group.rows.forEach(({ score, subject }) => {
      body.push(
        row(
          [
            cell(order, { style: "CenterCell", type: "Number" }),
            cell(subject.code || "", { style: "CenterCell" }),
            cell(subject.name || "", { style: "Cell" }),
            cell(Number(subject.credits || 0), {
              style: "CenterCell",
              type: "Number",
            }),
            cell(Number(score.total), { style: "ScoreCell", type: "Number" }),
            cell(score.letter || letterGrade(score.total), {
              style: "CenterCell",
            }),
          ],
          { height: 22 },
        ),
      );
      order += 1;
    });
  });

  body.push(row([cell("", { mergeAcross: 5 })], { height: 8 }));
  body.push(
    row([
      cell("Số học phần đạt", { style: "SummaryLabel", mergeAcross: 3 }),
      cell(model.summary.passedSubjects, {
        style: "SummaryValue",
        type: "Number",
        mergeAcross: 1,
      }),
    ]),
  );
  body.push(
    row([
      cell("Tổng số tín chỉ đạt", { style: "SummaryLabel", mergeAcross: 3 }),
      cell(model.summary.totalCredits, {
        style: "SummaryValue",
        type: "Number",
        mergeAcross: 1,
      }),
    ]),
  );
  body.push(
    row([
      cell("Điểm TBC tích lũy thang 10", {
        style: "SummaryLabel",
        mergeAcross: 3,
      }),
      cell(model.summary.average, {
        style: "SummaryScore",
        type: "Number",
        mergeAcross: 1,
      }),
    ]),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="16" ss:Bold="1" ss:Color="#173B67"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#475569"/>
  </Style>
  <Style ss:ID="InfoLabel">
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="InfoValue">
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#173B67" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#173B67"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#173B67"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#173B67"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#173B67"/>
   </Borders>
  </Style>
  <Style ss:ID="Semester">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#173B67"/>
   <Interior ss:Color="#E8F0F8" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B7C9DD"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B7C9DD"/>
   </Borders>
  </Style>
  <Style ss:ID="Cell">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2EC"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2EC"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2EC"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2EC"/>
   </Borders>
  </Style>
  <Style ss:ID="CenterCell" ss:Parent="Cell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="ScoreCell" ss:Parent="CenterCell">
   <NumberFormat ss:Format="0.00"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="SummaryLabel">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="SummaryValue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryScore" ss:Parent="SummaryValue">
   <NumberFormat ss:Format="0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(sanitizeSheetName(model.graduated ? "Bang diem hoan chinh" : "Bang diem hoc tap"))}">
  <Table>
   <Column ss:Width="42"/>
   <Column ss:Width="88"/>
   <Column ss:Width="260"/>
   <Column ss:Width="58"/>
   <Column ss:Width="66"/>
   <Column ss:Width="78"/>
   ${body.join("\n   ")}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Portrait"/>
    <PageMargins x:Bottom="0.5" x:Left="0.45" x:Right="0.45" x:Top="0.5"/>
   </PageSetup>
   <FitToPage/>
   <Print>
    <FitWidth>1</FitWidth>
    <FitHeight>0</FitHeight>
    <ValidPrinterInfo/>
    <HorizontalResolution>600</HorizontalResolution>
    <VerticalResolution>600</VerticalResolution>
   </Print>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>8</SplitHorizontal>
   <TopRowBottomPane>8</TopRowBottomPane>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

export function downloadStudentTranscript(data, studentId) {
  const model = createStudentTranscriptModel(data, studentId);
  const xml = buildStudentTranscriptXml(data, studentId);
  const prefix = model.graduated ? "bang-diem-hoan-chinh" : "bang-diem-hoc-tap";
  const fileName = `${prefix}-${model.student.code || studentId}.xls`;
  const blob = new Blob([`\ufeff${xml}`], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
