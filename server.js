const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { AlignmentType, Document, HeadingLevel, Packer, Paragraph } = require('docx');
const Database = require('better-sqlite3');
const { rateLimit } = require('express-rate-limit');

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';
const database = new Database(path.join(__dirname, 'idh.sqlite'));
const sessions = new Map();
const permissionKeys = new Set(['projects', 'clients', 'employees', 'offers', 'tenders', 'reports', 'dataCenter', 'users', 'settings']);
const sessionIdleTimeoutMs = 30 * 60 * 1000;
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'محاولات تسجيل الدخول كثيرة. حاول بعد 15 دقيقة.' }
});
const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'طلبات التسجيل كثيرة. حاول بعد 15 دقيقة.' }
});
const otpDeliveryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'طلبات إرسال رمز التحقق كثيرة. حاول بعد 15 دقيقة.' }
});

app.disable('x-powered-by');
app.use('/api/data-center/export', express.json({ limit: '5mb' }));
app.use(express.json({ limit: '32kb' }));
app.use((request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    next();
});
app.get(['/', '/index.html'], (request, response) => response.sendFile(path.join(__dirname, 'index.html')));
app.get('/app.js', (request, response) => response.sendFile(path.join(__dirname, 'app.js')));
app.get('/styles.css', (request, response) => response.sendFile(path.join(__dirname, 'styles.css')));
app.get('/idh-logo.svg', (request, response) => response.sendFile(path.join(__dirname, 'idh-logo.svg')));

database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
        email TEXT,
    role TEXT NOT NULL DEFAULT 'مستخدم',
    permissions TEXT NOT NULL DEFAULT 'صلاحيات محددة',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
    CREATE TABLE IF NOT EXISTS account_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS otp_challenges (
        id TEXT PRIMARY KEY,
        purpose TEXT NOT NULL,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS system_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

if (!database.pragma('table_info(users)').some((column) => column.name === 'email')) {
    database.exec('ALTER TABLE users ADD COLUMN email TEXT');
}
if (!database.pragma('table_info(account_requests)').some((column) => column.name === 'email')) {
    database.exec('ALTER TABLE account_requests ADD COLUMN email TEXT');
}
database.prepare('DELETE FROM otp_challenges WHERE expires_at <= ?').run(Date.now());

const initialAdminUsername = (process.env.INITIAL_ADMIN_USERNAME || 'ENGHAJAM').trim();
if (!/^[A-Za-z0-9_.-]{3,32}$/.test(initialAdminUsername)) {
    throw new Error('INITIAL_ADMIN_USERNAME must be 3-32 letters, numbers, dots, underscores, or hyphens.');
}
let admin = database.prepare('SELECT id, password_hash FROM users WHERE username = ?').get(initialAdminUsername);
if (!admin && initialAdminUsername !== 'ENGFT') {
    const legacyAdmin = database.prepare('SELECT id, password_hash FROM users WHERE username = ?').get('ENGFT');
    if (legacyAdmin) {
        database.prepare('UPDATE users SET username = ? WHERE id = ?').run(initialAdminUsername, legacyAdmin.id);
        admin = { ...legacyAdmin, username: initialAdminUsername };
    }
}
const configuredInitialPassword = process.env.INITIAL_ADMIN_PASSWORD;
if (configuredInitialPassword && configuredInitialPassword.length < 12) {
    throw new Error('INITIAL_ADMIN_PASSWORD must be at least 12 characters.');
}
const adminNeedsBootstrap = !admin || bcrypt.compareSync('ENG2026', admin.password_hash);
if (adminNeedsBootstrap) {
    if (process.env.NODE_ENV === 'production' && !configuredInitialPassword) {
        throw new Error('Set INITIAL_ADMIN_PASSWORD before first production startup or before rotating the default admin password.');
    }
    const bootstrapPassword = configuredInitialPassword || crypto.randomBytes(24).toString('base64url');
    if (admin) {
        database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(bootstrapPassword, 12), admin.id);
    } else {
        database.prepare('INSERT INTO users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)')
            .run(initialAdminUsername, bcrypt.hashSync(bootstrapPassword, 12), 'مدير النظام', 'كامل الصلاحيات');
    }
    if (!configuredInitialPassword) console.warn(`One-time initial password for ${initialAdminUsername}: ${bootstrapPassword}`);
}

