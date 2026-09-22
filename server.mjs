import jsonServer from 'json-server';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATABASE_FILE = path.join(__dirname, 'data', 'db.json');
const DEFAULT_DIST_DIRECTORY = path.join(__dirname, 'dist');
const TOKEN_TTL_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const RESOURCE_NAMES = [
  'users',
  'faculties',
  'majors',
  'cohorts',
  'classes',
  'semesters',
  'lecturers',
  'students',
  'subjects',
  'curricula',
  'courseSections',
  'registrations',
  'attendanceSessions',
  'attendanceRecords',
  'scores',
  'announcements',
];

const runtimeSecret = process.env.AUTH_SECRET || crypto.randomBytes(48).toString('hex');
const loginAttempts = new Map();

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createToken(user) {
  const payload = {
    sub: Number(user.id),
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', runtimeSecret)
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac('sha256', runtimeSecret)
    .update(body)
    .digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.sub || !payload?.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function safeUser(user) {
  if (!user) return null;
  const { password: _password, ...safe } = user;
  return safe;
}

function verifyPassword(password, user) {
  return Boolean(user && String(user.password || '') === String(password || ''));
}

function bearerToken(request) {
  const header = request.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || '';
}

function getUserFromRequest(request, database) {
  const payload = verifyToken(bearerToken(request));
  if (!payload) return null;
  const user = database.get('users').find({ id: Number(payload.sub) }).value();
  if (!user?.active || user.role !== payload.role) return null;
  return user;
}

function publicAnnouncements(announcements, role) {
  return announcements.filter((item) => {
    if (item.audience === 'all') return true;
    return Boolean(role && item.audience === role);
  });
}

function emptySnapshot() {
  return Object.fromEntries(RESOURCE_NAMES.map((resource) => [resource, []]));
}

function snapshotForRole(state, user) {
  const result = emptySnapshot();

  if (user.role === 'admin') {
    for (const resource of RESOURCE_NAMES) {
      result[resource] = Array.isArray(state[resource]) ? state[resource] : [];
    }
    result.users = result.users.map(safeUser);
    return result;
  }

  const commonResources = [
    'faculties',
    'majors',
    'cohorts',
    'classes',
    'semesters',
    'lecturers',
    'subjects',
    'curricula',
  ];
  for (const resource of commonResources) {
    result[resource] = Array.isArray(state[resource]) ? state[resource] : [];
  }
  result.announcements = publicAnnouncements(state.announcements || [], user.role);

  if (user.role === 'lecturer') {
    const sectionIds = new Set(
      (state.courseSections || [])
        .filter((section) => Number(section.lecturerId) === Number(user.lecturerId))
        .map((section) => Number(section.id)),
    );
    const registrations = (state.registrations || []).filter((item) =>
      sectionIds.has(Number(item.courseSectionId)),
    );
    const studentIds = new Set(registrations.map((item) => Number(item.studentId)));
    const sessions = (state.attendanceSessions || []).filter((item) =>
      sectionIds.has(Number(item.courseSectionId)),
    );
    const sessionIds = new Set(sessions.map((item) => Number(item.id)));

    result.courseSections = (state.courseSections || []).filter((item) =>
      sectionIds.has(Number(item.id)),
    );
    result.registrations = registrations;
    result.students = (state.students || []).filter((item) => studentIds.has(Number(item.id)));
    result.attendanceSessions = sessions;
    result.attendanceRecords = (state.attendanceRecords || []).filter((item) =>
      sessionIds.has(Number(item.sessionId)),
    );
    result.scores = (state.scores || []).filter((item) =>
      sectionIds.has(Number(item.courseSectionId)),
    );
    return result;
  }

  if (user.role === 'student') {
    const studentId = Number(user.studentId);
    const ownRegistrations = (state.registrations || []).filter(
      (item) => Number(item.studentId) === studentId,
    );
    const ownRegisteredSectionIds = new Set(
      ownRegistrations
        .filter((item) => item.status === 'registered')
        .map((item) => Number(item.courseSectionId)),
    );
    const sessions = (state.attendanceSessions || []).filter((item) =>
      ownRegisteredSectionIds.has(Number(item.courseSectionId)),
    );
    const sessionIds = new Set(sessions.map((item) => Number(item.id)));

    result.students = (state.students || []).filter((item) => Number(item.id) === studentId);
    result.courseSections = state.courseSections || [];
    result.registrations = (state.registrations || []).map((item) =>
      Number(item.studentId) === studentId
        ? item
        : {
            id: item.id,
            courseSectionId: item.courseSectionId,
            status: item.status,
          },
    );
    result.attendanceSessions = sessions;
    result.attendanceRecords = (state.attendanceRecords || []).filter(
      (item) => Number(item.studentId) === studentId && sessionIds.has(Number(item.sessionId)),
    );
    result.scores = (state.scores || []).filter((item) => Number(item.studentId) === studentId);
  }

  return result;
}

function getRecord(database, resource, id) {
  if (!id) return null;
  return database.get(resource).find({ id: Number(id) }).value() || null;
}

function lecturerOwnsSection(database, lecturerId, sectionId) {
  const section = getRecord(database, 'courseSections', sectionId);
  return Boolean(section && Number(section.lecturerId) === Number(lecturerId));
}

function lecturerCanMutate(database, request, user, resource, id) {
  const existing = getRecord(database, resource, id);
  const candidate = { ...(existing || {}), ...(request.body || {}) };

  if (resource === 'scores') {
    if (!lecturerOwnsSection(database, user.lecturerId, candidate.courseSectionId)) return false;
    return database
      .get('registrations')
      .value()
      .some(
        (item) =>
          Number(item.studentId) === Number(candidate.studentId) &&
          Number(item.courseSectionId) === Number(candidate.courseSectionId) &&
          item.status === 'registered',
      );
  }

  if (resource === 'attendanceSessions') {
    return lecturerOwnsSection(database, user.lecturerId, candidate.courseSectionId);
  }

  if (resource === 'attendanceRecords') {
    const session = getRecord(database, 'attendanceSessions', candidate.sessionId);
    if (!session || !lecturerOwnsSection(database, user.lecturerId, session.courseSectionId)) {
      return false;
    }
    return database
      .get('registrations')
      .value()
      .some(
        (item) =>
          Number(item.studentId) === Number(candidate.studentId) &&
          Number(item.courseSectionId) === Number(session.courseSectionId) &&
          item.status === 'registered',
      );
  }

  return false;
}

function normalizeLecturerMutation(database, request, resource, id) {
  if (resource === 'scores') {
    const existing = getRecord(database, resource, id);
    const candidate = { ...(existing || {}), ...(request.body || {}) };
    const section = getRecord(database, 'courseSections', candidate.courseSectionId);
    const subject = getRecord(database, 'subjects', section?.subjectId);
    const attendance = Number(candidate.attendance);
    const midterm = Number(candidate.midterm);
    const final = Number(candidate.final);
    if (![attendance, midterm, final].every((value) => Number.isFinite(value) && value >= 0 && value <= 10)) {
      throw new Error('Điểm phải nằm trong khoảng từ 0 đến 10.');
    }
    const attendanceWeight = Number(subject?.attendanceWeight ?? 10);
    const midtermWeight = Number(subject?.midtermWeight ?? 30);
    const finalWeight = Number(subject?.finalWeight ?? 60);
    if (attendanceWeight + midtermWeight + finalWeight !== 100) {
      throw new Error('Trọng số điểm của môn học phải bằng 100%.');
    }
    const total = Number(
      ((attendance * attendanceWeight + midterm * midtermWeight + final * finalWeight) / 100).toFixed(2),
    );
    request.body = {
      ...candidate,
      attendance,
      midterm,
      final,
      total,
      letter: total >= 8.5 ? 'A' : total >= 7 ? 'B' : total >= 5.5 ? 'C' : total >= 4 ? 'D' : 'F',
      classification:
        total >= 8.5
          ? 'Giỏi'
          : total >= 7
            ? 'Khá'
            : total >= 5.5
              ? 'Trung bình khá'
              : total >= 4
                ? 'Trung bình'
                : 'Kém',
    };
  }
}

function studentCanMutateRegistration(database, request, user, id) {
  const ownStudentId = Number(user.studentId);
  const existing = getRecord(database, 'registrations', id);
  if (existing && Number(existing.studentId) !== ownStudentId) return false;

  const candidate = { ...(existing || {}), ...(request.body || {}), studentId: ownStudentId };
  const section = getRecord(database, 'courseSections', candidate.courseSectionId);
  if (!section) return false;

  const semester = getRecord(database, 'semesters', section.semesterId);
  const today = new Date().toISOString().slice(0, 10);
  if (
    !semester?.active ||
    today < String(semester.registrationStart || '') ||
    today > String(semester.registrationEnd || '')
  ) {
    return false;
  }

  if (request.method === 'POST') {
    if (section.status !== 'open') return false;

    const registrations = database.get('registrations').value();
    const duplicated = registrations.some(
      (item) =>
        Number(item.studentId) === ownStudentId &&
        Number(item.courseSectionId) === Number(section.id) &&
        item.status === 'registered',
    );
    if (duplicated) return false;
    const count = registrations.filter(
      (item) => Number(item.courseSectionId) === Number(section.id) && item.status === 'registered',
    ).length;
    if (count >= Number(section.capacity)) return false;

    const student = getRecord(database, 'students', ownStudentId);
    const classItem = getRecord(database, 'classes', student?.classId);
    const curriculum = database
      .get('curricula')
      .value()
      .find(
        (item) =>
          item.active && Number(item.majorId) === Number(classItem?.majorId),
      );
    if (!(curriculum?.subjectIds || []).map(Number).includes(Number(section.subjectId))) {
      return false;
    }

    const subject = getRecord(database, 'subjects', section.subjectId);
    const prerequisiteIds = (subject?.prerequisiteIds || []).map(Number);
    if (prerequisiteIds.length) {
      const passedSubjectIds = new Set(
        database
          .get('scores')
          .value()
          .filter((score) => Number(score.studentId) === ownStudentId && Number(score.total) >= 4)
          .map((score) => getRecord(database, 'courseSections', score.courseSectionId)?.subjectId)
          .filter(Boolean)
          .map(Number),
      );
      if (prerequisiteIds.some((subjectId) => !passedSubjectIds.has(subjectId))) return false;
    }

    const registeredSectionIds = registrations
      .filter((item) => Number(item.studentId) === ownStudentId && item.status === 'registered')
      .map((item) => Number(item.courseSectionId));
    const hasConflict = database
      .get('courseSections')
      .value()
      .some(
        (item) =>
          registeredSectionIds.includes(Number(item.id)) &&
          Number(item.semesterId) === Number(section.semesterId) &&
          Number(item.weekday) === Number(section.weekday) &&
          Number(item.shift) === Number(section.shift),
      );
    if (hasConflict) return false;
  }

  request.body = {
    ...candidate,
    studentId: ownStudentId,
    status: candidate.status === 'cancelled' ? 'cancelled' : 'registered',
  };
  return true;
}

function cleanLoginAttempts(now = Date.now()) {
  for (const [key, value] of loginAttempts.entries()) {
    if (now - value.startedAt > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}

function loginKey(request) {
  return String(request.ip || request.socket?.remoteAddress || 'unknown');
}

function loginAllowed(request) {
  const now = Date.now();
  cleanLoginAttempts(now);
  const key = loginKey(request);
  const current = loginAttempts.get(key);
  if (!current) return true;
  return current.count < LOGIN_MAX_ATTEMPTS || now - current.startedAt > LOGIN_WINDOW_MS;
}

function recordLoginFailure(request) {
  const now = Date.now();
  const key = loginKey(request);
  const current = loginAttempts.get(key);
  if (!current || now - current.startedAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, startedAt: now });
    return;
  }
  loginAttempts.set(key, { ...current, count: current.count + 1 });
}

function clearLoginFailures(request) {
  loginAttempts.delete(loginKey(request));
}

function apiError(response, status, message) {
  response.status(status).json({ message });
}

export function createApplication({
  databaseFile = DEFAULT_DATABASE_FILE,
  distDirectory = DEFAULT_DIST_DIRECTORY,
  serveFrontend = false,
  production = false,
} = {}) {
  const app = jsonServer.create();
  const apiRouter = jsonServer.router(databaseFile);
  const database = apiRouter.db;

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    if (request.path.startsWith('/api')) response.setHeader('Cache-Control', 'no-store');
    if (production) {
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
      );
    }
    next();
  });

  app.use(jsonServer.bodyParser);
  app.use('/api', jsonServer.defaults({ logger: false }));

  app.post('/api/auth/login', (request, response) => {
    if (!loginAllowed(request)) {
      apiError(response, 429, 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau vài phút.');
      return;
    }

    const username = String(request.body?.username || '').trim().toLowerCase();
    const password = String(request.body?.password || '');
    const user = database
      .get('users')
      .value()
      .find((item) => String(item.username).toLowerCase() === username);

    if (!user?.active || !verifyPassword(password, user)) {
      recordLoginFailure(request);
      apiError(response, 401, 'Tên đăng nhập hoặc mật khẩu không đúng.');
      return;
    }

    clearLoginFailures(request);
    response.json({ user: safeUser(user), token: createToken(user) });
  });

  app.get('/api/public-info', (request, response) => {
    const state = database.getState();
    const authenticated = getUserFromRequest(request, database);
    response.json({
      faculties: state.faculties || [],
      majors: state.majors || [],
      subjects: state.subjects || [],
      curricula: (state.curricula || []).filter((item) => item.active),
      announcements: publicAnnouncements(state.announcements || [], authenticated?.role),
    });
  });

  app.use('/api', (request, response, next) => {
    const user = getUserFromRequest(request, database);
    if (!user) {
      apiError(response, 401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
      return;
    }
    request.authUser = user;
    next();
  });

  app.get('/api/auth/me', (request, response) => {
    response.json({ user: safeUser(request.authUser) });
  });

  app.get('/api/snapshot', (request, response) => {
    response.json(snapshotForRole(database.getState(), request.authUser));
  });

  app.use('/api/users', (request, response, next) => {
    if (request.authUser.role !== 'admin') {
      apiError(response, 403, 'Bạn không có quyền quản lý tài khoản.');
      return;
    }

    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      next();
      return;
    }

    try {
      const id = request.path.split('/').filter(Boolean)[0];
      const existing = getRecord(database, 'users', id);
      const nextUser = { ...(existing || {}), ...(request.body || {}) };
      nextUser.username = String(nextUser.username || '').trim().toLowerCase();
      if (!nextUser.username || !['admin', 'lecturer', 'student'].includes(nextUser.role)) {
        throw new Error('Tài khoản hoặc vai trò không hợp lệ.');
      }

      const duplicated = database
        .get('users')
        .value()
        .some(
          (item) =>
            Number(item.id) !== Number(existing?.id) &&
            String(item.username).toLowerCase() === nextUser.username,
        );
      if (duplicated) throw new Error('Tên đăng nhập đã tồn tại.');

      if (!existing && !String(nextUser.password || '').trim()) {
        throw new Error('Tài khoản mới phải có mật khẩu.');
      }

      if (existing && request.body?.password === '') {
        nextUser.password = existing.password;
      }

      request.body = nextUser;
      next();
    } catch (error) {
      apiError(response, 400, error.message || 'Dữ liệu tài khoản không hợp lệ.');
    }
  });

  app.use('/api', (request, response, next) => {
    const segments = request.path.split('/').filter(Boolean);
    const resource = segments[0];
    const id = segments[1];
    if (!RESOURCE_NAMES.includes(resource)) {
      next();
      return;
    }

    const role = request.authUser.role;
    if (role === 'admin') {
      next();
      return;
    }

    if (request.method === 'GET') {
      apiError(response, 403, 'Hãy sử dụng dữ liệu theo phạm vi tài khoản hiện tại.');
      return;
    }

    if (role === 'lecturer' && ['scores', 'attendanceSessions', 'attendanceRecords'].includes(resource)) {
      if (!lecturerCanMutate(database, request, request.authUser, resource, id)) {
        apiError(response, 403, 'Bạn chỉ được cập nhật dữ liệu của lớp học phần mình phụ trách.');
        return;
      }
      try {
        normalizeLecturerMutation(database, request, resource, id);
        next();
      } catch (error) {
        apiError(response, 400, error.message || 'Dữ liệu cập nhật không hợp lệ.');
      }
      return;
    }

    if (role === 'student' && resource === 'registrations' && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (!studentCanMutateRegistration(database, request, request.authUser, id)) {
        apiError(response, 403, 'Đăng ký học phần không hợp lệ hoặc không thuộc tài khoản hiện tại.');
        return;
      }
      next();
      return;
    }

    apiError(response, 403, 'Bạn không có quyền thực hiện thao tác này.');
  });

  apiRouter.render = (request, response) => {
    const data = response.locals.data;
    if (request.path === '/users' || request.path.startsWith('/users/')) {
      response.jsonp(Array.isArray(data) ? data.map(safeUser) : safeUser(data));
      return;
    }
    response.jsonp(data);
  };

  app.use('/api', apiRouter);

  if (serveFrontend) {
    app.use(jsonServer.defaults({ static: distDirectory, logger: false }));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(distDirectory, 'index.html'));
    });
  }

  return app;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const port = Number(process.env.PORT ?? 10000);
  const app = createApplication({ serveFrontend: true, production: true });
  app.listen(port, '0.0.0.0', () => {
    console.log(`Ứng dụng đang chạy tại cổng ${port}`);
  });
}
