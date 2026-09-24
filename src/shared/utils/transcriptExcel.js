import { SCHOOL_NAME } from '../../app/config.js';
import { isPassed, letterGrade } from './trainingRules.js';

const STATUS_LABELS = {
  studying: 'Đang học',
  paused: 'Bảo lưu',
  reserved: 'Bảo lưu',
  graduated: 'Đã tốt nghiệp',
  stopped: 'Thôi học',
  dropped: 'Thôi học',
};

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function sanitizeSheetName(value) {
  return String(value || 'Bang diem')
    .replace(/[\\/?*\[\]:]/g, ' ')
    .trim()
    .slice(0, 31) || 'Bang diem';
}

function cell(value, { style = 'TextCell', type = 'String', mergeAcross = 0 } = {}) {
  const merge = mergeAcross > 0 ? ` ss:MergeAcross="${mergeAcross}"` : '';
  return `<Cell ss:StyleID="${style}"${merge}><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function row(cells, height) {
  const rowHeight = height ? ` ss:Height="${height}"` : '';
  return `<Row${rowHeight}>${cells.join('')}</Row>`;
}

function formatDate(value) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
}

function issuedDate(date = new Date()) {
  return `Ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

function gradePoint4(total) {
  const value = Number(total);
  if (value >= 8.5) return 4;
  if (value >= 7) return 3;
  if (value >= 5.5) return 2;
  if (value >= 4) return 1;
  return 0;
}

function studentContext(data, studentId) {
  const student = data.students.find((item) => Number(item.id) === Number(studentId));
  const classItem = data.classes.find((item) => Number(item.id) === Number(student?.classId));
  const major = data.majors.find((item) => Number(item.id) === Number(classItem?.majorId));
  const faculty = data.faculties.find((item) => Number(item.id) === Number(major?.facultyId));
  const cohort = data.cohorts.find((item) => Number(item.id) === Number(classItem?.cohortId));
  return { student, classItem, major, faculty, cohort };
}

function semesterSortKey(semester) {
  return [semester?.startDate || '', semester?.academicYear || '', semester?.name || ''].join('|');
}

function passedCourses(data, studentId) {
  const bestBySubject = new Map();

  data.scores
    .filter((score) => Number(score.studentId) === Number(studentId) && isPassed(score.total))
    .forEach((score) => {
      const section = data.courseSections.find(
        (item) => Number(item.id) === Number(score.courseSectionId),
      );
      const subject = data.subjects.find((item) => Number(item.id) === Number(section?.subjectId));
      const semester = data.semesters.find((item) => Number(item.id) === Number(section?.semesterId));
      if (!section || !subject) return;

      const candidate = { score, section, subject, semester };
      const key = Number(subject.id);
      const current = bestBySubject.get(key);

      if (
        !current
        || Number(score.total) > Number(current.score.total)
        || (
          Number(score.total) === Number(current.score.total)
          && semesterSortKey(semester) > semesterSortKey(current.semester)
        )
      ) {
        bestBySubject.set(key, candidate);
      }
    });

  return [...bestBySubject.values()].sort((left, right) => {
    const semesterCompare = semesterSortKey(left.semester).localeCompare(semesterSortKey(right.semester), 'vi');
    if (semesterCompare) return semesterCompare;
    return String(left.subject?.code || '').localeCompare(String(right.subject?.code || ''), 'vi');
  });
}

function groupBySemester(courses) {
  const groups = [];
  const map = new Map();

  courses.forEach((course) => {
    const key = String(course.semester?.id ?? 'unknown');
    if (!map.has(key)) {
      const group = { semester: course.semester, courses: [] };
      map.set(key, group);
      groups.push(group);
    }
    map.get(key).courses.push(course);
  });

  return groups;
}

function summary(courses) {
  let totalCredits = 0;
  let weighted10 = 0;
  let weighted4 = 0;

  courses.forEach(({ score, subject }) => {
    const credits = Number(subject?.credits || 0);
    if (credits <= 0) return;
    totalCredits += credits;
    weighted10 += Number(score.total) * credits;
    weighted4 += gradePoint4(score.total) * credits;
  });

  return {
    passedSubjects: courses.length,
    totalCredits,
    average10: totalCredits ? Number((weighted10 / totalCredits).toFixed(2)) : 0,
    average4: totalCredits ? Number((weighted4 / totalCredits).toFixed(2)) : 0,
  };
}

function semesterLabel(semester) {
  if (!semester) return 'HỌC KỲ CHƯA XÁC ĐỊNH';
  return `${semester.name || 'Học kỳ'}${semester.academicYear ? ` - Năm học ${semester.academicYear}` : ''}`;
}

export function createStudentTranscriptModel(data, studentId) {
  const context = studentContext(data, studentId);
  const rows = passedCourses(data, studentId);
  const graduated = context.student?.status === 'graduated';

  return {
    ...context,
    rows,
    groups: groupBySemester(rows),
    summary: summary(rows),
    graduated,
    title: graduated ? 'BẢNG ĐIỂM HOÀN CHỈNH' : 'BẢNG ĐIỂM HỌC TẬP',
    statusLabel: STATUS_LABELS[context.student?.status] || context.student?.status || '',
  };
}

function styles() {
  return `<Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Color="#111827"/>
  </Style>
  <Style ss:ID="Blank"><Font ss:FontName="Times New Roman" ss:Size="10"/></Style>
  <Style ss:ID="TopLeft">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="TopRight">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="Motto" ss:Parent="TopRight">
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#111111"/></Borders>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="16" ss:Bold="1" ss:Color="#102A43"/>
  </Style>
  <Style ss:ID="InfoLabel">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Color="#374151"/>
  </Style>
  <Style ss:ID="InfoValue">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#111827"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1F4E78" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#163A5B"/>
   </Borders>
  </Style>
  <Style ss:ID="Semester">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#17365D"/>
   <Interior ss:Color="#DCE6F1" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9FBAD0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9FBAD0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9FBAD0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#9FBAD0"/>
   </Borders>
  </Style>
  <Style ss:ID="BaseCell">
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Times New Roman" ss:Size="10"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D5DEE8"/>
   </Borders>
  </Style>
  <Style ss:ID="TextOdd" ss:Parent="BaseCell"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="TextEven" ss:Parent="BaseCell"><Interior ss:Color="#F7FAFC" ss:Pattern="Solid"/></Style>
  <Style ss:ID="CenterOdd" ss:Parent="TextOdd"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="CenterEven" ss:Parent="TextEven"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="ScoreOdd" ss:Parent="CenterOdd"><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="ScoreEven" ss:Parent="CenterEven"><NumberFormat ss:Format="0.00"/></Style>
  <Style ss:ID="SemesterTotal">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="9.5" ss:Bold="1" ss:Color="#52677D"/>
   <Interior ss:Color="#F3F6F9" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryLabel">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1" ss:Color="#17365D"/>
   <Interior ss:Color="#EAF2F8" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SummaryValue" ss:Parent="SummaryLabel">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <NumberFormat ss:Format="0.00"/>
  </Style>
  <Style ss:ID="IssuedDate">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Italic="1"/>
  </Style>
  <Style ss:ID="Signature">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1"/>
  </Style>
  <Style ss:ID="SignatureHint">
   <Alignment ss:Horizontal="Center" ss:Vertical="Top"/>
   <Font ss:FontName="Times New Roman" ss:Size="9.5" ss:Italic="1" ss:Color="#4B5563"/>
  </Style>
 </Styles>`;
}

function infoRow(leftLabel, leftValue, rightLabel, rightValue) {
  return row([
    cell(leftLabel, { style: 'InfoLabel' }),
    cell(leftValue, { style: 'InfoValue', mergeAcross: 1 }),
    cell(rightLabel, { style: 'InfoLabel' }),
    cell(rightValue, { style: 'InfoValue', mergeAcross: 2 }),
  ], 21);
}

export function buildStudentTranscriptXml(data, studentId) {
  const model = createStudentTranscriptModel(data, studentId);
  if (!model.student) throw new Error('Không tìm thấy sinh viên.');
  if (!model.rows.length) throw new Error('Sinh viên chưa có học phần đạt để xuất bảng điểm.');

  const body = [
    row([
      cell(SCHOOL_NAME.toUpperCase(), { style: 'TopLeft', mergeAcross: 2 }),
      cell('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { style: 'TopRight', mergeAcross: 3 }),
    ], 19),
    row([
      cell('PHÒNG ĐÀO TẠO', { style: 'TopLeft', mergeAcross: 2 }),
      cell('Độc lập - Tự do - Hạnh phúc', { style: 'Motto', mergeAcross: 3 }),
    ], 19),
    row([cell('', { style: 'Blank', mergeAcross: 6 })], 8),
    row([cell(model.title, { style: 'Title', mergeAcross: 6 })], 32),
    row([cell('', { style: 'Blank', mergeAcross: 6 })], 7),
    infoRow('Mã sinh viên:', model.student.code || '', 'Họ và tên:', model.student.fullName || ''),
    infoRow('Lớp:', model.classItem?.code || '', 'Ngày sinh:', formatDate(model.student.birthDate)),
    infoRow('Ngành học:', model.major?.name || '', 'Khóa:', model.cohort?.code || model.cohort?.name || ''),
    infoRow('Khoa:', model.faculty?.name || '', 'Trạng thái:', model.statusLabel),
    row([cell('', { style: 'Blank', mergeAcross: 6 })], 8),
    row([
      cell('STT', { style: 'Header' }),
      cell('Mã học phần', { style: 'Header' }),
      cell('Tên học phần', { style: 'Header' }),
      cell('Số TC', { style: 'Header' }),
      cell('Điểm hệ 10', { style: 'Header' }),
      cell('Điểm chữ', { style: 'Header' }),
      cell('Điểm hệ 4', { style: 'Header' }),
    ], 32),
  ];

  let order = 1;
  let dataRowIndex = 0;

  model.groups.forEach((group) => {
    body.push(row([
      cell(semesterLabel(group.semester), { style: 'Semester', mergeAcross: 6 }),
    ], 22));

    group.courses.forEach(({ score, subject }) => {
      const suffix = dataRowIndex % 2 === 0 ? 'Even' : 'Odd';
      body.push(row([
        cell(order, { style: `Center${suffix}`, type: 'Number' }),
        cell(subject.code || '', { style: `Center${suffix}` }),
        cell(subject.name || '', { style: `Text${suffix}` }),
        cell(Number(subject.credits || 0), { style: `Center${suffix}`, type: 'Number' }),
        cell(Number(score.total), { style: `Score${suffix}`, type: 'Number' }),
        cell(score.letter || letterGrade(score.total), { style: `Center${suffix}` }),
        cell(gradePoint4(score.total), { style: `Score${suffix}`, type: 'Number' }),
      ], 25));
      order += 1;
      dataRowIndex += 1;
    });

    const semesterCredits = group.courses.reduce(
      (total, item) => total + Number(item.subject?.credits || 0),
      0,
    );
    body.push(row([
      cell(`Tín chỉ đạt trong học kỳ: ${semesterCredits}`, { style: 'SemesterTotal', mergeAcross: 6 }),
    ], 20));
  });

  body.push(row([cell('', { style: 'Blank', mergeAcross: 6 })], 8));
  body.push(row([
    cell('Tổng số học phần đạt', { style: 'SummaryLabel', mergeAcross: 1 }),
    cell(model.summary.passedSubjects, { style: 'SummaryValue', type: 'Number' }),
    cell('Tổng số tín chỉ tích lũy', { style: 'SummaryLabel', mergeAcross: 2 }),
    cell(model.summary.totalCredits, { style: 'SummaryValue', type: 'Number' }),
  ], 22));
  body.push(row([
    cell('Điểm TBC thang 10', { style: 'SummaryLabel', mergeAcross: 1 }),
    cell(model.summary.average10, { style: 'SummaryValue', type: 'Number' }),
    cell('Điểm TBC thang 4', { style: 'SummaryLabel', mergeAcross: 2 }),
    cell(model.summary.average4, { style: 'SummaryValue', type: 'Number' }),
  ], 22));
  body.push(row([cell('', { style: 'Blank', mergeAcross: 6 })], 9));
  body.push(row([
    cell('', { style: 'Blank', mergeAcross: 2 }),
    cell(issuedDate(), { style: 'IssuedDate', mergeAcross: 3 }),
  ], 20));
  body.push(row([
    cell('', { style: 'Blank', mergeAcross: 2 }),
    cell('PHÒNG ĐÀO TẠO', { style: 'Signature', mergeAcross: 3 }),
  ], 20));
  body.push(row([
    cell('', { style: 'Blank', mergeAcross: 2 }),
    cell('(Ký, ghi rõ họ tên)', { style: 'SignatureHint', mergeAcross: 3 }),
  ], 58));

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>${escapeXml(SCHOOL_NAME)}</Author>
  <Title>${escapeXml(model.title)}</Title>
  <Company>${escapeXml(SCHOOL_NAME)}</Company>
 </DocumentProperties>
 ${styles()}
 <Worksheet ss:Name="${escapeXml(sanitizeSheetName(model.graduated ? 'Bang diem hoan chinh' : 'Bang diem hoc tap'))}">
  <Table ss:DefaultRowHeight="20">
   <Column ss:AutoFitWidth="0" ss:Width="34"/>
   <Column ss:AutoFitWidth="0" ss:Width="72"/>
   <Column ss:AutoFitWidth="0" ss:Width="210"/>
   <Column ss:AutoFitWidth="0" ss:Width="44"/>
   <Column ss:AutoFitWidth="0" ss:Width="62"/>
   <Column ss:AutoFitWidth="0" ss:Width="58"/>
   <Column ss:AutoFitWidth="0" ss:Width="58"/>
   ${body.join('\n   ')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <DoNotDisplayGridlines/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitHorizontal>11</SplitHorizontal>
   <TopRowBottomPane>11</TopRowBottomPane>
   <PageSetup>
    <Layout x:Orientation="Portrait" x:CenterHorizontal="1"/>
    <Footer x:Margin="0.2" x:Data="&amp;RTrang &amp;P / &amp;N"/>
    <PageMargins x:Bottom="0.45" x:Left="0.3" x:Right="0.3" x:Top="0.4"/>
   </PageSetup>
   <FitToPage/>
   <Print>
    <PaperSizeIndex>9</PaperSizeIndex>
    <FitWidth>1</FitWidth>
    <FitHeight>0</FitHeight>
   </Print>
   <Zoom>90</Zoom>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

export function downloadStudentTranscript(data, studentId) {
  const model = createStudentTranscriptModel(data, studentId);
  const xml = buildStudentTranscriptXml(data, studentId);
  const prefix = model.graduated ? 'bang-diem-hoan-chinh' : 'bang-diem-hoc-tap';
  const fileName = `${prefix}-${model.student.code || studentId}.xls`;
  const blob = new Blob([`\ufeff${xml}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