function authenticate(request, response, next) {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const session = token && sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
        if (token) sessions.delete(token);
        return response.status(401).json({ error: 'انتهت الجلسة. سجّل الدخول مجددًا.' });
    }
    session.expiresAt = Date.now() + sessionIdleTimeoutMs;
    request.user = session;
    request.sessionToken = token;
    next();
}

function audit(username, action) {
    database.prepare('INSERT INTO audit_log (username, action) VALUES (?, ?)').run(username, action);
}

function parsePermissions(value) {
    if (Array.isArray(value)) return value.filter((permission) => permission === '*' || permissionKeys.has(permission));
    if (value === 'كامل الصلاحيات') return ['*'];
    if (typeof value !== 'string' || !value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((permission) => permission === '*' || permissionKeys.has(permission));
    } catch (error) {
        const legacyLabels = {
            projects: /مشاريع|projects?/i,
            clients: /عملاء|clients?/i,
            employees: /موظف|موارد بشرية|employees?|\bHR\b/i,
            offers: /عروض|offers?/i,
            tenders: /مناقصات|tenders?/i,
            reports: /تقارير|reports?/i,
            dataCenter: /مركز البيانات|data center/i,
            users: /مستخدمون|users?/i,
            settings: /إعدادات|settings?/i
        };
        return Object.entries(legacyLabels).filter(([, pattern]) => pattern.test(value)).map(([permission]) => permission);
    }
    return [];
}

function hasPermission(user, permission) {
    const permissions = parsePermissions(user.permissions);
    return permissions.includes('*') || permissions.includes(permission);
}

function requirePermission(request, response, permission) {
    if (hasPermission(request.user, permission)) return true;
    response.status(403).json({ error: 'ليس لديك صلاحية للوصول إلى هذا القسم.' });
    return false;
}

async function requestGoogleScript(action, data = {}) {
    const endpoint = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    const secret = process.env.GOOGLE_SHEETS_SHARED_SECRET;
    if (!endpoint || !secret) {
        const error = new Error('Google Apps Script غير مهيأ. أضف رابط النشر والمفتاح السري إلى إعدادات الخادم.');
        error.status = 503;
        throw error;
    }
    const endpointUrl = new URL(endpoint);
    if (endpointUrl.protocol !== 'https:' || endpointUrl.hostname !== 'script.google.com') {
        const error = new Error('رابط Google Apps Script غير صالح.');
        error.status = 500;
        throw error;
    }
    const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data, secret }),
        signal: AbortSignal.timeout(12000)
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
        const error = new Error(result.error || 'تعذر تنفيذ طلب Google Apps Script.');
        error.status = 502;
        throw error;
    }
    return result;
}

async function requestEmployeeSheet(action, employee) {
    return requestGoogleScript(action, { employee });
}

function isValidEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email) {
    const [localPart, domain] = email.split('@');
    return `${localPart.slice(0, 1)}***@${domain}`;
}

