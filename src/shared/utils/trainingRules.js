import { PASS_SCORE } from '../constants/academic.js';

export function hasScheduleConflict(targetSection, registeredSections) {
  return registeredSections.some((section) =>
    Number(section.id) !== Number(targetSection.id) &&
    Number(section.weekday) === Number(targetSection.weekday) &&
    Number(section.shift) === Number(targetSection.shift)
  );
}

export function findTeachingConflict(candidate, sections) {
  return sections.find((section) => {
    if (Number(section.id) === Number(candidate.id)) return false;
    if (Number(section.semesterId) !== Number(candidate.semesterId)) return false;
    if (
      Number(section.weekday) !== Number(candidate.weekday) ||
      Number(section.shift) !== Number(candidate.shift)
    ) return false;

    return Number(section.lecturerId) === Number(candidate.lecturerId) ||
      Number(section.classId) === Number(candidate.classId) ||
      String(section.room).trim().toLowerCase() === String(candidate.room).trim().toLowerCase();
  });
}

export function attendanceSummary(
  studentId,
  courseSectionId,
  sessions,
  records,
  maxAbsenceRate = 20,
) {
  const sectionSessions = sessions.filter(
    (item) => Number(item.courseSectionId) === Number(courseSectionId),
  );

  if (!sectionSessions.length) {
    return {
      total: 0,
      absent: 0,
      present: 0,
      totalPeriods: 0,
      absentPeriods: 0,
      absenceRate: 0,
      eligible: true,
    };
  }

  const sessionIds = new Set(sectionSessions.map((item) => Number(item.id)));
  const studentRecords = records.filter(
    (item) =>
      Number(item.studentId) === Number(studentId) && sessionIds.has(Number(item.sessionId)),
  );
  const sessionPeriodMap = new Map(
    sectionSessions.map((item) => [Number(item.id), Number(item.periods || 3)]),
  );
  const totalPeriods = sectionSessions.reduce(
    (sum, item) => sum + Number(item.periods || 3),
    0,
  );
  const absentPeriods = studentRecords.reduce((sum, record) => {
    if (record.status !== 'absent') return sum;
    const fallback = sessionPeriodMap.get(Number(record.sessionId)) || 3;
    return sum + Number(record.absentPeriods ?? fallback);
  }, 0);
  const absent = studentRecords.filter((item) => item.status === 'absent').length;
  const present = studentRecords.filter((item) => item.status === 'present').length;
  const absenceRate = totalPeriods
    ? Number(((absentPeriods / totalPeriods) * 100).toFixed(1))
    : 0;

  return {
    total: sectionSessions.length,
    absent,
    present,
    totalPeriods,
    absentPeriods,
    absenceRate,
    eligible: absenceRate <= Number(maxAbsenceRate),
  };
}

export function calculateTotalScore(score, subject) {
  const kt1 = Number(score?.kt1 ?? 0);
  const kt2 = Number(score?.kt2 ?? 0);
  const kt3 = Number(score?.kt3 ?? 0);
  const exam = Number(score?.exam ?? 0);
  const kt1Weight = Number(subject?.kt1Weight ?? 10);
  const kt2Weight = Number(subject?.kt2Weight ?? 15);
  const kt3Weight = Number(subject?.kt3Weight ?? 15);
  const examWeight = Number(subject?.examWeight ?? 60);

  if (kt1Weight + kt2Weight + kt3Weight + examWeight !== 100) return null;

  return Number(
    (
      (kt1 * kt1Weight + kt2 * kt2Weight + kt3 * kt3Weight + exam * examWeight) /
      100
    ).toFixed(2),
  );
}

export function scoreClassification(total) {
  if (total == null || Number.isNaN(Number(total))) return 'Chưa có';
  const value = Number(total);
  if (value >= 8.5) return 'Giỏi';
  if (value >= 7) return 'Khá';
  if (value >= 5.5) return 'Trung bình khá';
  if (value >= 4) return 'Trung bình';
  return 'Kém';
}

export function letterGrade(total) {
  const value = Number(total);
  if (value >= 8.5) return 'A';
  if (value >= 7) return 'B';
  if (value >= 5.5) return 'C';
  if (value >= 4) return 'D';
  return 'F';
}

export function isPassed(total) {
  return Number(total) >= PASS_SCORE;
}

export function calculateWeightedAverage(scores, courseSections = [], subjects = []) {
  const validScores = scores.filter((item) => item.total != null);
  if (!validScores.length) return 0;

  if (!courseSections.length || !subjects.length) {
    const total = validScores.reduce((sum, item) => sum + Number(item.total), 0);
    return Number((total / validScores.length).toFixed(2));
  }

  let weightedTotal = 0;
  let totalCredits = 0;
  for (const score of validScores) {
    const section = courseSections.find(
      (item) => Number(item.id) === Number(score.courseSectionId),
    );
    const subject = subjects.find(
      (item) => Number(item.id) === Number(section?.subjectId),
    );
    const credits = Number(subject?.credits || 0);
    if (!section || !subject || credits <= 0) continue;
    weightedTotal += Number(score.total) * credits;
    totalCredits += credits;
  }

  return totalCredits ? Number((weightedTotal / totalCredits).toFixed(2)) : 0;
}