async function createOtpChallenge({ purpose, username, email, passwordHash = null }) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const challengeId = crypto.randomBytes(24).toString('hex');
    database.prepare('DELETE FROM otp_challenges WHERE expires_at <= ?').run(Date.now());
    database.prepare('DELETE FROM otp_challenges WHERE username = ? AND purpose = ?').run(username, purpose);
    database.prepare(`INSERT INTO otp_challenges
        (id, purpose, username, email, password_hash, code_hash, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(challengeId, purpose, username, email, passwordHash, bcrypt.hashSync(code, 10), Date.now() + 10 * 60 * 1000);
    try {
        await requestGoogleScript('sendOtpEmail', { email, code, purpose });
    } catch (error) {
        database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challengeId);
        throw error;
    }
    return { challengeId, email: maskEmail(email), expiresIn: 600 };
}

function verifyOtpChallenge(challengeId, code, allowedPurposes) {
    if (!/^[a-f0-9]{48}$/.test(String(challengeId || '')) || !/^\d{6}$/.test(String(code || ''))) {
        const error = new Error('رمز التحقق غير صالح أو انتهت صلاحيته.');
        error.status = 400;
        throw error;
    }
    const challenge = database.prepare('SELECT * FROM otp_challenges WHERE id = ?').get(challengeId);
    if (!challenge || !allowedPurposes.includes(challenge.purpose)) {
        const error = new Error('رمز التحقق غير صالح أو انتهت صلاحيته.');
        error.status = 400;
        throw error;
    }
    if (challenge.expires_at <= Date.now()) {
        database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challengeId);
        const error = new Error('انتهت صلاحية الرمز. اطلب رمزًا جديدًا.');
        error.status = 410;
        throw error;
    }
    if (!bcrypt.compareSync(code, challenge.code_hash)) {
        const attempts = challenge.attempts + 1;
        if (attempts >= 5) database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challengeId);
        else database.prepare('UPDATE otp_challenges SET attempts = ? WHERE id = ?').run(attempts, challengeId);
        const error = new Error(attempts >= 5 ? 'تجاوزت عدد المحاولات. اطلب رمزًا جديدًا.' : 'رمز التحقق غير صحيح.');
        error.status = 400;
        throw error;
    }
    return challenge;
}

function requireAdmin(request, response) {
    if (hasPermission(request.user, '*')) return true;
    response.status(403).json({ error: 'ليس لديك صلاحية' });
    return false;
}

const requestApprovalRoles = {
    hr: { role: 'مسؤول الموارد البشرية', permissions: ['employees'] },
    projectManager: { role: 'مدير المشاريع', permissions: ['projects', 'offers', 'tenders', 'reports'] },
    accountant: { role: 'المحاسب', permissions: ['offers', 'reports'] }
};

app.post('/api/register/request-otp', registrationLimiter, async (request, response) => {
    const username = String(request.body?.username || '').trim();
    const password = String(request.body?.password || '');
    const email = String(request.body?.email || '').trim().toLowerCase();
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
        return response.status(400).json({ error: 'اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفًا أو رقمًا، ويمكن استخدام النقطة والشرطة.' });
    }
    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        return response.status(400).json({ error: 'كلمة المرور يجب أن تكون 12 حرفًا على الأقل ولا تتجاوز 72 بايتًا.' });
    }
    if (!isValidEmail(email)) return response.status(400).json({ error: 'أدخل بريدًا إلكترونيًا صالحًا لاستلام رمز التحقق.' });
    const existingUser = database.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (existingUser) return response.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل.' });
    if (database.prepare('SELECT id FROM account_requests WHERE username = ? COLLATE NOCASE').get(username)) {
        return response.status(409).json({ error: 'يوجد طلب تسجيل بهذا الاسم بالفعل.' });
    }
    try {
        const challenge = await createOtpChallenge({
            purpose: 'registration', username, email, passwordHash: bcrypt.hashSync(password, 12)
        });
        response.json({ ...challenge, message: `أرسلنا رمز التحقق إلى ${challenge.email}.` });
    } catch (error) {
        response.status(error.status || 502).json({ error: error.message || 'تعذر إرسال رمز التحقق.' });
    }
});

app.post('/api/register/verify-otp', registrationLimiter, (request, response) => {
    let challenge;
    try {
        challenge = verifyOtpChallenge(request.body?.challengeId, request.body?.code, ['registration']);
    } catch (error) {
        return response.status(error.status || 400).json({ error: error.message });
    }
    if (database.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(challenge.username)
        || database.prepare('SELECT id FROM account_requests WHERE username = ? COLLATE NOCASE').get(challenge.username)) {
        database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challenge.id);
        return response.status(409).json({ error: 'اسم المستخدم أصبح مستخدمًا بالفعل.' });
    }
    const saveRequest = database.transaction(() => {
        database.prepare('INSERT INTO account_requests (username, email, password_hash) VALUES (?, ?, ?)')
            .run(challenge.username, challenge.email, challenge.password_hash);
        database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challenge.id);
    });
    try {
        saveRequest();
        response.status(202).json({ message: 'تم تأكيد البريد وإرسال طلبك للمدير لاعتماد الحساب.' });
    } catch (error) {
        response.status(409).json({ error: 'تعذر إنشاء الطلب؛ تحقق من اسم المستخدم وحاول مجددًا.' });
    }
});

app.post('/api/login', loginLimiter, otpDeliveryLimiter, async (request, response) => {
    const username = String(request.body?.username || '').trim();
    const password = String(request.body?.password || '');
    const user = database.prepare('SELECT id, username, password_hash, email, role, permissions FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) return response.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    const googleOtpConfigured = Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL && process.env.GOOGLE_SHEETS_SHARED_SECRET);
    if (!googleOtpConfigured) {
        const token = crypto.randomBytes(32).toString('hex');
        const account = { id: user.id, username: user.username, role: user.role, permissions: parsePermissions(user.permissions) };
        sessions.set(token, { ...account, expiresAt: Date.now() + sessionIdleTimeoutMs });
        audit(user.username, 'تسجيل الدخول المباشر دون OTP');
        return response.json({ token, user: account, message: 'تم تسجيل الدخول بنجاح.' });
    }

    if (!user.email) return response.status(428).json({ needsEmailSetup: true, username: user.username });
    try {
        const challenge = await createOtpChallenge({ purpose: 'login', username: user.username, email: user.email });
        response.json({ requiresOtp: true, ...challenge, message: `أرسلنا رمز الدخول إلى ${challenge.email}.` });
    } catch (error) {
        response.status(error.status || 502).json({ error: error.message || 'تعذر إرسال رمز الدخول.' });
    }
});

app.post('/api/password-reset/request', loginLimiter, otpDeliveryLimiter, async (request, response) => {
    const username = String(request.body?.username || '').trim();
    if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
        return response.status(400).json({ error: 'اسم المستخدم غير صالح.' });
    }
    const user = database.prepare('SELECT id, username, email FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (!user) return response.status(404).json({ error: 'لا يوجد حساب بهذا الاسم.' });
    if (!user.email) return response.status(428).json({ error: 'هذا الحساب لا يملك بريدًا موثقًا. أضف بريدًا أولاً من خلال تسجيل الدخول.' });
    try {
        const challenge = await createOtpChallenge({ purpose: 'password_reset', username: user.username, email: user.email });
        response.json({ challengeId: challenge.challengeId, email: challenge.email, message: `أرسلنا رمز استعادة كلمة المرور إلى ${challenge.email}.` });
    } catch (error) {
        response.status(error.status || 502).json({ error: error.message || 'تعذر إرسال رمز استعادة كلمة المرور.' });
    }
});

app.post('/api/password-reset/verify', loginLimiter, (request, response) => {
    const newPassword = String(request.body?.newPassword || '');
    const challengeId = String(request.body?.challengeId || '');
    const code = String(request.body?.code || '');
    if (!newPassword || newPassword.length < 12) {
        return response.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل.' });
    }
    let challenge;
    try {
        challenge = verifyOtpChallenge(challengeId, code, ['password_reset']);
    } catch (error) {
        return response.status(error.status || 400).json({ error: error.message || 'رمز الاستعادة غير صالح.' });
    }
    const user = database.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(challenge.username);
    if (!user) {
        database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challenge.id);
        return response.status(404).json({ error: 'الحساب غير موجود.' });
    }
    database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 12), user.id);
    database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challenge.id);
    audit(challenge.username, 'إعادة تعيين كلمة المرور عبر البريد الإلكتروني');
    response.json({ message: 'تمت إعادة تعيين كلمة المرور بنجاح.' });
});

app.post('/api/login/enroll-email', loginLimiter, otpDeliveryLimiter, async (request, response) => {
    const username = String(request.body?.username || '').trim();
    const password = String(request.body?.password || '');
    const email = String(request.body?.email || '').trim().toLowerCase();
    const user = database.prepare('SELECT id, username, password_hash, email FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return response.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
    }
    if (user.email) return response.status(409).json({ error: 'للحساب بريد مسجل بالفعل. سجّل الدخول لطلب رمز جديد.' });
    if (!isValidEmail(email)) return response.status(400).json({ error: 'أدخل بريدًا إلكترونيًا صالحًا.' });
    try {
        const challenge = await createOtpChallenge({ purpose: 'email_enrollment', username: user.username, email });
        response.json({ requiresOtp: true, ...challenge, message: `أرسلنا رمز التحقق إلى ${challenge.email}.` });
    } catch (error) {
        response.status(error.status || 502).json({ error: error.message || 'تعذر إرسال رمز التحقق.' });
    }
});

app.post('/api/login/verify-otp', (request, response) => {
    let challenge;
    try {
        challenge = verifyOtpChallenge(request.body?.challengeId, request.body?.code, ['login', 'email_enrollment']);
    } catch (error) {
        return response.status(error.status || 400).json({ error: error.message });
    }
    const user = database.prepare('SELECT id, username, email, role, permissions FROM users WHERE username = ?').get(challenge.username);
    if (!user || (challenge.purpose === 'login' && user.email !== challenge.email)
        || (challenge.purpose === 'email_enrollment' && user.email)) {
        database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challenge.id);
        return response.status(401).json({ error: 'تعذر التحقق من الحساب. ابدأ تسجيل الدخول مجددًا.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const account = { id: user.id, username: user.username, role: user.role, permissions: parsePermissions(user.permissions) };
    const finishLogin = database.transaction(() => {
        if (challenge.purpose === 'email_enrollment') {
            database.prepare('UPDATE users SET email = ? WHERE id = ?').run(challenge.email, user.id);
            audit(user.username, 'تفعيل البريد والتحقق بخطوتين');
        } else {
            audit(user.username, 'تسجيل الدخول مع OTP');
        }
        database.prepare('DELETE FROM otp_challenges WHERE id = ?').run(challenge.id);
    });
    finishLogin();
    sessions.set(token, { ...account, expiresAt: Date.now() + sessionIdleTimeoutMs });
    response.json({ token, user: account });
});

app.post('/api/logout', authenticate, (request, response) => {
    sessions.delete(request.sessionToken);
    response.json({ message: 'تم تسجيل الخروج بنجاح' });
});

app.get('/api/users', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const users = database.prepare('SELECT id, username, email, role, permissions, created_at FROM users ORDER BY id DESC').all();
    response.json(users.map((user) => ({ ...user, permissions: parsePermissions(user.permissions) })));
});

app.get('/api/account-requests', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const requests = database.prepare('SELECT id, username, email, created_at FROM account_requests ORDER BY id ASC').all();
    response.json(requests);
});

app.post('/api/account-requests/:id/approve', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const requestId = Number(request.params.id);
    const approval = requestApprovalRoles[request.body?.roleKey];
    if (!Number.isSafeInteger(requestId) || requestId < 1 || !approval) {
        return response.status(400).json({ error: 'طلب الاعتماد أو الدور غير صالح.' });
    }
    const accountRequest = database.prepare('SELECT id, username, email, password_hash FROM account_requests WHERE id = ?').get(requestId);
    if (!accountRequest) return response.status(404).json({ error: 'طلب التسجيل غير موجود أو تمت مراجعته.' });
    if (!isValidEmail(accountRequest.email || '')) return response.status(400).json({ error: 'طلب الحساب لا يحتوي بريدًا موثقًا صالحًا.' });
    if (database.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(accountRequest.username)) {
        database.prepare('DELETE FROM account_requests WHERE id = ?').run(requestId);
        return response.status(409).json({ error: 'اسم المستخدم أصبح مستخدمًا. حُذف الطلب المتعارض.' });
    }
    try {
        const approveRequest = database.transaction(() => {
            database.prepare('INSERT INTO users (username, password_hash, email, role, permissions) VALUES (?, ?, ?, ?, ?)')
                .run(accountRequest.username, accountRequest.password_hash, accountRequest.email, approval.role, JSON.stringify(approval.permissions));
            database.prepare('DELETE FROM account_requests WHERE id = ?').run(requestId);
            audit(request.user.username, `اعتماد حساب المستخدم ${accountRequest.username}`);
        });
        approveRequest();
        response.json({ message: `تم اعتماد حساب ${accountRequest.username}.` });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return response.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل.' });
        }
        throw error;
    }
});

app.delete('/api/account-requests/:id', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const requestId = Number(request.params.id);
    if (!Number.isSafeInteger(requestId) || requestId < 1) return response.status(400).json({ error: 'رقم الطلب غير صالح.' });
    const result = database.prepare('DELETE FROM account_requests WHERE id = ?').run(requestId);
    if (!result.changes) return response.status(404).json({ error: 'طلب التسجيل غير موجود أو تمت مراجعته.' });
    audit(request.user.username, 'رفض طلب تسجيل حساب');
    response.json({ message: 'تم رفض طلب التسجيل.' });
});

app.post('/api/users', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const { username, password, email, role } = request.body;
    const permissions = parsePermissions(request.body.permissions);
    if (!username || !password || password.length < 12) return response.status(400).json({ error: 'اسم المستخدم مطلوب وكلمة المرور يجب أن تتكون من 12 حرفًا على الأقل.' });
    if (!isValidEmail(String(email || '').trim())) return response.status(400).json({ error: 'البريد الإلكتروني مطلوب لاستلام رموز OTP.' });
    if (!permissions.length) return response.status(400).json({ error: 'اختر صلاحية واحدة على الأقل.' });
    if (permissions.includes('*') && permissions.length > 1) return response.status(400).json({ error: 'لا يمكن الجمع بين صلاحية كاملة وصلاحيات أقسام منفصلة.' });
    try {
        const result = database.prepare('INSERT INTO users (username, password_hash, email, role, permissions) VALUES (?, ?, ?, ?, ?)')
            .run(username, bcrypt.hashSync(password, 12), String(email).trim().toLowerCase(), role || 'مستخدم', JSON.stringify(permissions));
        audit(request.user.username, `إضافة المستخدم ${username}`);
        response.status(201).json({ id: result.lastInsertRowid, username, role: role || 'مستخدم', permissions });
    } catch (error) {
        response.status(409).json({ error: 'اسم المستخدم مستخدم مسبقًا' });
    }
});

app.get('/api/employees', authenticate, async (request, response) => {
    if (!hasPermission(request.user, 'employees') && !hasPermission(request.user, 'dataCenter')) {
        return response.status(403).json({ error: 'ليس لديك صلاحية لعرض بيانات الموظفين.' });
    }
    try {
        const result = await requestEmployeeSheet('listEmployees');
        response.json({ employees: result.employees || [] });
    } catch (error) {
        response.status(error.status || 502).json({ error: error.message || 'تعذر تحميل بيانات الموظفين' });
    }
});

app.post('/api/employees', authenticate, async (request, response) => {
    if (!requirePermission(request, response, 'employees')) return;
    const { name, department, position, phone, email, startDate, status } = request.body;
    const employeeName = String(name || '').trim();
    const employeeDepartment = String(department || '').trim();
    const employeePosition = String(position || '').trim();
    if (!employeeName || !employeeDepartment || !employeePosition) {
        return response.status(400).json({ error: 'اسم الموظف والقسم والمسمى الوظيفي مطلوبة.' });
    }
    const employee = {
        id: crypto.randomUUID(),
        name: employeeName,
        department: employeeDepartment,
        position: employeePosition,
        phone: String(phone || '').trim(),
        email: String(email || '').trim(),
        startDate: String(startDate || '').trim(),
        status: String(status || 'نشط').trim(),
        createdAt: new Date().toISOString()
    };
    try {
        const result = await requestEmployeeSheet('saveEmployee', employee);
        audit(request.user.username, `إضافة الموظف ${employee.name}`);
        response.status(201).json({ employee: result.employee || employee });
    } catch (error) {
        response.status(error.status || 502).json({ error: error.message || 'تعذر حفظ بيانات الموظف' });
    }
});

app.post('/api/data-center/export', authenticate, async (request, response) => {
    if (!hasPermission(request.user, 'dataCenter') && !hasPermission(request.user, 'employees')) {
        return response.status(403).json({ error: 'ليس لديك صلاحية لتصدير بيانات مركز البيانات.' });
    }
    const { format, records: inputRecords } = request.body || {};
    if (!['xlsx', 'docx', 'csv'].includes(format)) {
        return response.status(400).json({ error: 'صيغة التصدير غير مدعومة.' });
    }
    if (!Array.isArray(inputRecords) || !inputRecords.length || inputRecords.length > 10000) {
        return response.status(400).json({ error: 'عدد السجلات غير صالح للتصدير.' });
    }

    const textValue = (value, maxLength) => String(value ?? '').slice(0, maxLength);
    const records = inputRecords.map((record) => {
        const amount = record?.amount == null ? null : Number(record.amount);
        return {
            type: textValue(record?.type, 120),
            title: textValue(record?.title, 2000),
            date: textValue(record?.date, 80),
            details: textValue(record?.details, 8000),
            amount: Number.isFinite(amount) ? amount : null
        };
    });
    const headers = ['نوع السجل', 'العنوان', 'التاريخ', 'التفاصيل', 'القيمة (ر.س)'];
    const rows = records.map((record) => [record.type, record.title, record.date, record.details, record.amount ?? '']);

    try {
        let file;
        let contentType;
        if (format === 'xlsx') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'I D H الخيرية';
            const worksheet = workbook.addWorksheet('مركز البيانات', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
            worksheet.addRow(headers);
            rows.forEach((row) => worksheet.addRow(row));
            worksheet.columns = [{ width: 20 }, { width: 28 }, { width: 18 }, { width: 60 }, { width: 18 }];
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF267866' } };
            worksheet.autoFilter = { from: 'A1', to: 'E1' };
            file = await workbook.xlsx.writeBuffer();
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (format === 'docx') {
            const document = new Document({
                sections: [{
                    children: [
                        new Paragraph({ text: 'تقرير مركز البيانات', heading: HeadingLevel.TITLE, alignment: AlignmentType.RIGHT }),
                        new Paragraph({ text: `تاريخ التصدير: ${new Date().toLocaleString('ar-SA')}`, alignment: AlignmentType.RIGHT }),
                        ...records.flatMap((record, index) => [
                            new Paragraph({ text: `${index + 1}. ${record.title || 'سجل بلا عنوان'}`, heading: HeadingLevel.HEADING_2, alignment: AlignmentType.RIGHT }),
                            new Paragraph({ text: `نوع السجل: ${record.type} | التاريخ: ${record.date || '—'} | القيمة: ${record.amount ?? '—'} ر.س`, alignment: AlignmentType.RIGHT }),
                            new Paragraph({ text: record.details || 'لا توجد تفاصيل إضافية.', alignment: AlignmentType.RIGHT })
                        ])
                    ]
                }]
            });
            file = await Packer.toBuffer(document);
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else {
            const escapeCsv = (value) => {
                let text = String(value ?? '');
                if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
                return `"${text.replace(/"/g, '""')}"`;
            };
            file = Buffer.from(`\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`, 'utf8');
            contentType = 'text/csv; charset=utf-8';
        }
        response.setHeader('Content-Type', contentType);
        response.setHeader('Content-Disposition', `attachment; filename="idh-data-center.${format}"`);
        audit(request.user.username, `تصدير مركز البيانات بصيغة ${format}`);
        response.send(file);
    } catch (error) {
        console.error('Data center export failed:', error);
        response.status(500).json({ error: 'تعذر إنشاء ملف التصدير.' });
    }
});