export function registrationCount(courseSectionId, registrations) {
  return registrations.filter(
    (item) =>
      Number(item.courseSectionId) === Number(courseSectionId) &&
      item.status === 'registered',
  ).length;
}

export function prerequisiteStatus(subject, studentId, subjects, scores, courseSections) {
  const prerequisiteIds = Array.isArray(subject?.prerequisiteIds)
    ? subject.prerequisiteIds.map(Number)
    : [];
  if (!prerequisiteIds.length) return { ok: true, missing: [] };

  const passedSubjectIds = new Set(
    scores
      .filter(
        (score) => Number(score.studentId) === Number(studentId) && isPassed(score.total),
      )
      .map(
        (score) => courseSections.find(
          (section) => Number(section.id) === Number(score.courseSectionId),
        )?.subjectId,
      )
      .filter(Boolean)
      .map(Number),
  );

  const missing = prerequisiteIds
    .filter((id) => !passedSubjectIds.has(id))
    .map(
      (id) => subjects.find((item) => Number(item.id) === id)?.name || `Môn #${id}`,
    );

  return { ok: missing.length === 0, missing };
}

export function validateRegistration({
  studentId,
  section,
  subject,
  registrations,
  courseSections,
  subjects,
  scores,
}) {
  if (!section || section.status !== 'open') {
    return { ok: false, message: 'Lớp học phần không mở đăng ký.' };
  }

  const duplicate = registrations.some(
    (item) =>
      Number(item.studentId) === Number(studentId) &&
      Number(item.courseSectionId) === Number(section.id) &&
      item.status === 'registered',
  );
  if (duplicate) return { ok: false, message: 'Bạn đã đăng ký lớp học phần này.' };

  if (registrationCount(section.id, registrations) >= Number(section.capacity)) {
    return { ok: false, message: 'Lớp học phần đã đủ sĩ số.' };
  }

  const prerequisite = prerequisiteStatus(
    subject,
    studentId,
    subjects,
    scores,
    courseSections,
  );
  if (!prerequisite.ok) {
    return {
      ok: false,
      message: `Chưa đạt môn tiên quyết: ${prerequisite.missing.join(', ')}.`,
    };
  }

  const currentSectionIds = registrations
    .filter(
      (item) => Number(item.studentId) === Number(studentId) && item.status === 'registered',
    )
    .map((item) => Number(item.courseSectionId));
  const currentSections = courseSections.filter(
    (item) =>
      currentSectionIds.includes(Number(item.id)) &&
      Number(item.semesterId) === Number(section.semesterId),
  );

  if (hasScheduleConflict(section, currentSections)) {
    return { ok: false, message: 'Lớp học phần bị trùng lịch với môn đã đăng ký.' };
  }

  return { ok: true, message: '' };
}

function prerequisiteGraph(subjects) {
  return new Map(
    subjects.map((subject) => [
      Number(subject.id),
      (subject.prerequisiteIds || []).map(Number),
    ]),
  );
}

export function findPrerequisitePath(startId, targetId, subjects) {
  const start = Number(startId);
  const target = Number(targetId);
  const graph = prerequisiteGraph(subjects);
  const visited = new Set();

  function walk(id, path) {
    if (id === target) return path;
    if (visited.has(id)) return null;
    visited.add(id);

    for (const next of graph.get(id) || []) {
      const found = walk(next, [...path, next]);
      if (found) return found;
    }
    return null;
  }

  return walk(start, [start]);
}

export function getPrerequisiteCyclePath(candidateId, prerequisiteIds, subjects) {
  if (!candidateId) return null;
  const candidate = Number(candidateId);
  const graph = prerequisiteGraph(subjects);
  graph.set(candidate, (prerequisiteIds || []).map(Number));
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(id) {
    if (visiting.has(id)) {
      const startIndex = stack.indexOf(id);
      return [...stack.slice(startIndex), id];
    }
    if (visited.has(id)) return null;

    visiting.add(id);
    stack.push(id);
    for (const next of graph.get(id) || []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  return visit(candidate);
}

export function hasPrerequisiteCycle(candidateId, prerequisiteIds, subjects) {
  return Boolean(getPrerequisiteCyclePath(candidateId, prerequisiteIds, subjects));
}

export function prerequisiteWouldCreateCycle(candidateId, prerequisiteId, subjects) {
  if (!candidateId || !prerequisiteId) return false;
  return Boolean(findPrerequisitePath(prerequisiteId, candidateId, subjects));
}