app.post('/api/change-password', authenticate, (request, response) => {
    const { currentPassword, newPassword } = request.body;
    const user = database.prepare('SELECT password_hash FROM users WHERE id = ?').get(request.user.id);
    if (!user || !bcrypt.compareSync(currentPassword || '', user.password_hash)) return response.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    if (!newPassword || newPassword.length < 12) return response.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تتكون من 12 حرفًا على الأقل.' });
    database.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 12), request.user.id);
    audit(request.user.username, 'تغيير كلمة المرور');
    response.json({ message: 'تم تغيير كلمة المرور بنجاح' });
});

app.get('/api/admin/system-review', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const googleEndpoint = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
    let googleEndpointValid = false;
    try {
        const endpoint = new URL(googleEndpoint);
        googleEndpointValid = endpoint.protocol === 'https:' && endpoint.hostname === 'script.google.com';
    } catch (error) {
        googleEndpointValid = false;
    }
    const admin = database.prepare('SELECT email FROM users WHERE id = ?').get(request.user.id);
    const latestAudit = database.prepare('SELECT created_at FROM audit_log ORDER BY id DESC LIMIT 1').get();
    response.json({
        runtime: { nodeVersion: process.versions.node },
        database: { status: 'ok', engine: 'SQLite' },
        accounts: {
            total: database.prepare('SELECT COUNT(*) AS count FROM users').get().count,
            pending: database.prepare('SELECT COUNT(*) AS count FROM account_requests').get().count,
            adminEmailConfigured: Boolean(admin?.email)
        },
        integrations: {
            googleSheetsReady: Boolean(googleEndpointValid && process.env.GOOGLE_SHEETS_SHARED_SECRET),
            aiProviderConfigured: Boolean(process.env.AI_ASSISTANT_API_URL && process.env.AI_ASSISTANT_API_KEY)
        },
        latestAuditAt: latestAudit?.created_at || null
    });
});

app.get('/api/admin/system-settings', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const settings = Object.fromEntries(database.prepare('SELECT setting_key, setting_value FROM system_settings').all()
        .map(({ setting_key, setting_value }) => [setting_key, setting_value]));
    response.json({
        organizationName: settings.organizationName || 'منظمة I D H الخيرية',
        contactEmail: settings.contactEmail || '',
        contactPhone: settings.contactPhone || ''
    });
});

app.put('/api/admin/system-settings', authenticate, (request, response) => {
    if (!requireAdmin(request, response)) return;
    const settings = {
        organizationName: String(request.body?.organizationName || '').trim(),
        contactEmail: String(request.body?.contactEmail || '').trim().toLowerCase(),
        contactPhone: String(request.body?.contactPhone || '').trim()
    };
    if (!settings.organizationName || settings.organizationName.length > 100) {
        return response.status(400).json({ error: 'اسم المنظمة مطلوب ويجب ألا يتجاوز 100 حرف.' });
    }
    if (settings.contactEmail && !isValidEmail(settings.contactEmail)) {
        return response.status(400).json({ error: 'أدخل بريدًا إلكترونيًا صالحًا.' });
    }
    if (settings.contactPhone.length > 40) {
        return response.status(400).json({ error: 'رقم التواصل يجب ألا يتجاوز 40 حرفًا.' });
    }
    const saveSettings = database.transaction(() => {
        const saveSetting = database.prepare(`INSERT INTO system_settings (setting_key, setting_value, updated_by)
            VALUES (?, ?, ?)
            ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value,
                updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`);
        Object.entries(settings).forEach(([key, value]) => saveSetting.run(key, value, request.user.username));
        audit(request.user.username, 'تحديث إعدادات المنظمة');
    });
    saveSettings();
    response.json({ settings, message: 'تم حفظ إعدادات المنظمة.' });
});

app.get('/api/health', (request, response) => response.json({ status: 'ok', database: 'sqlite' }));
app.get('*', (request, response) => {
    if (path.extname(request.path)) return response.status(404).json({ error: 'غير موجود' });
    response.sendFile(path.join(__dirname, 'index.html'));
});
app.listen(port, host, () => console.log(`IDH server listening on ${host}:${port}`));
