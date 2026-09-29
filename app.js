const toast = document.getElementById('toast');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const searchInput = document.getElementById('searchInput');
const transactionRows = [...document.querySelectorAll('#transactionsBody tr')];
const themeToggle = document.getElementById('themeToggle');
const loginScreen = document.getElementById('loginScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const registerForm = document.getElementById('registerForm');
const registerMessage = document.getElementById('registerMessage');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const authTabs = document.querySelector('.auth-tabs');
const emailEnrollmentForm = document.getElementById('emailEnrollmentForm');
const enrollmentMessage = document.getElementById('enrollmentMessage');
const loginOtpForm = document.getElementById('loginOtpForm');
const loginOtpMessage = document.getElementById('loginOtpMessage');
const loginOtpError = document.getElementById('loginOtpError');
const registerOtpForm = document.getElementById('registerOtpForm');
const registerOtpMessage = document.getElementById('registerOtpMessage');
const registerOtpError = document.getElementById('registerOtpError');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const forgotPasswordMessage = document.getElementById('forgotPasswordMessage');
const passwordResetOtpForm = document.getElementById('passwordResetOtpForm');
const passwordResetOtpMessage = document.getElementById('passwordResetOtpMessage');
const passwordResetOtpError = document.getElementById('passwordResetOtpError');
let pendingLoginCredentials = null;
let loginOtpChallengeId = null;
let registerOtpChallengeId = null;
let passwordResetChallengeId = null;
function setupPasswordVisibility(container) {
    container.querySelectorAll('.password-toggle').forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const input = toggle.closest('.password-field').querySelector('input');
            const isVisible = input.type === 'password';
            input.type = isVisible ? 'text' : 'password';
            toggle.textContent = isVisible ? 'إخفاء' : 'إظهار';
            toggle.setAttribute('aria-label', `${isVisible ? 'إخفاء' : 'إظهار'} كلمة المرور`);
            toggle.setAttribute('aria-pressed', String(isVisible));
        });
    });
}
setupPasswordVisibility(document);
const assignablePermissions = {
    projects: 'المشاريع',
    clients: 'العملاء',
    employees: 'الموظفون والموارد البشرية',
    offers: 'عروض الأسعار',
    tenders: 'المناقصات',
    reports: 'التقارير',
    dataCenter: 'مركز البيانات',
    settings: 'إعدادات النظام'
};
const rolePresets = {
    hr: { label: 'مسؤول الموارد البشرية', permissions: ['employees'] },
    projectManager: { label: 'مدير المشاريع', permissions: ['projects', 'offers', 'tenders', 'reports'] },
    accountant: { label: 'المحاسب', permissions: ['offers', 'reports'] },
    admin: { label: 'مدير النظام', permissions: ['*'] },
    custom: { label: 'صلاحيات مخصصة', permissions: [] }
};
const sectionPermission = {
    projects: 'projects',
    clients: 'clients',
    employees: 'employees',
    offers: 'offers',
    tenders: 'tenders',
    reports: 'reports',
    dataCenter: 'dataCenter',
    users: 'users',
    assistant: '*',
    settings: 'settings'
};
function getPermissionKeys(value) {
    if (Array.isArray(value)) return value;
    if (value === 'كامل الصلاحيات') return ['*'];
    if (typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
    } catch (error) {
        const aliases = {
            projects: /مشاريع|projects?/i,
            clients: /عملاء|clients?/i,
            employees: /موظف|موارد بشرية|employees?|\bHR\b/i,
            offers: /عروض|offers?/i,
            tenders: /مناقصات|tenders?/i,
            reports: /تقارير|reports?/i,
            dataCenter: /مركز البيانات|data center/i,
            settings: /إعدادات|settings?/i
        };
        return Object.entries(aliases).filter(([, pattern]) => pattern.test(value)).map(([permission]) => permission);
    }
    return [];
}
function userHasPermission(account, permission) {
    const permissions = getPermissionKeys(account?.permissions);
    return permissions.includes('*') || permissions.includes(permission);
}
function setNavigationPermissions(account) {
    document.querySelectorAll('.main-nav a').forEach((link) => {
        const sectionKey = link.getAttribute('href').slice(1);
        const permission = sectionPermission[sectionKey];
        link.hidden = Boolean(permission && !userHasPermission(account, permission));
    });
}
let activeAccount = null;
const getSectionRecords = (sectionKey) => {
    try {
        const records = JSON.parse(localStorage.getItem('idh-section-records') || '{}');
        return Array.isArray(records[sectionKey]) ? records[sectionKey] : [];
    } catch (error) {
        return [];
    }
};
const saveSectionRecords = (sectionKey, sectionRecords) => {
    let records = {};
    try {
        records = JSON.parse(localStorage.getItem('idh-section-records') || '{}');
    } catch (error) {
        records = {};
    }
    records[sectionKey] = sectionRecords;
    localStorage.setItem('idh-section-records', JSON.stringify(records));
};
const getSavedQuotes = () => {
    try {
        const quotes = JSON.parse(localStorage.getItem('idh-quotes') || '[]');
        return Array.isArray(quotes) ? quotes : [];
    } catch (error) {
        return [];
    }
};
const apiRequest = async (endpoint, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = sessionStorage.getItem('idh-api-token');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, { ...options, headers });
    const responseText = await response.text();
    let data = {};
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
        data = { error: 'تعذر قراءة استجابة الخادم. افتح النظام عبر خادم Node.js.' };
    }
    if (!response.ok) {
        const error = new Error(data.error || 'تعذر الاتصال بالخادم');
        error.status = response.status;
        throw error;
    }
    return data;
};

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function setTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    themeToggle.setAttribute('aria-label', isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن');
    themeToggle.title = isDark ? 'الوضع الفاتح' : 'الوضع الداكن';
}

setTheme(localStorage.getItem('idh-theme') === 'dark');

const languageSelect = document.getElementById('languageSelect');
const languagePairs = [
    ['I D H | نظام التحكم الخيري', 'I D H | Charity Control System'],
    ['منظمة I D H', 'I D H Organization'], ['العربية', 'Arabic'],
    ['التنقل الرئيسي', 'Main Navigation'], ['اختيار اللغة', 'Select Language'],
    ['فتح القائمة', 'Open Menu'], ['خيارات الحساب', 'Account Options'],
    ['إظهار كلمة المرور', 'Show Password'], ['إخفاء كلمة المرور', 'Hide Password'],
    ['العودة للرئيسية ←', 'Back to Dashboard →'], ['＋ إضافة جديد', '+ Add New'], ['↻ تحديث', '↻ Refresh'],
    ['الدور الوظيفي', 'Role'], ['الموظفون والموارد البشرية', 'Employees & Human Resources'],
    ['✎ تعديل المحدد', '✎ Edit Selected'], ['⌫ حذف المحدد', '⌫ Delete Selected'],
    ['⇩ تصدير القسم', '⇩ Export Section'], ['⌕ تصفية بالتاريخ', '⌕ Filter by Date'], ['▣ طباعة', '▣ Print'],
    ['＋ عرض جديد', '+ New Quote'], ['＋ إضافة بند', '+ Add Item'], ['حذف', 'Remove'],
    ['اسم الموظف', 'Employee Name'], ['اسم العميل', 'Client Name'], ['تاريخ العرض', 'Quote Date'],
    ['اسم المناقصة', 'Tender Name'], ['الجهة المالكة', 'Issuing Organization'], ['المرجع', 'Reference'],
    ['آخر موعد للتقديم', 'Submission Deadline'], ['عنوان التقرير', 'Report Title'], ['الفترة من', 'Period From'],
    ['الفترة إلى', 'Period To'], ['نوع التقرير', 'Report Type'], ['اسم المنظمة', 'Organization Name'],
    ['البريد الرئيسي', 'Primary Email'], ['رقم التواصل', 'Contact Number'], ['اللغة', 'Language'],
    ['إدارة المناقصات', 'Tender Management'], ['إدارة إعدادات المنظمة وقنوات التواصل', 'Manage organization and communication settings'],
    ['ENGFT · مدير النظام · كامل الصلاحيات', 'ENGFT · System Administrator · Full Access'],
    ['Google Apps Script غير مهيأ. أضف رابط النشر والمفتاح السري إلى إعدادات الخادم.', 'Google Apps Script is not configured. Add the deployment URL and shared secret to the server settings.'],
    ['جارٍ تحميل البيانات من Google Sheets...', 'Loading data from Google Sheets...'],
    ['جارٍ حفظ بيانات الموظف...', 'Saving employee data...'], ['تم حفظ بيانات الموظف في Google Sheets.', 'Employee data saved to Google Sheets.'],
    ['تعذر الاتصال بـ Google Sheets.', 'Could not connect to Google Sheets.'],
    ['تُحفظ البيانات في ورقة Employees.', 'Data is saved in the Employees sheet.'],
    ['0 عرض', '0 quotes'], ['0 سجل', '0 records'],
    ['م', 'M'], ['س', 'S'], ['خ', 'K'], ['ن', 'N'],
    ['مدير النظام · كامل الصلاحيات', 'System Administrator · Full Access'],
    ['عرض الكل ←', 'View All →'], ['عرض السجل ←', 'View Records →'], ['≡ تصفية', '≡ Filter'],
    ['الدفاع المدني - إدارة الفنون', 'Civil Defense - Arts Department'],
    ['توريد وتركيب درابزين', 'Supply and Install Handrails'],
    ['شركة التكامل الكاملة الصناعية', 'Al-Takamul Industrial Company'],
    ['تجهيز قاعة الاجتماعات', 'Meeting Room Setup'], ['إدارة المشتريات المركزية', 'Central Procurement Department'],
    ['تمديدات المواقع والمنافذ', 'Site and Outlet Installations'], ['تخصيص سيسب بن', 'CISB Bin Allocation'],
    ['الشركة التقنية للاتصالات الحديثة', 'Modern Telecom Technology Company'],
    ['محمد العتيبي', 'Mohammed Al-Otaibi'], ['سارة القحطاني', 'Sarah Al-Qahtani'],
    ['خالد السالم', 'Khalid Al-Salem'], ['نورة إبراهيم', 'Noura Ibrahim'],
    ['إضافة سجل', 'Add Record'], ['مسح سجل', 'Delete Record'], ['إرسال رسالة', 'Send Message'],
    ['الوارد والاستقبال', 'Inbox'], ['تصدير البيانات', 'Export Data'],
    ['حذف البيانات المحلية بالكامل', 'Delete all local data'],
    ['طلب تحديث بيانات مشروع سكن كريم', 'Request to update Decent Housing project'],
    ['رسالة من قسم المتابعة', 'Message from the Follow-up Department'],
    ['تعديل القنوات ←', 'Edit Channels →'], ['تواصل مباشر مع المستفيدين', 'Direct communication with beneficiaries'],
    ['فيسبوك', 'Facebook'], ['صفحة المنظمة الرسمية', 'Official organization page'],
    ['يوتيوب', 'YouTube'], ['حملات وتقارير المنظمة', 'Organization campaigns and reports'],
    ['إنستغرام', 'Instagram'], ['أخبار ومبادرات I D H', 'I D H news and initiatives'],
    ['＋ رسالة جديدة', '+ New Message'], ['ممحمد العتيبي', 'M Mohammed Al-Otaibi'],
    ['سسارة القحطاني', 'S Sarah Al-Qahtani'], ['خخالد السالم', 'K Khalid Al-Salem'], ['ننورة إبراهيم', 'N Noura Ibrahim'],
    ['تم تفعيل اللغة الإنجليزية', 'English language enabled'],
    ['منظمة I D H الخيرية', 'I D H Charity Organization'],
    ['منظمة خيرية', 'Charity Organization'], ['المقر الرئيسي', 'Head Office'],
    ['بوابة التحكم الآمنة', 'Secure Control Portal'], ['تسجيل الدخول', 'Sign In'],
    ['أدخل اسم المستخدم وكلمة المرور للوصول إلى لوحة المعلومات.', 'Enter your username and password to access the dashboard.'],
    ['الوصول إلى الحساب', 'Account Access'], ['طلب حساب', 'Request an Account'],
    ['اسم المستخدم', 'Username'], ['كلمة المرور', 'Password'], ['أدخل اسم المستخدم', 'Enter username'],
    ['أدخل كلمة المرور', 'Enter password'], ['إظهار', 'Show'], ['إخفاء', 'Hide'],
    ['هل نسيت كلمة المرور؟', 'Forgot password?'], ['دخول إلى لوحة التحكم', 'Sign in to Dashboard'],
    ['حسابات منظمة I D H الخيرية', 'I D H Charity Organization Accounts'],
    ['استعادة كلمة المرور', 'Reset Password'], ['أدخل اسم المستخدم لاستلام رمز إعادة تعيين كلمة المرور.', 'Enter your username to receive a password reset code.'],
    ['إرسال رمز الاستعادة', 'Send Reset Code'], ['عودة لتسجيل الدخول', 'Back to Sign In'],
    ['أدخل الرمز ثم اختر كلمة مرور جديدة.', 'Enter the code, then choose a new password.'],
    ['رمز التحقق', 'Verification Code'], ['كلمة المرور الجديدة', 'New Password'],
    ['تأكيد كلمة المرور', 'Confirm Password'], ['12 حرفًا على الأقل', 'At least 12 characters'],
    ['أعد كتابة كلمة المرور', 'Re-enter password'], ['تغيير كلمة المرور', 'Change Password'],
    ['اسم المستخدم يجب أن يتكون من 3 إلى 32 حرفًا أو رقمًا، ويمكن استخدام النقطة والشرطة.', 'Username must be 3–32 letters or numbers; dots and hyphens are allowed.'],
    ['3 إلى 32 حرفًا أو رقمًا', '3–32 letters or numbers'], ['البريد الإلكتروني', 'Email'],
    ['طلب إنشاء حساب', 'Request an Account'], ['أرسل طلبك، وسيتم تفعيل الحساب بعد اعتماده من مدير النظام.', 'Submit your request. An administrator will activate your account after approval.'],
    ['تأكيد البريد الإلكتروني', 'Verify Email'], ['تفعيل التحقق بخطوتين', 'Enable Two-Step Verification'],
    ['سجّل بريدًا إلكترونيًا لاستلام رمز الدخول.', 'Add an email address to receive sign-in codes.'],
    ['أدخل الرمز المرسل إلى بريدك الإلكتروني لإكمال الدخول.', 'Enter the code sent to your email to finish signing in.'],
    ['أدخل الرمز لتفعيل بريد الحساب وإكمال الدخول.', 'Enter the code to verify your account email and finish signing in.'],
    ['تحقق وتسجيل الدخول', 'Verify and Sign In'], ['تأكيد البريد وإرسال الطلب', 'Verify Email and Submit Request'],
    ['إرسال رمز التحقق', 'Send Verification Code'], ['أرسلنا رمز التحقق إلى', 'We sent a verification code to'],
    ['أدخل بريدًا إلكترونيًا صالحًا لاستلام رمز التحقق.', 'Enter a valid email address to receive a verification code.'],
    ['إدارة المنظمة', 'Organization'], ['لوحة المعلومات', 'Dashboard'], ['المشاريع', 'Projects'],
    ['العملاء', 'Clients'], ['الموظفون', 'Employees'], ['عروض الأسعار', 'Quotes'],
    ['المناقصات', 'Tenders'], ['التقارير', 'Reports'], ['مركز البيانات', 'Data Center'],
    ['مركز تخزين البيانات', 'Data Center'], ['المستخدمون والصلاحيات', 'Users & Permissions'],
    ['إعدادات النظام', 'System Settings'], ['الإدارة والإعدادات', 'Administration & Settings'],
    ['هل تحتاج للمساعدة؟', 'Need help?'], ['فريق الدعم متاح لخدمتك', 'Our support team is here to help'],
    ['تواصل معنا', 'Contact Support'], ['مرحباً مهندس فتح الرحمن', 'Welcome, Fath Al-Rahman'],
    ['نظرة سريعة على أداء منظمة I D H الخيرية', 'A quick overview of I D H Charity Organization'],
    ['ابحث في النظام', 'Search the system'], ['الإشعارات', 'Notifications'],
    ['تفعيل الوضع الداكن', 'Enable dark mode'], ['تفعيل الوضع الفاتح', 'Enable light mode'],
    ['الوضع الداكن', 'Dark mode'], ['الوضع الفاتح', 'Light mode'], ['تبديل المنظمة', 'Switch organization'],
    ['تسجيل الخروج', 'Sign Out'], ['نظرة شاملة وفعالة', 'A clear overview'],
    ['مركز واحد لمتابعة مشاريع ومبادرات وعملاء منظمة I D H الخيرية', 'One place to manage I D H projects, initiatives, and clients'],
    ['الإحصائيات الرئيسية', 'Key Statistics'], ['قيمة العقود', 'Contract Value'],
    ['مشروع', 'Project'], ['عميل مسجل', 'Registered Clients'], ['العملاء', 'Clients'],
    ['قاعدة عملاء نشطة', 'Active client base'], ['تحت الدراسة', 'Under Review'],
    ['حالة متابعة مستمرة', 'Ongoing follow-up'], ['منافستي', 'Etimad'], ['إجمالي العروض', 'Total Quotes'],
    ['آخر المشاريع', 'Recent Projects'], ['المتابعة اليومية', 'Daily Tracking'], ['عرض الكل', 'View All'],
    ['مشروع قائم · صيانة وتشغيل', 'Active project · Maintenance and operations'],
    ['توريد', 'Supply'], ['عرض', 'Quote'], ['المناقصات', 'Tenders'], ['آخر طلبات الشراء', 'Recent Purchase Requests'],
    ['عرض السجل', 'View Records'], ['جامعة الملك سعود · مرجع 260739011199', 'King Saud University · Ref. 260739011199'],
    ['أحدث التبرعات', 'Recent Donations'], ['آخر العمليات المسجلة في النظام', 'Latest transactions recorded in the system'],
    ['تصفية', 'Filter'], ['المتبرع', 'Donor'], ['المشروع', 'Project'], ['التاريخ', 'Date'],
    ['طريقة الدفع', 'Payment Method'], ['المبلغ', 'Amount'], ['الحالة', 'Status'],
    ['محمد العتيبي', 'Mohammed Al-Otaibi'], ['سقيا الماء', 'Water for All'],
    ['بطاقة ائتمانية', 'Credit Card'], ['مكتمل', 'Completed'], ['سارة القحطاني', 'Sarah Al-Qahtani'],
    ['تعليم وتمكين', 'Education & Empowerment'], ['تحويل بنكي', 'Bank Transfer'],
    ['خالد السالم', 'Khalid Al-Salem'], ['سكن كريم', 'Decent Housing'], ['قيد المراجعة', 'Under Review'],
    ['نورة إبراهيم', 'Noura Ibrahim'], ['رعاية صحية', 'Healthcare'], ['مركز عمليات مدير النظام', 'Administrator Operations'],
    ['إدارة كاملة للبيانات والاتصالات داخل النظام', 'Manage system data and communications'],
    ['كامل الصلاحيات', 'Full Access'], ['إضافة سجل', 'Add Record'], ['مشروع أو عميل أو مناقصة', 'Project, client, or tender'],
    ['مسح سجل', 'Delete Record'], ['حذف عنصر محدد من البيانات', 'Delete a selected record'],
    ['إرسال رسالة', 'Send Message'], ['إشعار إلى أعضاء النظام', 'Notify system members'],
    ['الوارد والاستقبال', 'Inbox'], ['عرض الرسائل والطلبات الواردة', 'View incoming messages and requests'],
    ['تصدير البيانات', 'Export Data'], ['تنزيل نسخة من معلومات النظام', 'Download a copy of system data'],
    ['إفراغ النظام', 'Clear System Data'], ['حذف البيانات المحلية بالكامل', 'Delete all local data'],
    ['الوارد الأخير', 'Recent Inbox'], ['منذ 8 دقائق', '8 minutes ago'], ['منذ 24 دقيقة', '24 minutes ago'],
    ['مساحة الإدارة', 'Workspace'], ['إدارة القسم', 'Section Management'],
    ['يمكنك الإضافة والتعديل والحذف والحفظ', 'Add, edit, delete, and save records'], ['العودة للرئيسية', 'Back to Dashboard'],
    ['إدارة المشاريع', 'Project Management'], ['إضافة وتعديل وحذف المشاريع', 'Add, edit, and delete projects'],
    ['اسم المشروع', 'Project Name'], ['العميل', 'Client'], ['قيمة العقد', 'Contract Value'], ['حالة المشروع', 'Project Status'],
    ['إدارة العملاء', 'Client Management'], ['تحديث بيانات العملاء ووسائل التواصل', 'Manage client details and contact information'],
    ['نوع العميل', 'Client Type'], ['إدارة الموظفين', 'Employee Management'],
    ['حفظ بيانات الموظفين في Google Sheets', 'Save employee records to Google Sheets'],
    ['حفظ بيانات الموظفين واستعراضها من Google Sheets', 'Manage employee records in Google Sheets'],
    ['القسم', 'Department'], ['المسمى الوظيفي', 'Job Title'], ['رقم الهاتف', 'Phone Number'],
    ['تاريخ المباشرة', 'Start Date'], ['الحالة الوظيفية', 'Employment Status'], ['نشط', 'Active'],
    ['إجازة', 'On Leave'], ['متوقف', 'Inactive'], ['تُحفظ البيانات في ورقة Employees.', 'Records are saved to the Employees sheet.'],
    ['حفظ الموظف', 'Save Employee'], ['سجل الموظفين', 'Employee Records'], ['رقم الموظف', 'Employee ID'],
    ['الاسم', 'Name'], ['الهاتف', 'Phone'], ['الحالة', 'Status'], ['لا توجد بيانات موظفين محفوظة.', 'No employee records saved.'],
    ['إدارة عروض الأسعار', 'Quote Management'], ['إنشاء عروض الأسعار ومتابعة المسودات المحفوظة', 'Create quotes and manage saved drafts'],
    ['إدارة المبيعات', 'Sales'], ['عرض سعر جديد', 'New Quote'], ['أنشئ عرضًا واضحًا مرتبطًا ببيانات العميل والبنود.', 'Create a clear quote linked to client and item details.'],
    ['مسودة جديدة', 'New Draft'], ['ضريبة القيمة المضافة 15%', '15% VAT'], ['عرض جديد', 'New Quote'],
    ['بيانات العرض', 'Quote Details'], ['المعلومات الأساسية للعرض والعميل', 'Quote and client details'],
    ['نوع التعميد', 'Order Type'], ['توريد', 'Supply'], ['صيانة', 'Maintenance'], ['تشغيل', 'Operations'], ['خدمات', 'Services'],
    ['موضوع العرض', 'Quote Subject'], ['مثال: توريد وتركيب...', 'e.g. supply and installation...'],
    ['المندوب', 'Representative'], ['اسم مسؤول العرض', 'Quote owner name'], ['مدة التوريد (يوم)', 'Delivery Time (days)'],
    ['الضمان', 'Warranty'], ['مثال: سنة واحدة', 'e.g. one year'], ['شروط الدفع', 'Payment Terms'],
    ['مثال: دفعة مقدمة والباقي بعد التسليم', 'e.g. deposit and balance on delivery'],
    ['بنود العرض', 'Quote Items'], ['أضف الأصناف والكميات والأسعار', 'Add items, quantities, and prices'], ['إضافة بند', 'Add Item'],
    ['الصنف المسجل', 'Item'], ['الوحدة', 'Unit'], ['الكمية', 'Quantity'], ['سعر البيع', 'Unit Price'], ['الإجمالي', 'Total'],
    ['حذف البند', 'Remove item'], ['قطعة', 'Unit'], ['خدمة', 'Service'], ['ساعة', 'Hour'], ['متر', 'Meter'], ['مجموعة', 'Set'],
    ['الأسعار بالريال السعودي، وتُحتسب الضريبة تلقائيًا.', 'Prices are in SAR; tax is calculated automatically.'],
    ['المجموع قبل الضريبة', 'Subtotal'], ['ضريبة القيمة المضافة (15%)', 'VAT (15%)'], ['الإجمالي شامل الضريبة', 'Total including tax'],
    ['المسودة تحفظ على هذا الجهاز', 'Draft is saved on this device'], ['حفظ المسودة', 'Save Draft'], ['العروض المحفوظة', 'Saved Quotes'],
    ['لا توجد عروض محفوظة بعد.', 'No saved quotes yet.'], ['عميل', 'Client'], ['تعديل مسودة محفوظة', 'Edit Saved Draft'],
    ['حفظ التغييرات', 'Save Changes'], ['مسودة محفوظة', 'Draft Saved'], ['تم حفظ المسودة على هذا الجهاز', 'Draft saved on this device'],
    ['مركز تخزين البيانات', 'Data Center'], ['استعراض وبحث وطباعة السجلات المحلية وبيانات الموظفين', 'Browse, search, and print local records and employee data'],
    ['نوع البيانات', 'Data Type'], ['كل البيانات', 'All Data'], ['بحث', 'Search'], ['ابحث في السجلات', 'Search records'],
    ['تحديث', 'Refresh'], ['طباعة', 'Print'], ['تنزيل ملف Excel', 'Download Excel file'], ['تنزيل ملف Word', 'Download Word file'],
    ['CSV للاستيراد إلى Access', 'CSV for Access import'], ['المصدر: بيانات المتصفح وGoogle Sheets · Access عبر استيراد CSV', 'Source: browser data and Google Sheets · import CSV into Access'],
    ['نوع السجل', 'Record Type'], ['العنوان', 'Title'], ['التفاصيل', 'Details'], ['القيمة', 'Value'], ['لا توجد سجلات مطابقة. احفظ سجلات أو عروض أسعار أولًا.', 'No matching records. Save records or quotes first.'],
    ['لا توجد سجلات لتصديرها.', 'No records to export.'], ['سجّل الدخول أولًا لتصدير البيانات.', 'Sign in before exporting data.'],
    ['تم تنزيل ملف التصدير بنجاح.', 'Export downloaded successfully.'], ['تعذر إنشاء ملف التصدير.', 'Could not create the export file.'],
    ['تعذر تحديث بيانات الموظفين من Google Sheets', 'Could not refresh employee data from Google Sheets'], ['تم تحديث السجلات المحفوظة', 'Saved records refreshed'],
    ['تم حفظ الموظف بنجاح', 'Employee saved successfully'], ['لم يتم حفظ الموظف', 'Employee was not saved'],
    ['إدارة الحسابات والصلاحيات الكاملة', 'Manage accounts and permissions'], ['إضافة جديد', 'Add New'], ['تعديل المحدد', 'Edit Selected'],
    ['حذف المحدد', 'Delete Selected'], ['تصفية بالتاريخ', 'Filter by Date'], ['تصدير القسم', 'Export Section'],
    ['عرض السجلات', 'View Records'], ['إخفاء السجلات', 'Hide Records'], ['حسابات أخرى', 'Other Accounts'],
    ['الأقسام المسموح بها', 'Allowed Sections'], ['كامل صلاحيات النظام', 'Full System Access'],
    ['حفظ حساب المستخدم', 'Save User Account'], ['كلمات المرور تُحفظ مشفرة على الخادم.', 'Passwords are encrypted on the server.'],
    ['طلبات إنشاء الحساب', 'Account Requests'], ['جارٍ تحميل الطلبات...', 'Loading requests...'],
    ['الحسابات الحالية', 'Current Accounts'], ['آخر السجلات', 'Recent Records'], ['جارٍ تحميل الحسابات...', 'Loading accounts...'],
    ['لا توجد سجلات محفوظة في هذا القسم.', 'No records saved in this section.'], ['مدير النظام', 'System Administrator'],
    ['مسؤول الموارد البشرية', 'HR Manager'], ['مدير المشاريع', 'Project Manager'], ['المحاسب', 'Accountant'],
    ['صلاحيات مخصصة', 'Custom Permissions'], ['بدون صلاحيات', 'No Permissions'], ['المستخدمون', 'Users'],
    ['تم اعتماد الحساب', 'Account approved'], ['اعتماد', 'Approve'], ['رفض', 'Reject'], ['طلبات بانتظار المراجعة', 'Requests awaiting review'],
    ['لا توجد طلبات معلّقة.', 'No pending requests.'], ['قنوات التواصل الاجتماعي', 'Social Media Channels'],
    ['حسابات منظمة I D H الرسمية', 'Official I D H accounts'], ['تعديل القنوات', 'Edit Channels'], ['واتساب الأعمال', 'WhatsApp Business'],
    ['تواصل مباشر مع المستفيدين', 'Direct communication with beneficiaries'], ['صفحة المنظمة الرسمية', 'Official organization page'],
    ['حملات وتقارير المنظمة', 'Campaigns and organization reports'], ['أخبار ومبادرات I D H', 'I D H news and initiatives'],
    ['متصل', 'Connected'], ['محفظة البريد الإلكتروني', 'Email Workspace'], ['إدارة مراسلات المنظمة', 'Manage organization correspondence'],
    ['رسالة جديدة', 'New Message'], ['الوارد', 'Inbox'], ['غير مقروء', 'Unread'], ['مرسل', 'Sent'],
    ['الحساب الرئيسي للمنظمة', 'Organization primary account'], ['فتح صندوق البريد', 'Open Mailbox'],
    ['آخر تحديث: منذ 5 دقائق', 'Last updated: 5 minutes ago'], ['تفصيل', 'Detail'], ['سجل بلا عنوان', 'Untitled Record'],
    ['ر.س', 'SAR'], ['سبتمبر', 'September'], ['أكتوبر', 'October'], ['نوفمبر', 'November'], ['ديسمبر', 'December'],
    ['يناير', 'January'], ['فبراير', 'February'], ['مارس', 'March'], ['أبريل', 'April'], ['مايو', 'May'], ['يونيو', 'June'],
    ['يوليو', 'July'], ['أغسطس', 'August'], ['الأحد', 'Sunday'], ['الاثنين', 'Monday'], ['الثلاثاء', 'Tuesday'],
    ['الأربعاء', 'Wednesday'], ['الخميس', 'Thursday'], ['الجمعة', 'Friday'], ['السبت', 'Saturday'],
    ['تم تفعيل اللغة العربية', 'Arabic language enabled'], ['تم تفعيل اللغة الإنجليزية', 'English language enabled'],
    ['تم تسجيل الدخول بنجاح', 'Signed in successfully'], ['تعذر الاتصال بالخادم', 'Could not connect to the server'],
    ['تعذر قراءة استجابة الخادم. افتح النظام عبر خادم Node.js.', 'Could not read the server response. Open the system through the Node.js server.'],
    ['تم تغيير كلمة المرور بنجاح', 'Password changed successfully'], ['تم إغلاق مساحة الإدارة', 'Workspace closed'],
    ['لوحة منظمة I D H جاهزة للمتابعة', 'I D H dashboard is ready'], ['لديك 3 إشعارات جديدة', 'You have 3 new notifications'],
    ['سيتواصل معك فريق الدعم قريباً', 'Our support team will contact you soon'], ['اكتب اسم السجل الجديد:', 'Enter the new record name:'],
    ['سجل جديد', 'New Record'], ['إدخال يدوي', 'Manual Entry'], ['غير محدد', 'Not specified'],
    ['تمت إضافة السجل:', 'Record added:'], ['لا توجد سجلات لمسحها', 'There are no records to delete'], ['السجل', 'Record'],
    ['اكتب الرسالة المراد إرسالها:', 'Enter the message to send:'], ['تم إرسال الرسالة إلى أعضاء النظام', 'Message sent to system members'],
    ['تم إخفاء الوارد', 'Inbox hidden'], ['لديك رسالتان واردتان', 'You have two new messages'], ['تم تصدير بيانات النظام', 'System data exported'],
    ['هل أنت متأكد من إفراغ كل البيانات المحلية؟', 'Are you sure you want to clear all local data?'],
    ['تم إفراغ البيانات المحلية بالكامل', 'All local data cleared'], ['اكتب اسم القناة التي تريد تحديثها:', 'Enter the channel to update:'],
    ['اكتب البريد الإلكتروني للمستلم:', 'Enter the recipient email address:'], ['اكتب الحالة للتصفية: مكتمل أو قيد المراجعة', 'Enter a status to filter: Completed or Under Review'],
    ['التاريخ الحالي: 25 سبتمبر 2026', 'Current date: September 25, 2026'], ['تم تصدير سجلات القسم إلى CSV', 'Section records exported to CSV'],
    ['أدخل تاريخًا واحدًا على الأقل في النموذج للتصفية', 'Enter at least one date in the form to filter'],
    ['تم حذف السجل المحدد', 'Selected record deleted'], ['اختر سجلًا من القائمة أولًا', 'Select a record from the list first'],
    ['استخدم نموذج إنشاء الحساب الجديد', 'Use the new account form'], ['أدخل بيانات السجل الجديد ثم احفظه', 'Enter the new record details, then save'],
    ['عدّل البيانات ثم احفظ التغييرات', 'Edit the details, then save your changes'], ['ليس لديك صلاحية للوصول إلى هذا القسم', 'You do not have permission to access this section'],
    ['كلمتا المرور غير متطابقتين', 'Passwords do not match'], ['اختر قسمًا واحدًا على الأقل', 'Select at least one section'],
    ['لا توجد نتائج مطابقة.', 'No matching results.'], ['تم حفظ التغييرات', 'Changes saved'], ['آخر السجلات المسجلة', 'Latest records'],
    ['مساعد تطوير النظام', 'System Improvement Assistant'], ['مراجعة تشغيلية واقتراحات تطوير تحت إشراف مدير النظام', 'Operational review and development suggestions under administrator supervision'],
    ['إعدادات المنظمة', 'Organization Settings'], ['احفظ بيانات المنظمة المستخدمة داخل النظام.', 'Save organization details used within the system.'],
    ['اسم المنظمة', 'Organization Name'], ['بريد التواصل', 'Contact Email'], ['رقم الهاتف', 'Phone Number'],
    ['حفظ إعدادات المنظمة', 'Save Organization Settings'], ['جارٍ تحميل الإعدادات...', 'Loading settings...'],
    ['تم حفظ إعدادات المنظمة.', 'Organization settings saved.'],
    ['إعدادات الخادم السرية، مثل مفاتيح Google وذكاء الاصطناعي، لا تُدار من المتصفح.', 'Server secrets, such as Google and AI keys, are not managed from the browser.'],
    ['مركز التحسين المستمر', 'Continuous Improvement Center'], ['تطوير آمن، خطوة بخطوة', 'Safer development, step by step'],
    ['افحص حالة النظام وحدد الأولويات قبل اعتماد أي تطوير.', 'Review system health and set priorities before approving changes.'],
    ['↻ إجراء فحص للنظام', '↻ Run System Review'], ['الفحص للقراءة فقط ولا يغيّر البيانات أو ملفات النظام. اقتراحات الكود تتطلب ربط مزوّد ذكاء اصطناعي ومراجعة المدير.', 'This review is read-only and does not change data or system files. Code suggestions require an AI provider connection and administrator review.'],
    ['جارٍ فحص حالة النظام...', 'Reviewing system health...'], ['أولويات تطوير مقترحة', 'Suggested Development Priorities'],
    ['نسخ احتياطي قابل للاستعادة', 'Restorable Backups'], ['جدولة نسخ قاعدة البيانات واختبار استعادتها دوريًا قبل النشر.', 'Schedule database backups and regularly test restoration before deployment.'],
    ['أولوية عالية', 'High Priority'], ['التحقق متعدد العوامل', 'Multi-Factor Authentication'],
    ['إكمال إعداد البريد وOTP لحماية حسابات الإدارة.', 'Complete email and OTP setup to protect administrator accounts.'],
    ['سجل تغييرات ومراقبة', 'Audit and Monitoring'], ['مراجعة سجل التدقيق والتنبيه عند تكرار الأخطاء أو محاولات الدخول.', 'Review audit events and alert on recurring errors or sign-in attempts.'],
    ['تحسين مستمر', 'Ongoing'], ['مساعد اقتراحات متصل', 'Connected AI Assistant'],
    ['ربط مزوّد ذكاء اصطناعي موثوق، مع إبقاء أي تعديل برمجي خاضعًا لموافقة المدير.', 'Connect a trusted AI provider; keep all code changes subject to administrator approval.'],
    ['يتطلب إعدادًا', 'Setup Required'], ['قاعدة البيانات', 'Database'], ['متصلة', 'Connected'], ['SQLite · متصلة', 'SQLite · Connected'], ['سليم', 'Healthy'],
    ['بيئة التشغيل', 'Runtime'], ['Google Sheets والبريد', 'Google Sheets & Email'], ['التكامل مهيأ', 'Integration configured'],
    ['أضف رابط النشر والمفتاح السري', 'Add deployment URL and shared secret'], ['جاهز', 'Ready'], ['يحتاج إعدادًا', 'Needs Setup'],
    ['حساب المدير والبريد', 'Administrator Email'], ['بريد المدير مسجل', 'Administrator email is registered'],
    ['لا يوجد بريد موثق للمدير', 'No verified administrator email'], ['توصية', 'Recommended'],
    ['مزوّد الذكاء الاصطناعي', 'AI Provider'], ['الإعدادات موجودة؛ يلزم اختبار الاتصال', 'Settings found; connection test required'],
    ['يتطلب اختبارًا', 'Test Required'], ['غير موصول؛ لا تُرسل بيانات للنظام حاليًا', 'Not connected; no system data is being sent'],
    ['غير مهيأ', 'Not Configured'], ['منظمة I D H جاهزة للمتابعة', 'I D H is ready to continue'], ['© 2026 منظمة I D H الخيرية', '© 2026 I D H Charity Organization']
];

const translations = {
    en: new Map(languagePairs),
    ar: new Map(languagePairs.map(([arabic, english]) => [english, arabic]))
};
let activeLanguage = 'ar';

function getActiveLocale() {
    return activeLanguage === 'en' ? 'en-US' : 'ar-SA';
}

function translateValue(value, language = activeLanguage) {
    const translationsForLanguage = translations[language];
    const normalizedValue = value.trim().replace(/\s+/g, ' ');
    const leadingWhitespace = value.match(/^\s*/)?.[0] || '';
    const trailingWhitespace = value.match(/\s*$/)?.[0] || '';
    const translated = translationsForLanguage.get(normalizedValue);
    if (translated) return `${leadingWhitespace}${translated}${trailingWhitespace}`;
    if (language === 'en') {
        const placeholder = normalizedValue.match(/^أدخل (.+)$/);
        if (placeholder) return `${leadingWhitespace}Enter ${translations.en.get(placeholder[1]) || placeholder[1]}${trailingWhitespace}`;
        const count = normalizedValue.match(/^عدد الحسابات: (\d+)$/);
        if (count) return `${leadingWhitespace}Accounts: ${count[1]}${trailingWhitespace}`;
        const loading = normalizedValue.match(/^جارٍ تحميل (.+)\.\.\.$/);
        if (loading) return `${leadingWhitespace}Loading ${loading[1]}...${trailingWhitespace}`;
        const savedAccount = normalizedValue.match(/^تم إنشاء حساب (.+) بدور (.+)\.$/);
        if (savedAccount) return `${leadingWhitespace}Created account ${savedAccount[1]} with role ${savedAccount[2]}.${trailingWhitespace}`;
        const welcome = normalizedValue.match(/^مرحباً (.+)، تم تسجيل الدخول بنجاح$/);
        if (welcome) return `${leadingWhitespace}Welcome ${welcome[1]}, signed in successfully${trailingWhitespace}`;
        const employeeCount = normalizedValue.match(/^تم تحميل (\d+) موظف من Google Sheets\.$/);
        if (employeeCount) return `${leadingWhitespace}Loaded ${employeeCount[1]} employees from Google Sheets.${trailingWhitespace}`;
        const visibleRecords = normalizedValue.match(/^المعروض (\d+) من (\d+) سجل\.$/);
        if (visibleRecords) return `${leadingWhitespace}Showing ${visibleRecords[1]} of ${visibleRecords[2]} records.${trailingWhitespace}`;
        const accountRequests = normalizedValue.match(/^طلبات بانتظار المراجعة: (\d+)$/);
        if (accountRequests) return `${leadingWhitespace}Pending requests: ${accountRequests[1]}${trailingWhitespace}`;
        const reviewSummary = normalizedValue.match(/^الحسابات: (\d+) · طلبات معلقة: (\d+) · آخر نشاط: (.+)$/);
        if (reviewSummary) return `${leadingWhitespace}Accounts: ${reviewSummary[1]} · Pending requests: ${reviewSummary[2]} · Latest activity: ${reviewSummary[3]}${trailingWhitespace}`;
        const quoteCount = normalizedValue.match(/^(\d+)\sعرض$/);
        if (quoteCount) return `${leadingWhitespace}${quoteCount[1]} quotes${trailingWhitespace}`;
        const recordCount = normalizedValue.match(/^(\d+)\sسجل$/);
        if (recordCount) return `${leadingWhitespace}${recordCount[1]} records${trailingWhitespace}`;
        const arabicDate = normalizedValue.match(/^(\d{1,2}) سبتمبر (\d{4})$/);
        if (arabicDate) return `${leadingWhitespace}September ${arabicDate[1]}, ${arabicDate[2]}${trailingWhitespace}`;
        const arabicCurrency = normalizedValue.match(/^(.+)\sر\.س$/);
        if (arabicCurrency) return `${leadingWhitespace}${arabicCurrency[1]} SAR${trailingWhitespace}`;
    } else {
        const reviewSummary = normalizedValue.match(/^Accounts: (\d+) · Pending requests: (\d+) · Latest activity: (.+)$/);
        if (reviewSummary) return `${leadingWhitespace}الحسابات: ${reviewSummary[1]} · طلبات معلقة: ${reviewSummary[2]} · آخر نشاط: ${reviewSummary[3]}${trailingWhitespace}`;
        const englishCurrency = normalizedValue.match(/^(.+)\sSAR$/i);
        if (englishCurrency) return `${leadingWhitespace}${englishCurrency[1]} ر.س${trailingWhitespace}`;
        const quoteCount = normalizedValue.match(/^(\d+)\squotes$/i);
        if (quoteCount) return `${leadingWhitespace}${quoteCount[1]} عرض${trailingWhitespace}`;
        const recordCount = normalizedValue.match(/^(\d+)\srecords$/i);
        if (recordCount) return `${leadingWhitespace}${recordCount[1]} سجل${trailingWhitespace}`;
    }
    return value;
}

function translateTextNode(node) {
    const translated = localizeNumerals(translateValue(node.nodeValue), activeLanguage);
    if (translated !== node.nodeValue) node.nodeValue = translated;
}

function localizeNumerals(value, language) {
    if (language === 'en') {
        return value
            .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
            .replace(/٫/g, '.')
            .replace(/٬/g, ',');
    }
    return value
        .replace(/[0-9]/g, (digit) => String.fromCharCode(Number(digit) + 1632))
        .replace(/(?<=\d)\.(?=\d)/g, '٫')
        .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '٬');
}

function translateElement(root) {
    if (root.nodeType === Node.TEXT_NODE) {
        translateTextNode(root);
        return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) translateTextNode(walker.currentNode);
    const elements = [root, ...root.querySelectorAll('[placeholder], [aria-label], [title], [alt]')];
    elements.forEach((element) => ['placeholder', 'aria-label', 'title', 'alt'].forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const currentValue = element.getAttribute(attribute);
        const translated = translateValue(currentValue);
        if (translated !== currentValue) element.setAttribute(attribute, translated);
    }));
}

function applyLanguage(language) {
    activeLanguage = language === 'en' ? 'en' : 'ar';
    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = activeLanguage === 'en' ? 'ltr' : 'rtl';
    document.body.classList.toggle('ltr', activeLanguage === 'en');
    languageSelect.value = activeLanguage;
    document.title = translateValue('I D H | نظام التحكم الخيري', activeLanguage);
    translateElement(document.body);
    localStorage.setItem('idh-language', activeLanguage);
}

const languageObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') translateTextNode(mutation.target);
        else if (mutation.type === 'attributes') translateElement(mutation.target);
        else mutation.addedNodes.forEach(translateElement);
    });
});
languageObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] });

languageSelect.value = localStorage.getItem('idh-language') || 'ar';
applyLanguage(languageSelect.value);
languageSelect.addEventListener('change', (event) => {
    applyLanguage(event.target.value);
    showToast(event.target.value === 'en' ? 'تم تفعيل اللغة الإنجليزية' : 'تم تفعيل اللغة العربية');
});

function applySessionProfile(account) {
    const profile = document.querySelector('.profile');
    if (!profile || !account) return;
    activeAccount = account;
    const permissionKeys = getPermissionKeys(account.permissions);
    const permissionText = permissionKeys.includes('*')
        ? 'كامل الصلاحيات'
        : permissionKeys.map((permission) => assignablePermissions[permission]).filter(Boolean).join('، ') || 'بدون صلاحيات';
    profile.querySelector('.profile-avatar').textContent = account.username.charAt(0).toUpperCase();
    profile.querySelector('b').textContent = account.username;
    profile.querySelector('small').textContent = `${account.role} · ${permissionText}`;
    setNavigationPermissions(account);
}

let savedSession = null;
try {
    savedSession = JSON.parse(sessionStorage.getItem('idh-session-user') || 'null');
} catch (error) {
    sessionStorage.removeItem('idh-session-user');
}
if (sessionStorage.getItem('idh-api-token') && savedSession) {
    loginScreen.classList.add('hidden');
    applySessionProfile(savedSession);
} else {
    sessionStorage.removeItem('idh-api-token');
    sessionStorage.removeItem('idh-admin-session');
    sessionStorage.removeItem('idh-session-user');
    setNavigationPermissions({ permissions: [] });
}

function showAuthForm(activeForm, title, subtitle) {
    [loginForm, registerForm, emailEnrollmentForm, loginOtpForm, registerOtpForm, forgotPasswordForm, passwordResetOtpForm].forEach((form) => {
        form.hidden = form !== activeForm;
    });
    authTabs.hidden = activeForm !== loginForm && activeForm !== registerForm && activeForm !== forgotPasswordForm;
    authTitle.textContent = title;
    authSubtitle.textContent = subtitle;
    activeForm.querySelector('input:not([type="hidden"])')?.focus();
}

function completeLogin(result) {
    sessionStorage.setItem('idh-api-token', result.token);
    sessionStorage.setItem('idh-admin-session', 'active');
    sessionStorage.setItem('idh-session-user', JSON.stringify(result.user));
    loginScreen.classList.add('hidden');
    pendingLoginCredentials = null;
    applySessionProfile(result.user);
    showToast(`مرحباً ${result.user.username}، تم تسجيل الدخول بنجاح`);
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    pendingLoginCredentials = { username, password };
    loginError.textContent = '';
    try {
        const result = await apiRequest('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        if (result.token) {
            completeLogin(result);
            return;
        }
        loginOtpChallengeId = result.challengeId;
        loginOtpMessage.textContent = result.message;
        showAuthForm(loginOtpForm, 'التحقق من تسجيل الدخول', 'أدخل الرمز المرسل إلى بريدك الإلكتروني لإكمال الدخول.');
    } catch (error) {
        if (error.status === 428) {
            showAuthForm(emailEnrollmentForm, 'تفعيل التحقق بخطوتين', 'سجّل بريدًا إلكترونيًا لاستلام رمز الدخول.');
            return;
        }
        loginError.textContent = error.message || 'تعذر الاتصال بخادم تسجيل الدخول.';
    }
});

document.getElementById('forgotPasswordLink').addEventListener('click', () => {
    forgotPasswordMessage.textContent = '';
    showAuthForm(forgotPasswordForm, 'استعادة كلمة المرور', 'أدخل اسم المستخدم لاستلام رمز استعادة جديد عبر البريد الإلكتروني.');
});

forgotPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = forgotPasswordForm.elements.namedItem('username').value.trim();
    forgotPasswordMessage.textContent = 'جارٍ إرسال رمز الاستعادة...';
    try {
        const result = await apiRequest('/api/password-reset/request', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
        passwordResetChallengeId = result.challengeId;
        passwordResetOtpMessage.textContent = result.message;
        showAuthForm(passwordResetOtpForm, 'إعادة تعيين كلمة المرور', 'أدخل الرمز المرسل إلى بريدك الإلكتروني، ثم اكتب كلمة مرور جديدة.');
    } catch (error) {
        forgotPasswordMessage.textContent = error.message || 'تعذر طلب رمز الاستعادة.';
    }
});

passwordResetOtpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = passwordResetOtpForm.elements.namedItem('code').value;
    const newPassword = passwordResetOtpForm.elements.namedItem('newPassword').value;
    const confirmation = passwordResetOtpForm.elements.namedItem('confirmation').value;
    if (newPassword.length < 12) {
        passwordResetOtpError.textContent = 'كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل.';
        return;
    }
    if (newPassword !== confirmation) {
        passwordResetOtpError.textContent = 'كلمتا المرور غير متطابقتين.';
        return;
    }
    try {
        const result = await apiRequest('/api/password-reset/verify', {
            method: 'POST',
            body: JSON.stringify({ challengeId: passwordResetChallengeId, code, newPassword })
        });
        passwordResetOtpForm.reset();
        passwordResetOtpError.textContent = '';
        showAuthForm(loginForm, 'تسجيل الدخول', 'أدخل اسم المستخدم وكلمة المرور للوصول إلى لوحة المعلومات.');
        loginError.textContent = result.message;
    } catch (error) {
        passwordResetOtpError.textContent = error.message || 'تعذر إعادة تعيين كلمة المرور.';
    }
});

document.querySelectorAll('[data-auth-mode]').forEach((tab) => tab.addEventListener('click', () => {
    const registerMode = tab.dataset.authMode === 'register';
    showAuthForm(registerMode ? registerForm : loginForm,
        registerMode ? 'طلب إنشاء حساب' : 'تسجيل الدخول',
        registerMode
            ? 'أرسل طلبك، وسيتم تفعيل الحساب بعد اعتماده من مدير النظام.'
            : 'أدخل اسم المستخدم وكلمة المرور للوصول إلى لوحة المعلومات.');
    document.querySelectorAll('[data-auth-mode]').forEach((item) => {
        const isSelected = item === tab;
        item.classList.toggle('active', isSelected);
        item.setAttribute('aria-selected', String(isSelected));
    });
    loginError.textContent = '';
    registerMessage.textContent = '';
    pendingLoginCredentials = null;
}));

registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = registerForm.querySelector('button[type="submit"]');
    const formData = new FormData(registerForm);
    const username = formData.get('username').trim();
    const password = formData.get('password');
    const email = formData.get('email').trim();
    const confirmation = formData.get('confirmation');
    registerMessage.classList.remove('success');
    if (password !== confirmation) {
        registerMessage.textContent = 'كلمتا المرور غير متطابقتين.';
        return;
    }
    submitButton.disabled = true;
    registerMessage.textContent = 'جارٍ إرسال طلبك...';
    try {
        const result = await apiRequest('/api/register/request-otp', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        registerOtpChallengeId = result.challengeId;
        registerOtpMessage.textContent = result.message;
        registerOtpError.textContent = '';
        showAuthForm(registerOtpForm, 'تأكيد البريد الإلكتروني', 'أدخل الرمز المرسل إلى بريدك لإرسال طلب الاعتماد.');
    } catch (error) {
        registerMessage.textContent = error.message || 'تعذر إرسال طلب التسجيل.';
    } finally {
        submitButton.disabled = false;
    }
});

emailEnrollmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!pendingLoginCredentials) return showAuthForm(loginForm, 'تسجيل الدخول', 'أدخل اسم المستخدم وكلمة المرور للوصول إلى لوحة المعلومات.');
    const submitButton = emailEnrollmentForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    enrollmentMessage.textContent = 'جارٍ إرسال رمز التحقق...';
    try {
        const result = await apiRequest('/api/login/enroll-email', {
            method: 'POST',
            body: JSON.stringify({ ...pendingLoginCredentials, email: emailEnrollmentForm.elements.namedItem('email').value.trim() })
        });
        loginOtpChallengeId = result.challengeId;
        loginOtpMessage.textContent = result.message;
        showAuthForm(loginOtpForm, 'تأكيد البريد الإلكتروني', 'أدخل الرمز لتفعيل بريد الحساب وإكمال الدخول.');
    } catch (error) {
        enrollmentMessage.textContent = error.message || 'تعذر إرسال رمز التحقق.';
    } finally {
        submitButton.disabled = false;
    }
});

loginOtpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = loginOtpForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    loginOtpError.textContent = '';
    try {
        const result = await apiRequest('/api/login/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ challengeId: loginOtpChallengeId, code: loginOtpForm.elements.namedItem('code').value })
        });
        completeLogin(result);
    } catch (error) {
        loginOtpError.textContent = error.message || 'تعذر التحقق من الرمز.';
    } finally {
        submitButton.disabled = false;
    }
});

registerOtpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = registerOtpForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    registerOtpError.textContent = '';
    try {
        const result = await apiRequest('/api/register/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ challengeId: registerOtpChallengeId, code: registerOtpForm.elements.namedItem('code').value })
        });
        registerForm.reset();
        registerOtpForm.reset();
        registerOtpChallengeId = null;
        showAuthForm(registerForm, 'طلب إنشاء حساب', 'أرسل طلبك، وسيتم تفعيل الحساب بعد اعتماده من مدير النظام.');
        registerMessage.textContent = result.message;
        registerMessage.classList.add('success');
    } catch (error) {
        registerOtpError.textContent = error.message || 'تعذر التحقق من الرمز.';
    } finally {
        submitButton.disabled = false;
    }
});

document.querySelectorAll('[data-auth-return]').forEach((button) => button.addEventListener('click', () => {
    pendingLoginCredentials = null;
    const returnToRegister = button.dataset.authReturn === 'register';
    showAuthForm(returnToRegister ? registerForm : loginForm,
        returnToRegister ? 'طلب إنشاء حساب' : 'تسجيل الدخول',
        returnToRegister ? 'أرسل طلبك، وسيتم تفعيل الحساب بعد اعتماده من مدير النظام.' : 'أدخل اسم المستخدم وكلمة المرور للوصول إلى لوحة المعلومات.');
}));

document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
        if (sessionStorage.getItem('idh-api-token')) await apiRequest('/api/logout', { method: 'POST' });
    } catch (error) {
        // Clear local authentication even if the server is unavailable.
    }
    sessionStorage.removeItem('idh-api-token');
    sessionStorage.removeItem('idh-admin-session');
    sessionStorage.removeItem('idh-session-user');
    activeAccount = null;
    setNavigationPermissions({ permissions: [] });
    document.querySelectorAll('.main-nav a').forEach((link) => link.classList.remove('active'));
    workspacePanel.hidden = true;
    workspacePanel.classList.remove('data-center-print');
    document.querySelector('.main-content').classList.remove('workspace-open');
    loginForm.reset();
    loginError.textContent = '';
    loginScreen.classList.remove('hidden');
    document.getElementById('username').focus();
});

document.getElementById('changePassword').addEventListener('click', async () => {
    const currentPassword = window.prompt('اكتب كلمة المرور الحالية:');
    if (!currentPassword) return;
    const newPassword = window.prompt('اكتب كلمة المرور الجديدة (12 حرفًا على الأقل):');
    const confirmation = window.prompt('أعد كتابة كلمة المرور الجديدة للتأكيد:');
    if (!newPassword || newPassword.length < 12 || newPassword !== confirmation) return showToast('استخدم كلمة مرور من 12 حرفًا على الأقل، وأكدها بشكل صحيح.');
    try {
        await apiRequest('/api/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
        showToast('تم تغيير كلمة المرور بنجاح');
    } catch (error) {
        showToast(error.message || 'تعذر تغيير كلمة المرور عبر الخادم.');
    }
});

themeToggle.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('dark-mode');
    setTheme(isDark);
    localStorage.setItem('idh-theme', isDark ? 'dark' : 'light');
    showToast(isDark ? 'تم تفعيل الوضع الداكن' : 'تم تفعيل الوضع الفاتح');
});

menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
const workspacePanel = document.getElementById('workspacePanel');
const workspaceTitle = document.getElementById('workspaceTitle');
const workspaceContent = document.getElementById('workspaceContent');
const workspaceSections = {
    projects: { title: 'إدارة المشاريع', subtitle: 'إضافة وتعديل وحذف المشاريع', fields: ['اسم المشروع', 'العميل', 'قيمة العقد', 'حالة المشروع'] },
    clients: { title: 'إدارة العملاء', subtitle: 'تحديث بيانات العملاء ووسائل التواصل', fields: ['اسم العميل', 'البريد الإلكتروني', 'رقم الهاتف', 'نوع العميل'] },
    employees: { title: 'إدارة الموظفين', subtitle: 'حفظ بيانات الموظفين في Google Sheets', fields: ['اسم الموظف', 'القسم', 'المسمى الوظيفي', 'رقم الهاتف', 'البريد الإلكتروني', 'تاريخ المباشرة', 'الحالة الوظيفية'] },
    offers: { title: 'إدارة عروض الأسعار', subtitle: 'إنشاء ومراجعة عروض الأسعار', fields: ['رقم العرض', 'اسم العميل', 'قيمة العرض', { label: 'تاريخ الانتهاء', type: 'date' }] },
    tenders: { title: 'إدارة المناقصات', subtitle: 'تعديل ومتابعة المناقصات وطلبات الشراء', fields: ['اسم المناقصة', 'الجهة المالكة', 'المرجع', { label: 'آخر موعد للتقديم', type: 'date' }], dateFilter: true },
    reports: { title: 'التقارير', subtitle: 'إنشاء التقارير وحفظها وتصديرها', fields: ['عنوان التقرير', { label: 'الفترة من', type: 'date' }, { label: 'الفترة إلى', type: 'date' }, 'نوع التقرير'], dateFilter: true },
    users: { title: 'المستخدمون والصلاحيات', subtitle: 'إدارة الحسابات والصلاحيات الكاملة', fields: ['اسم المستخدم', 'البريد الإلكتروني', 'الدور', 'الصلاحية'] },
    settings: { title: 'إعدادات النظام', subtitle: 'إدارة إعدادات المنظمة وقنوات التواصل', fields: ['اسم المنظمة', 'البريد الرئيسي', 'رقم التواصل', 'اللغة'] }
};

function openQuoteWorkspace() {
    workspaceTitle.textContent = 'إدارة عروض الأسعار';
    document.getElementById('workspaceSubtitle').textContent = 'إنشاء عروض الأسعار ومتابعة المسودات المحفوظة';
    workspaceContent.innerHTML = `<div class="quote-workspace">
        <header class="quote-header">
            <div><span class="quote-eyebrow">إدارة المبيعات</span><h2>عرض سعر جديد</h2><p>أنشئ عرضًا واضحًا مرتبطًا ببيانات العميل والبنود.</p></div>
            <div class="quote-header-actions"><span class="quote-draft-status" id="quoteStatus">مسودة جديدة</span><span class="quote-tax-chip">ضريبة القيمة المضافة 15%</span><button class="filter-btn" id="newQuote" type="button">＋ عرض جديد</button></div>
        </header>
        <form id="quoteForm">
            <section class="quote-step">
                <div class="quote-step-heading"><span>01</span><div><h3>بيانات العرض</h3><small>المعلومات الأساسية للعرض والعميل</small></div></div>
                <div class="quote-fields">
                    <label>اسم العميل<input name="customer" list="quoteClients" placeholder="اختر العميل أو اكتب اسمه" required /><datalist id="quoteClients"></datalist></label>
                    <label>نوع التعميد<select name="orderType"><option>توريد</option><option>صيانة</option><option>تشغيل</option><option>خدمات</option></select></label>
                    <label>تاريخ العرض<input name="quoteDate" type="date" required /></label>
                    <label class="quote-field-wide">موضوع العرض<input name="subject" placeholder="مثال: توريد وتركيب..." required /></label>
                    <label>المندوب<input name="representative" placeholder="اسم مسؤول العرض" required /></label>
                    <label>مدة التوريد (يوم)<input name="deliveryDays" type="number" min="1" placeholder="30" required /></label>
                    <label>الضمان<input name="warranty" placeholder="مثال: سنة واحدة" /></label>
                    <label class="quote-field-wide">شروط الدفع<input name="paymentTerms" placeholder="مثال: دفعة مقدمة والباقي بعد التسليم" /></label>
                </div>
            </section>
            <section class="quote-step quote-items-step">
                <div class="quote-step-heading"><span>02</span><div><h3>بنود العرض</h3><small>أضف الأصناف والكميات والأسعار</small></div><button class="filter-btn" id="addQuoteItem" type="button">＋ إضافة بند</button></div>
                <div class="quote-table-wrap"><table class="quote-table"><thead><tr><th>الصنف المسجل</th><th>الوحدة</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th><th><span class="visually-hidden">حذف</span></th></tr></thead><tbody id="quoteItems"></tbody></table></div>
                <div class="quote-bottom-row">
                    <p class="quote-note">الأسعار بالريال السعودي، وتُحتسب الضريبة تلقائيًا.</p>
                    <dl class="quote-totals"><div><dt>المجموع قبل الضريبة</dt><dd id="quoteSubtotal">0.00 ر.س</dd></div><div><dt>ضريبة القيمة المضافة (15%)</dt><dd id="quoteTax">0.00 ر.س</dd></div><div class="quote-grand-total"><dt>الإجمالي شامل الضريبة</dt><dd id="quoteTotal">0.00 ر.س</dd></div></dl>
                </div>
                <div class="quote-form-footer"><span class="quote-save-message" id="quoteSaveMessage">المسودة تحفظ على هذا الجهاز</span><button class="primary-btn" id="saveQuote" type="submit">حفظ المسودة</button></div>
            </section>
        </form>
        <section class="saved-quotes"><div class="quote-saved-heading"><h3>العروض المحفوظة</h3><span id="quoteCount">0 عرض</span></div><div id="savedQuotesList" class="saved-quotes-list"></div></section>
    </div>`;
    workspacePanel.hidden = false;

    const quoteForm = workspaceContent.querySelector('#quoteForm');
    const quoteItems = workspaceContent.querySelector('#quoteItems');
    const quotes = getSavedQuotes();
    const clients = getSectionRecords('clients');
    let editingQuoteId = null;
    const currency = (amount) => `${Number(amount || 0).toLocaleString(getActiveLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeLanguage === 'en' ? 'SAR' : 'ر.س'}`;
    const localDate = () => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    };

    clients.forEach((client) => {
        const option = document.createElement('option');
        option.value = client.values?.[0] || '';
        if (option.value) workspaceContent.querySelector('#quoteClients').append(option);
    });

    const updateQuoteTotals = () => {
        let subtotal = 0;
        quoteItems.querySelectorAll('tr').forEach((row) => {
            const quantity = Number(row.querySelector('[name="quantity"]').value) || 0;
            const price = Number(row.querySelector('[name="price"]').value) || 0;
            const lineTotal = quantity * price;
            subtotal += lineTotal;
            row.querySelector('.quote-line-total').textContent = currency(lineTotal);
        });
        const tax = subtotal * 0.15;
        workspaceContent.querySelector('#quoteSubtotal').textContent = currency(subtotal);
        workspaceContent.querySelector('#quoteTax').textContent = currency(tax);
        workspaceContent.querySelector('#quoteTotal').textContent = currency(subtotal + tax);
        return { subtotal, tax, total: subtotal + tax };
    };

    const addQuoteItem = (item = {}) => {
        const row = document.createElement('tr');
        const itemCell = document.createElement('td');
        const itemInput = document.createElement('input');
        itemInput.name = 'itemName';
        itemInput.placeholder = 'اسم الصنف أو الخدمة';
        itemInput.value = item.name || '';
        itemInput.required = true;
        itemCell.append(itemInput);

        const unitCell = document.createElement('td');
        const unitSelect = document.createElement('select');
        unitSelect.name = 'unit';
        ['قطعة', 'خدمة', 'ساعة', 'متر', 'مجموعة'].forEach((unit) => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.append(option);
        });
        unitSelect.value = item.unit || 'قطعة';
        unitCell.append(unitSelect);

        const quantityCell = document.createElement('td');
        const quantityInput = document.createElement('input');
        quantityInput.name = 'quantity';
        quantityInput.type = 'number';
        quantityInput.min = '0.01';
        quantityInput.step = 'any';
        quantityInput.placeholder = '1';
        quantityInput.value = item.quantity ?? '1';
        quantityInput.required = true;
        quantityCell.append(quantityInput);

        const priceCell = document.createElement('td');
        const priceInput = document.createElement('input');
        priceInput.name = 'price';
        priceInput.type = 'number';
        priceInput.min = '0';
        priceInput.step = 'any';
        priceInput.placeholder = '0.00';
        priceInput.value = item.price ?? '';
        priceInput.required = true;
        priceCell.append(priceInput);

        const totalCell = document.createElement('td');
        totalCell.className = 'quote-line-total';
        totalCell.textContent = currency((Number(item.quantity) || 0) * (Number(item.price) || 0));
        const actionCell = document.createElement('td');
        const removeButton = document.createElement('button');
        removeButton.className = 'quote-remove-item';
        removeButton.type = 'button';
        removeButton.setAttribute('aria-label', 'حذف البند');
        removeButton.title = 'حذف البند';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
            if (quoteItems.children.length > 1) row.remove();
            else {
                itemInput.value = '';
                quantityInput.value = '1';
                priceInput.value = '';
            }
            updateQuoteTotals();
        });
        actionCell.append(removeButton);
        row.append(itemCell, unitCell, quantityCell, priceCell, totalCell, actionCell);
        row.querySelectorAll('input, select').forEach((input) => input.addEventListener('input', updateQuoteTotals));
        quoteItems.append(row);
        updateQuoteTotals();
    };

    const renderSavedQuotes = () => {
        const list = workspaceContent.querySelector('#savedQuotesList');
        list.replaceChildren();
        workspaceContent.querySelector('#quoteCount').textContent = `${quotes.length} عرض`;
        if (!quotes.length) {
            const empty = document.createElement('p');
            empty.className = 'saved-quotes-empty';
            empty.textContent = 'لا توجد عروض محفوظة بعد.';
            list.append(empty);
            return;
        }
        quotes.forEach((quote) => {
            const button = document.createElement('button');
            button.className = 'saved-quote';
            button.type = 'button';
            const title = document.createElement('strong');
            title.textContent = quote.customer || 'عميل';
            const detail = document.createElement('span');
            detail.textContent = `${quote.subject} · ${quote.quoteDate} · ${currency(quote.total)}`;
            button.append(title, detail);
            button.addEventListener('click', () => {
                Object.entries(quote.details).forEach(([name, value]) => {
                    const field = quoteForm.elements.namedItem(name);
                    if (field) field.value = value;
                });
                quoteItems.replaceChildren();
                quote.items.forEach((item) => addQuoteItem(item));
                editingQuoteId = quote.id;
                workspaceContent.querySelector('#quoteStatus').textContent = 'تعديل مسودة محفوظة';
                workspaceContent.querySelector('#saveQuote').textContent = 'حفظ التغييرات';
                updateQuoteTotals();
                quoteForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            list.append(button);
        });
    };

    quoteForm.elements.namedItem('quoteDate').value = localDate();
    try {
        const sessionUser = JSON.parse(sessionStorage.getItem('idh-session-user') || 'null');
        quoteForm.elements.namedItem('representative').value = sessionUser?.username || 'ENGFT';
    } catch (error) {
        quoteForm.elements.namedItem('representative').value = 'ENGFT';
    }
    addQuoteItem();
    renderSavedQuotes();
    workspaceContent.querySelector('#addQuoteItem').addEventListener('click', () => addQuoteItem());
    workspaceContent.querySelector('#newQuote').addEventListener('click', () => {
        quoteForm.reset();
        quoteItems.replaceChildren();
        addQuoteItem();
        quoteForm.elements.namedItem('quoteDate').value = localDate();
        workspaceContent.querySelector('#quoteSaveMessage').textContent = 'المسودة تحفظ على هذا الجهاز';
        editingQuoteId = null;
        workspaceContent.querySelector('#quoteStatus').textContent = 'مسودة جديدة';
        workspaceContent.querySelector('#saveQuote').textContent = 'حفظ المسودة';
        try {
            const sessionUser = JSON.parse(sessionStorage.getItem('idh-session-user') || 'null');
            quoteForm.elements.namedItem('representative').value = sessionUser?.username || 'ENGFT';
        } catch (error) {
            quoteForm.elements.namedItem('representative').value = 'ENGFT';
        }
        quoteForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    quoteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const items = [...quoteItems.querySelectorAll('tr')].map((row) => ({
            name: row.querySelector('[name="itemName"]').value.trim(),
            unit: row.querySelector('[name="unit"]').value,
            quantity: Number(row.querySelector('[name="quantity"]').value),
            price: Number(row.querySelector('[name="price"]').value)
        }));
        if (!items.length || items.some((item) => !item.name || !item.quantity || item.price < 0)) return showToast('أكمل بيانات بند واحد على الأقل');
        const totals = updateQuoteTotals();
        const detailFields = ['customer', 'orderType', 'quoteDate', 'subject', 'representative', 'deliveryDays', 'warranty', 'paymentTerms'];
        const details = Object.fromEntries(detailFields.map((name) => [name, quoteForm.elements.namedItem(name).value]));
        const existingIndex = quotes.findIndex((quote) => quote.id === editingQuoteId);
        const quote = { id: editingQuoteId || `quote-${Date.now()}`, details, ...details, items, ...totals, updatedAt: new Date().toISOString() };
        if (existingIndex >= 0) quotes[existingIndex] = quote;
        else quotes.unshift(quote);
        localStorage.setItem('idh-quotes', JSON.stringify(quotes));
        editingQuoteId = quote.id;
        workspaceContent.querySelector('#quoteStatus').textContent = 'مسودة محفوظة';
        workspaceContent.querySelector('#saveQuote').textContent = 'حفظ التغييرات';
        workspaceContent.querySelector('#quoteSaveMessage').textContent = 'تم حفظ المسودة على هذا الجهاز';
        renderSavedQuotes();
        showToast('تم حفظ عرض السعر بنجاح');
    });
}

function openDataCenter() {
    workspaceTitle.textContent = 'مركز تخزين البيانات';
    document.getElementById('workspaceSubtitle').textContent = 'استعراض وبحث وطباعة السجلات المحلية وبيانات الموظفين';
    workspaceContent.innerHTML = `<section class="data-center-view">
        <div class="data-center-toolbar">
            <label class="data-center-filter">نوع البيانات<select id="dataCenterType" aria-label="نوع البيانات"><option value="all">كل البيانات</option><option value="quotes">عروض الأسعار</option></select></label>
            <label class="data-center-search">بحث<input id="dataCenterSearch" type="search" placeholder="ابحث في السجلات" /></label>
            <div class="data-center-actions"><button class="filter-btn" id="refreshDataCenter" type="button">↻ تحديث</button><button class="primary-btn" id="printDataCenter" type="button">▣ طباعة</button><button class="filter-btn" data-export-format="xlsx" type="button" title="تنزيل ملف Excel">Excel</button><button class="filter-btn" data-export-format="docx" type="button" title="تنزيل ملف Word">Word</button><button class="filter-btn" data-export-format="csv" type="button" title="CSV للاستيراد إلى Access">Access · CSV</button></div>
        </div>
        <div class="data-center-summary"><strong id="dataCenterCount">0 سجل</strong><span>المصدر: بيانات المتصفح وGoogle Sheets · Access عبر استيراد CSV</span></div>
        <div class="data-center-table-wrap"><table class="data-center-table"><thead><tr><th>نوع السجل</th><th>العنوان</th><th>التاريخ</th><th>التفاصيل</th><th>القيمة</th></tr></thead><tbody id="dataCenterRows"></tbody></table></div>
        <p class="data-center-empty" id="dataCenterEmpty" hidden>لا توجد سجلات مطابقة. احفظ سجلات أو عروض أسعار أولًا.</p>
    </section>`;
    workspacePanel.hidden = false;
    workspacePanel.classList.add('data-center-print');

    const typeSelect = workspaceContent.querySelector('#dataCenterType');
    const searchField = workspaceContent.querySelector('#dataCenterSearch');
    let sheetEmployees = [];
    const collectRecords = () => {
        const quotes = getSavedQuotes().map((quote) => ({
            type: 'عرض سعر',
            typeKey: 'quotes',
            title: quote.customer || 'عميل غير محدد',
            date: quote.quoteDate || quote.updatedAt,
            details: [quote.subject, ...(quote.items || []).map((item) => `${item.name}، ${item.quantity} ${item.unit} × ${item.price}`)].filter(Boolean).join(' · '),
            amount: Number(quote.total) || 0
        }));
        const sectionRecords = Object.entries(workspaceSections)
            .filter(([key]) => key !== 'users')
            .flatMap(([key, section]) => getSectionRecords(key).map((record) => {
                const values = Array.isArray(record.values) ? record.values : [];
                const title = values[0] || section.title;
                const details = values.slice(1).map((value, index) => {
                    const field = section.fields[index + 1];
                    const label = typeof field === 'string' ? field : field?.label;
                    return `${label || 'تفصيل'}: ${value}`;
                }).join(' · ');
                return {
                    type: section.title,
                    typeKey: key,
                    title,
                    date: record.updatedAt || record.createdAt,
                    details,
                    amount: null
                };
            }));
        const employeeRecords = sheetEmployees.map((employee) => ({
            type: 'موظف',
            typeKey: 'employees',
            title: employee.name,
            date: employee.startDate,
            details: [employee.department, employee.position, employee.phone, employee.email, employee.status].filter(Boolean).join(' · '),
            amount: null
        }));
        return [...quotes, ...sectionRecords, ...employeeRecords];
    };
    const getVisibleRecords = () => {
        const selectedType = typeSelect.value;
        const term = searchField.value.trim().toLocaleLowerCase();
        return collectRecords().filter((record) => {
            const matchesType = selectedType === 'all' || record.typeKey === selectedType;
            const searchable = `${record.type} ${record.title} ${record.date || ''} ${record.details}`.toLocaleLowerCase();
            return matchesType && (!term || searchable.includes(term));
        });
    };
    const renderRecords = () => {
        const records = getVisibleRecords();
        const rows = workspaceContent.querySelector('#dataCenterRows');
        rows.replaceChildren();
        workspaceContent.querySelector('#dataCenterCount').textContent = `${records.length} سجل`;
        workspaceContent.querySelector('#dataCenterEmpty').hidden = records.length > 0;
        records.forEach((record) => {
            const row = document.createElement('tr');
            const values = [record.type, record.title, record.date ? new Date(record.date).toLocaleDateString(getActiveLocale()) : '—', record.details || '—', record.amount === null ? '—' : `${record.amount.toLocaleString(getActiveLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${activeLanguage === 'en' ? 'SAR' : 'ر.س'}`];
            values.forEach((value) => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            });
            rows.append(row);
        });
    };
    const exportButtons = [...workspaceContent.querySelectorAll('[data-export-format]')];
    exportButtons.forEach((button) => button.addEventListener('click', async () => {
        const records = getVisibleRecords();
        if (!records.length) return showToast('لا توجد سجلات لتصديرها.');
        const token = sessionStorage.getItem('idh-api-token');
        if (!token) return showToast('سجّل الدخول أولًا لتصدير البيانات.');
        exportButtons.forEach((item) => { item.disabled = true; });
        try {
            const response = await fetch('/api/data-center/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ format: button.dataset.exportFormat, records })
            });
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || 'تعذر إنشاء ملف التصدير.');
            }
            const downloadUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `idh-data-center-${new Date().toISOString().slice(0, 10)}.${button.dataset.exportFormat}`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            showToast('تم تنزيل ملف التصدير بنجاح.');
        } catch (error) {
            showToast(error.message || 'تعذر إنشاء ملف التصدير.');
        } finally {
            exportButtons.forEach((item) => { item.disabled = false; });
        }
    }));

    typeSelect.querySelector('option[value="quotes"]').textContent = 'عروض الأسعار';
    Object.entries(workspaceSections).forEach(([key, section]) => {
        if (key === 'users') return;
        const option = document.createElement('option');
        option.value = key;
        option.textContent = section.title;
        typeSelect.append(option);
    });
    typeSelect.addEventListener('change', renderRecords);
    searchField.addEventListener('input', renderRecords);
    workspaceContent.querySelector('#refreshDataCenter').addEventListener('click', () => {
        renderRecords();
        if (sessionStorage.getItem('idh-api-token') && (userHasPermission(activeAccount, 'employees') || userHasPermission(activeAccount, 'dataCenter'))) {
            apiRequest('/api/employees').then((result) => {
                sheetEmployees = result.employees || [];
                renderRecords();
            }).catch(() => showToast('تعذر تحديث بيانات الموظفين من Google Sheets'));
        }
        showToast('تم تحديث السجلات المحفوظة');
    });
    workspaceContent.querySelector('#printDataCenter').addEventListener('click', () => window.print());
    renderRecords();
    if (sessionStorage.getItem('idh-api-token') && (userHasPermission(activeAccount, 'employees') || userHasPermission(activeAccount, 'dataCenter'))) {
        apiRequest('/api/employees').then((result) => {
            sheetEmployees = result.employees || [];
            renderRecords();
        }).catch(() => { });
    }
}

function openEmployeeWorkspace() {
    workspaceTitle.textContent = 'إدارة الموظفين';
    document.getElementById('workspaceSubtitle').textContent = 'حفظ بيانات الموظفين واستعراضها من Google Sheets';
    workspaceContent.innerHTML = `<section class="employee-workspace">
        <form class="employee-form" id="employeeForm">
            <label>اسم الموظف<input name="name" autocomplete="name" required /></label>
            <label>القسم<input name="department" required /></label>
            <label>المسمى الوظيفي<input name="position" required /></label>
            <label>رقم الهاتف<input name="phone" type="tel" autocomplete="tel" /></label>
            <label>البريد الإلكتروني<input name="email" type="email" autocomplete="email" /></label>
            <label>تاريخ المباشرة<input name="startDate" type="date" required /></label>
            <label>الحالة الوظيفية<select name="status"><option>نشط</option><option>إجازة</option><option>متوقف</option></select></label>
            <div class="employee-form-footer"><span id="employeeMessage" role="status">تُحفظ البيانات في ورقة Employees.</span><button class="primary-btn" type="submit">حفظ الموظف</button></div>
        </form>
        <div class="employee-list-heading"><h3>سجل الموظفين</h3><button class="filter-btn" id="refreshEmployees" type="button">↻ تحديث</button></div>
        <div class="employee-table-wrap"><table class="employee-table"><thead><tr><th>رقم الموظف</th><th>الاسم</th><th>القسم</th><th>المسمى الوظيفي</th><th>الهاتف</th><th>البريد الإلكتروني</th><th>تاريخ المباشرة</th><th>الحالة</th></tr></thead><tbody id="employeeRows"></tbody></table></div>
    </section>`;
    workspacePanel.hidden = false;
    workspacePanel.classList.remove('data-center-print');

    const form = workspaceContent.querySelector('#employeeForm');
    const message = workspaceContent.querySelector('#employeeMessage');
    const submitButton = form.querySelector('button[type="submit"]');
    const renderEmployees = (employees) => {
        const rows = workspaceContent.querySelector('#employeeRows');
        rows.replaceChildren();
        employees.forEach((employee) => {
            const row = document.createElement('tr');
            [employee.id, employee.name, employee.department, employee.position, employee.phone, employee.email, employee.startDate, employee.status].forEach((value) => {
                const cell = document.createElement('td');
                cell.textContent = value || '—';
                row.append(cell);
            });
            rows.append(row);
        });
        if (!employees.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 8;
            cell.textContent = 'لا توجد بيانات موظفين محفوظة.';
            row.append(cell);
            rows.append(row);
        }
    };
    const loadEmployees = async () => {
        message.textContent = 'جارٍ تحميل البيانات من Google Sheets...';
        try {
            const result = await apiRequest('/api/employees');
            const employees = result.employees || [];
            renderEmployees(employees);
            message.textContent = `تم تحميل ${employees.length} موظف من Google Sheets.`;
        } catch (error) {
            renderEmployees([]);
            message.textContent = error.message || 'تعذر الاتصال بـ Google Sheets.';
        }
    };

    form.elements.namedItem('startDate').value = new Date().toLocaleDateString('en-CA');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        message.textContent = 'جارٍ حفظ بيانات الموظف...';
        const employee = Object.fromEntries(new FormData(form).entries());
        try {
            await apiRequest('/api/employees', { method: 'POST', body: JSON.stringify(employee) });
            form.reset();
            form.elements.namedItem('startDate').value = new Date().toLocaleDateString('en-CA');
            message.textContent = 'تم حفظ بيانات الموظف في Google Sheets.';
            showToast('تم حفظ الموظف بنجاح');
            await loadEmployees();
        } catch (error) {
            message.textContent = error.message || 'تعذر حفظ بيانات الموظف.';
            showToast('لم يتم حفظ الموظف');
        } finally {
            submitButton.disabled = false;
        }
    });
    workspaceContent.querySelector('#refreshEmployees').addEventListener('click', loadEmployees);
    loadEmployees();
}

function openWorkspace(sectionKey) {
    document.querySelector('.main-content').classList.add('workspace-open');
    workspacePanel.classList.toggle('data-center-print', sectionKey === 'dataCenter');
    if (sectionKey === 'settings') {
        openOrganizationSettings();
        return;
    }
    if (sectionKey === 'assistant') {
        openSystemAssistant();
        return;
    }
    if (sectionKey === 'dataCenter') {
        openDataCenter();
        return;
    }
    if (sectionKey === 'employees') {
        openEmployeeWorkspace();
        return;
    }
    const section = workspaceSections[sectionKey];
    if (!section) return;
    if (sectionKey === 'offers') {
        openQuoteWorkspace();
        return;
    }
    workspaceTitle.textContent = section.title;
    document.getElementById('workspaceSubtitle').textContent = section.subtitle;
    const filterButton = section.dateFilter ? '<button class="filter-btn" data-workspace-action="filter">⌕ تصفية بالتاريخ</button>' : '';
    const actionBar = sectionKey === 'users'
        ? '<div class="workspace-actions"><button class="primary-btn" data-workspace-action="add">＋ إضافة جديد</button><button class="filter-btn" data-workspace-action="view" aria-expanded="false">عرض السجلات</button></div>'
        : `<div class="workspace-actions"><button class="primary-btn" data-workspace-action="add">＋ إضافة جديد</button><button class="filter-btn" data-workspace-action="edit">✎ تعديل المحدد</button><button class="filter-btn" data-workspace-action="delete">⌫ حذف المحدد</button>${filterButton}<button class="filter-btn" data-workspace-action="export">⇩ تصدير القسم</button><button class="filter-btn" data-workspace-action="view" aria-expanded="false">عرض السجلات</button></div>`;
    const permissionOptions = Object.entries(assignablePermissions).map(([key, label]) => `<label class="user-permission-option"><input type="checkbox" name="permissions" value="${key}" /><span>${label}</span></label>`).join('');
    const userForm = `<form class="workspace-form user-create-form" id="userCreateForm"><label>اسم المستخدم<input type="text" name="username" autocomplete="username" pattern="(?:[A-Za-z0-9_.]|-){3,32}" minlength="3" maxlength="32" required /></label><label>البريد الإلكتروني<input type="email" name="email" autocomplete="email" maxlength="254" required /></label><label>كلمة المرور<div class="password-field"><input type="password" name="password" autocomplete="new-password" minlength="12" maxlength="72" placeholder="12 حرفًا على الأقل" required /><button class="password-toggle" type="button" aria-label="إظهار كلمة المرور" aria-pressed="false">إظهار</button></div></label><label>تأكيد كلمة المرور<div class="password-field"><input type="password" name="confirmation" autocomplete="new-password" minlength="12" maxlength="72" placeholder="أعد كتابة كلمة المرور" required /><button class="password-toggle" type="button" aria-label="إظهار كلمة المرور" aria-pressed="false">إظهار</button></div></label><label>الدور الوظيفي<select name="role"><option value="hr">مسؤول الموارد البشرية</option><option value="projectManager">مدير المشاريع</option><option value="accountant">المحاسب</option><option value="custom">صلاحيات مخصصة</option><option value="admin">مدير النظام</option></select></label><fieldset class="user-permission-picker"><legend>الأقسام المسموح بها</legend><div class="user-permission-options">${permissionOptions}<label class="user-permission-option full-access-option"><input type="checkbox" name="permissions" value="*" /><span>كامل صلاحيات النظام</span></label></div></fieldset><div class="workspace-form-footer"><button class="primary-btn" type="submit">حفظ حساب المستخدم</button><span class="permission-note">كلمات المرور تُحفظ مشفرة على الخادم.</span></div></form>`;
    const standardForm = `<form class="workspace-form" id="sectionForm">${section.fields.map((field, index) => { const item = typeof field === 'string' ? { label: field, type: 'text' } : field; return `<label>${item.label}<input type="${item.type}" name="field${index}" placeholder="${item.type === 'date' ? '' : `أدخل ${item.label}`}" required /></label>`; }).join('')}<div class="workspace-form-footer"><button class="primary-btn" type="submit">حفظ التغييرات</button><span class="permission-note">ENGFT · مدير النظام · كامل الصلاحيات</span></div></form>`;
    const accountRequestsPanel = sectionKey === 'users' ? `<section class="account-request-panel"><div class="account-request-heading"><h3>طلبات إنشاء الحساب</h3><button class="filter-btn" id="refreshAccountRequests" type="button">↻ تحديث</button></div><p id="accountRequestsMessage" role="status">جارٍ تحميل الطلبات...</p><div id="accountRequestsList" class="account-requests-list"></div></section>` : '';
    workspaceContent.innerHTML = `${actionBar}${sectionKey === 'users' ? userForm : standardForm}${accountRequestsPanel}<div class="workspace-list" id="workspaceRecordsPanel" hidden><b>${sectionKey === 'users' ? 'الحسابات الحالية' : 'آخر السجلات'}</b><span class="workspace-message">${sectionKey === 'users' ? 'جارٍ تحميل الحسابات...' : 'لا توجد سجلات محفوظة في هذا القسم.'}</span><div class="workspace-records" role="list"></div></div>`;
    setupPasswordVisibility(workspaceContent);
    workspacePanel.hidden = false;
    const standardFormElement = workspaceContent.querySelector('#sectionForm');
    const sectionRecords = getSectionRecords(sectionKey);
    let selectedRecordIndex = -1;
    let editingRecordIndex = -1;
    const renderRecords = (visibleRecords = sectionRecords) => {
        const recordsContainer = workspaceContent.querySelector('.workspace-records');
        const message = workspaceContent.querySelector('.workspace-message');
        recordsContainer.replaceChildren();
        message.textContent = visibleRecords.length
            ? `المعروض ${visibleRecords.length} من ${sectionRecords.length} سجل.`
            : sectionRecords.length ? 'لا توجد نتائج مطابقة.' : 'لا توجد سجلات محفوظة في هذا القسم.';
        visibleRecords.forEach((record) => {
            const recordIndex = sectionRecords.indexOf(record);
            const recordButton = document.createElement('button');
            recordButton.className = 'workspace-record';
            recordButton.type = 'button';
            recordButton.setAttribute('role', 'listitem');
            recordButton.setAttribute('aria-pressed', String(selectedRecordIndex === recordIndex));
            recordButton.classList.toggle('selected', selectedRecordIndex === recordIndex);
            recordButton.textContent = record.values.map((value, index) => `${section.fields[index].label || section.fields[index]}: ${value}`).join(' · ');
            recordButton.addEventListener('click', () => {
                selectedRecordIndex = recordIndex;
                renderRecords(visibleRecords);
                workspaceContent.querySelector('.workspace-record.selected')?.focus({ preventScroll: true });
            });
            recordsContainer.append(recordButton);
        });
    };
    if (sectionKey !== 'users') renderRecords();
    if (standardFormElement) standardFormElement.addEventListener('submit', (event) => {
        event.preventDefault();
        const values = [...standardFormElement.querySelectorAll('input')].map((input) => input.value.trim());
        const record = { values, updatedAt: new Date().toISOString() };
        if (editingRecordIndex >= 0) {
            sectionRecords[editingRecordIndex] = record;
            selectedRecordIndex = editingRecordIndex;
        } else {
            sectionRecords.unshift(record);
            selectedRecordIndex = 0;
        }
        saveSectionRecords(sectionKey, sectionRecords);
        editingRecordIndex = -1;
        standardFormElement.reset();
        standardFormElement.querySelector('button[type="submit"]').textContent = 'حفظ التغييرات';
        renderRecords();
        workspaceContent.querySelector('.workspace-record.selected')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast(`تم حفظ السجل في ${section.title}`);
    });
    const userFormElement = workspaceContent.querySelector('#userCreateForm');
    if (userFormElement) {
        const roleSelect = userFormElement.elements.namedItem('role');
        const permissionChecks = [...userFormElement.querySelectorAll('input[name="permissions"]')];
        const fullPermissionCheck = permissionChecks.find((input) => input.value === '*');
        const sectionPermissionChecks = permissionChecks.filter((input) => input.value !== '*');
        const applyRolePreset = (roleKey) => {
            const permissions = rolePresets[roleKey]?.permissions || [];
            permissionChecks.forEach((input) => {
                input.checked = permissions.includes(input.value);
                if (input.value !== '*') input.disabled = permissions.includes('*');
            });
        };
        const renderUserAccounts = (users) => {
            const container = workspaceContent.querySelector('.workspace-records');
            container.replaceChildren();
            users.forEach((user) => {
                const item = document.createElement('div');
                item.className = 'user-account-row';
                const identity = document.createElement('strong');
                identity.textContent = `${user.username} · ${user.role}`;
                const granted = document.createElement('span');
                const userPermissions = getPermissionKeys(user.permissions);
                granted.textContent = userPermissions.includes('*')
                    ? 'كامل الصلاحيات'
                    : userPermissions.map((permission) => assignablePermissions[permission]).filter(Boolean).join('، ') || 'بدون صلاحيات';
                item.append(identity, granted);
                container.append(item);
            });
            workspaceContent.querySelector('.workspace-message').textContent = users.length
                ? `عدد الحسابات: ${users.length}`
                : 'لا توجد حسابات أخرى.';
        };
        const loadUserAccounts = async () => {
            try {
                const users = await apiRequest('/api/users');
                renderUserAccounts(users);
            } catch (error) {
                workspaceContent.querySelector('.workspace-message').textContent = error.message || 'تعذر تحميل الحسابات. شغّل الخادم وسجّل الدخول كمدير.';
            }
        };
        const loadAccountRequests = async () => {
            const list = workspaceContent.querySelector('#accountRequestsList');
            const message = workspaceContent.querySelector('#accountRequestsMessage');
            message.textContent = 'جارٍ تحميل الطلبات...';
            try {
                const requests = await apiRequest('/api/account-requests');
                list.replaceChildren();
                requests.forEach((accountRequest) => {
                    const item = document.createElement('article');
                    item.className = 'account-request-item';
                    const summary = document.createElement('div');
                    summary.className = 'account-request-summary';
                    const identity = document.createElement('strong');
                    identity.textContent = `${accountRequest.username} · ${accountRequest.email}`;
                    const createdAt = document.createElement('small');
                    createdAt.textContent = new Date(`${accountRequest.created_at}Z`).toLocaleString(getActiveLocale());
                    summary.append(identity, createdAt);
                    const controls = document.createElement('div');
                    controls.className = 'account-request-controls';
                    const roleSelect = document.createElement('select');
                    roleSelect.setAttribute('aria-label', `دور المستخدم ${accountRequest.username}`);
                    roleSelect.innerHTML = '<option value="hr">مسؤول الموارد البشرية</option><option value="projectManager">مدير المشاريع</option><option value="accountant">المحاسب</option>';
                    const approveButton = document.createElement('button');
                    approveButton.className = 'primary-btn';
                    approveButton.type = 'button';
                    approveButton.textContent = 'اعتماد';
                    approveButton.addEventListener('click', async () => {
                        approveButton.disabled = true;
                        try {
                            await apiRequest(`/api/account-requests/${accountRequest.id}/approve`, {
                                method: 'POST', body: JSON.stringify({ roleKey: roleSelect.value })
                            });
                            showToast(`تم اعتماد حساب ${accountRequest.username}`);
                            await loadAccountRequests();
                            await loadUserAccounts();
                        } catch (error) {
                            showToast(error.message || 'تعذر اعتماد الطلب.');
                            approveButton.disabled = false;
                        }
                    });
                    const rejectButton = document.createElement('button');
                    rejectButton.className = 'filter-btn';
                    rejectButton.type = 'button';
                    rejectButton.textContent = 'رفض';
                    rejectButton.addEventListener('click', async () => {
                        if (!window.confirm(`هل تريد رفض طلب ${accountRequest.username}؟`)) return;
                        rejectButton.disabled = true;
                        try {
                            await apiRequest(`/api/account-requests/${accountRequest.id}`, { method: 'DELETE' });
                            showToast('تم رفض طلب إنشاء الحساب.');
                            await loadAccountRequests();
                        } catch (error) {
                            showToast(error.message || 'تعذر رفض الطلب.');
                            rejectButton.disabled = false;
                        }
                    });
                    controls.append(roleSelect, approveButton, rejectButton);
                    item.append(summary, controls);
                    list.append(item);
                });
                message.textContent = requests.length ? `طلبات بانتظار المراجعة: ${requests.length}` : 'لا توجد طلبات معلّقة.';
            } catch (error) {
                list.replaceChildren();
                message.textContent = error.message || 'تعذر تحميل طلبات الحساب.';
            }
        };

        roleSelect.addEventListener('change', () => applyRolePreset(roleSelect.value));
        permissionChecks.forEach((input) => input.addEventListener('change', () => {
            if (input.value === '*') {
                sectionPermissionChecks.forEach((sectionInput) => {
                    sectionInput.checked = false;
                    sectionInput.disabled = input.checked;
                });
                roleSelect.value = input.checked ? 'admin' : 'custom';
            } else {
                fullPermissionCheck.checked = false;
                sectionPermissionChecks.forEach((sectionInput) => { sectionInput.disabled = false; });
                roleSelect.value = 'custom';
            }
        }));
        applyRolePreset(roleSelect.value);
        userFormElement.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(userFormElement);
            const username = formData.get('username').trim();
            const email = formData.get('email').trim();
            const password = formData.get('password');
            const confirmation = formData.get('confirmation');
            const selectedPermissions = permissionChecks.filter((input) => input.checked).map((input) => input.value);
            const role = rolePresets[roleSelect.value]?.label || rolePresets.custom.label;
            const message = workspaceContent.querySelector('.workspace-message');
            if (password !== confirmation) return showToast('كلمتا المرور غير متطابقتين');
            if (!selectedPermissions.length) return showToast('اختر قسمًا واحدًا على الأقل');
            try {
                const createdUser = await apiRequest('/api/users', { method: 'POST', body: JSON.stringify({ username, email, password, role, permissions: selectedPermissions }) });
                userFormElement.reset();
                roleSelect.value = 'hr';
                applyRolePreset('hr');
                message.textContent = `تم إنشاء حساب ${createdUser.username} بدور ${createdUser.role}.`;
                showToast(`تم إنشاء حساب ${createdUser.username} بنجاح`);
                await loadUserAccounts();
            } catch (error) {
                message.textContent = error.message || 'تعذر إنشاء الحساب. تأكد من تشغيل الخادم.';
                showToast(error.message || 'تعذر إنشاء الحساب');
            }
        });
        loadUserAccounts();
        loadAccountRequests();
        workspaceContent.querySelector('#refreshAccountRequests').addEventListener('click', loadAccountRequests);
    }
    workspaceContent.querySelectorAll('[data-workspace-action]').forEach((button) => button.addEventListener('click', async () => {
        const actionNames = { add: 'إضافة سجل جديد', edit: 'تعديل السجل المحدد', delete: 'حذف السجل المحدد', filter: 'تصفية البيانات بالتاريخ', export: 'تصدير بيانات القسم', view: 'عرض السجلات' };
        if (button.dataset.workspaceAction === 'view') {
            const recordsPanel = workspaceContent.querySelector('#workspaceRecordsPanel');
            recordsPanel.hidden = !recordsPanel.hidden;
            button.textContent = recordsPanel.hidden ? 'عرض السجلات' : 'إخفاء السجلات';
            button.setAttribute('aria-expanded', String(!recordsPanel.hidden));
            if (!recordsPanel.hidden) recordsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            return;
        }
        if (sectionKey === 'users' && button.dataset.workspaceAction === 'add') {
            workspaceContent.querySelector('#userCreateForm input[name="username"]').focus();
            showToast('استخدم نموذج إنشاء الحساب الجديد');
            return;
        }
        if (sectionKey !== 'users' && button.dataset.workspaceAction === 'add') {
            editingRecordIndex = -1;
            standardFormElement.reset();
            standardFormElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            standardFormElement.querySelector('input').focus();
            showToast('أدخل بيانات السجل الجديد ثم احفظه');
            return;
        }
        if (sectionKey !== 'users' && button.dataset.workspaceAction === 'edit') {
            if (selectedRecordIndex < 0) return showToast('اختر سجلًا من القائمة أولًا');
            editingRecordIndex = selectedRecordIndex;
            sectionRecords[selectedRecordIndex].values.forEach((value, index) => {
                standardFormElement.querySelector(`[name="field${index}"]`).value = value;
            });
            standardFormElement.querySelector('button[type="submit"]').textContent = 'حفظ التعديل';
            standardFormElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            standardFormElement.querySelector('input').focus({ preventScroll: true });
            showToast('عدّل البيانات ثم احفظ التغييرات');
            return;
        }
        if (sectionKey !== 'users' && button.dataset.workspaceAction === 'delete') {
            if (selectedRecordIndex < 0) return showToast('اختر سجلًا من القائمة أولًا');
            if (!window.confirm('هل تريد حذف السجل المحدد؟')) return;
            const deletedIndex = selectedRecordIndex;
            sectionRecords.splice(selectedRecordIndex, 1);
            saveSectionRecords(sectionKey, sectionRecords);
            selectedRecordIndex = sectionRecords.length ? Math.min(deletedIndex, sectionRecords.length - 1) : -1;
            renderRecords();
            workspaceContent.querySelector('.workspace-record.selected')?.focus({ preventScroll: true });
            showToast('تم حذف السجل المحدد');
            return;
        }
        if (sectionKey !== 'users' && button.dataset.workspaceAction === 'export') {
            const headers = section.fields.map((field) => typeof field === 'string' ? field : field.label);
            const escapeCsv = (value) => {
                let text = String(value ?? '');
                if (/^[\s]*[=+@\-\t\r]/.test(text)) text = `'${text}`;
                return `"${text.replace(/"/g, '""')}"`;
            };
            const csv = `\uFEFF${[headers, ...sectionRecords.map((record) => record.values)].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
            link.download = `idh-${sectionKey}-export.csv`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            showToast('تم تصدير سجلات القسم إلى CSV');
            return;
        }
        if (button.dataset.workspaceAction === 'filter') {
            const dateIndexes = section.fields.reduce((indexes, field, index) => {
                if (typeof field !== 'string' && field.type === 'date') indexes.push(index);
                return indexes;
            }, []);
            const dates = dateIndexes.map((index) => standardFormElement.querySelector(`[name="field${index}"]`).value).filter(Boolean);
            if (!dates.length) return showToast('أدخل تاريخًا واحدًا على الأقل في النموذج للتصفية');
            const [startDate, endDate] = dates;
            renderRecords(sectionRecords.filter((record) => {
                const recordDate = record.values[dateIndexes[0]];
                return recordDate && recordDate >= startDate && recordDate <= (endDate || startDate);
            }));
            showToast(`تم عرض السجلات المطابقة للتاريخ ${dates.join(' إلى ')}`);
            return;
        }
        showToast(`${actionNames[button.dataset.workspaceAction]} في ${section.title}`);
    }));
}

function openOrganizationSettings() {
    workspaceTitle.textContent = 'إعدادات المنظمة';
    document.getElementById('workspaceSubtitle').textContent = 'احفظ بيانات المنظمة المستخدمة داخل النظام.';
    workspaceContent.innerHTML = `<section class="organization-settings">
        <form id="organizationSettingsForm" class="organization-settings-form">
            <label>اسم المنظمة<input name="organizationName" maxlength="100" required /></label>
            <label>بريد التواصل<input name="contactEmail" type="email" maxlength="254" /></label>
            <label>رقم الهاتف<input name="contactPhone" type="tel" maxlength="40" /></label>
            <div class="organization-settings-footer"><p id="organizationSettingsMessage" role="status">جارٍ تحميل الإعدادات...</p><button class="primary-btn" type="submit">حفظ إعدادات المنظمة</button></div>
        </form>
        <p class="settings-security-note">إعدادات الخادم السرية، مثل مفاتيح Google وذكاء الاصطناعي، لا تُدار من المتصفح.</p>
    </section>`;
    workspacePanel.hidden = false;

    const form = workspaceContent.querySelector('#organizationSettingsForm');
    const message = workspaceContent.querySelector('#organizationSettingsMessage');
    const applyOrganizationName = (name) => {
        document.querySelectorAll('.org-switcher b, .login-brand strong').forEach((label) => {
            label.textContent = name;
        });
    };
    apiRequest('/api/admin/system-settings').then((settings) => {
        Object.entries(settings).forEach(([key, value]) => {
            const input = form.elements.namedItem(key);
            if (input) input.value = value;
        });
        applyOrganizationName(settings.organizationName);
        message.textContent = '';
    }).catch((error) => {
        message.textContent = error.message || 'تعذر تحميل الإعدادات.';
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        message.textContent = '';
        const settings = Object.fromEntries(new FormData(form).entries());
        try {
            const result = await apiRequest('/api/admin/system-settings', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            message.textContent = result.message;
            applyOrganizationName(result.settings.organizationName);
            showToast(result.message);
        } catch (error) {
            message.textContent = error.message || 'تعذر حفظ إعدادات المنظمة.';
        } finally {
            submitButton.disabled = false;
        }
    });
}

function openSystemAssistant() {
    workspaceTitle.textContent = 'مساعد تطوير النظام';
    document.getElementById('workspaceSubtitle').textContent = 'مراجعة تشغيلية واقتراحات تطوير تحت إشراف مدير النظام';
    workspaceContent.innerHTML = `<section class="system-assistant">
        <div class="assistant-intro">
            <div><p class="assistant-kicker">مركز التحسين المستمر</p><h3>تطوير آمن، خطوة بخطوة</h3><p>افحص حالة النظام وحدد الأولويات قبل اعتماد أي تطوير.</p></div>
            <button class="primary-btn" id="runSystemReview" type="button">↻ إجراء فحص للنظام</button>
        </div>
        <div class="assistant-disclaimer" role="note">الفحص للقراءة فقط ولا يغيّر البيانات أو ملفات النظام. اقتراحات الكود تتطلب ربط مزوّد ذكاء اصطناعي ومراجعة المدير.</div>
        <div class="assistant-review" id="systemReviewResults" aria-live="polite"><p>جارٍ فحص حالة النظام...</p></div>
        <section class="assistant-roadmap"><h3>أولويات تطوير مقترحة</h3><ol>
            <li><strong>نسخ احتياطي قابل للاستعادة</strong><span>جدولة نسخ قاعدة البيانات واختبار استعادتها دوريًا قبل النشر.</span><b>أولوية عالية</b></li>
            <li><strong>التحقق متعدد العوامل</strong><span>إكمال إعداد البريد وOTP لحماية حسابات الإدارة.</span><b>أولوية عالية</b></li>
            <li><strong>سجل تغييرات ومراقبة</strong><span>مراجعة سجل التدقيق والتنبيه عند تكرار الأخطاء أو محاولات الدخول.</span><b>تحسين مستمر</b></li>
            <li><strong>مساعد اقتراحات متصل</strong><span>ربط مزوّد ذكاء اصطناعي موثوق، مع إبقاء أي تعديل برمجي خاضعًا لموافقة المدير.</span><b>يتطلب إعدادًا</b></li>
        </ol></section>
    </section>`;
    workspacePanel.hidden = false;

    const results = workspaceContent.querySelector('#systemReviewResults');
    const renderReview = async () => {
        results.innerHTML = '<p>جارٍ فحص حالة النظام...</p>';
        try {
            const review = await apiRequest('/api/admin/system-review');
            const checks = [
                { title: 'قاعدة البيانات', detail: `${review.database.engine} · متصلة`, status: 'سليم', ready: true },
                { title: 'بيئة التشغيل', detail: `Node.js ${review.runtime.nodeVersion}`, status: 'سليم', ready: true },
                { title: 'Google Sheets والبريد', detail: review.integrations.googleSheetsReady ? 'التكامل مهيأ' : 'أضف رابط النشر والمفتاح السري', status: review.integrations.googleSheetsReady ? 'جاهز' : 'يحتاج إعدادًا', ready: review.integrations.googleSheetsReady },
                { title: 'حساب المدير والبريد', detail: review.accounts.adminEmailConfigured ? 'بريد المدير مسجل' : 'لا يوجد بريد موثق للمدير', status: review.accounts.adminEmailConfigured ? 'جاهز' : 'توصية', ready: review.accounts.adminEmailConfigured },
                { title: 'مزوّد الذكاء الاصطناعي', detail: review.integrations.aiProviderConfigured ? 'الإعدادات موجودة؛ يلزم اختبار الاتصال' : 'غير موصول؛ لا تُرسل بيانات للنظام حاليًا', status: review.integrations.aiProviderConfigured ? 'يتطلب اختبارًا' : 'غير مهيأ', ready: review.integrations.aiProviderConfigured }
            ];
            results.replaceChildren();
            const summary = document.createElement('div');
            summary.className = 'assistant-summary';
            summary.textContent = `الحسابات: ${review.accounts.total} · طلبات معلقة: ${review.accounts.pending} · آخر نشاط: ${review.latestAuditAt || 'لا يوجد'}`;
            results.append(summary);
            const list = document.createElement('div');
            list.className = 'assistant-check-list';
            checks.forEach((check) => {
                const item = document.createElement('article');
                item.className = `assistant-check${check.ready ? ' is-ready' : ' needs-attention'}`;
                const copy = document.createElement('div');
                const title = document.createElement('strong');
                const detail = document.createElement('span');
                const status = document.createElement('b');
                title.textContent = check.title;
                detail.textContent = check.detail;
                status.textContent = check.status;
                copy.append(title, detail);
                item.append(copy, status);
                list.append(item);
            });
            results.append(list);
        } catch (error) {
            results.textContent = error.message || 'تعذر إجراء فحص النظام. تأكد من صلاحية المدير والاتصال بالخادم.';
        }
    };
    workspaceContent.querySelector('#runSystemReview').addEventListener('click', renderReview);
    renderReview();
}

document.querySelectorAll('.main-nav a').forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        document.querySelectorAll('.main-nav a').forEach((item) => item.classList.remove('active'));
        link.classList.add('active');
        sidebar.classList.remove('open');
        const sectionKey = link.getAttribute('href').slice(1);
        if (sectionKey !== 'dashboard' && !activeAccount) {
            loginScreen.classList.remove('hidden');
            return;
        }
        if (sectionKey !== 'dashboard' && !userHasPermission(activeAccount, sectionPermission[sectionKey])) {
            link.classList.remove('active');
            showToast('ليس لديك صلاحية للوصول إلى هذا القسم');
            return;
        }
        if (sectionKey === 'dashboard') {
            workspacePanel.hidden = true;
            document.querySelector('.main-content').classList.remove('workspace-open');
            document.getElementById('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        openWorkspace(sectionKey);
    });
});

document.getElementById('closeWorkspace').addEventListener('click', () => {
    workspacePanel.hidden = true;
    workspacePanel.classList.remove('data-center-print');
    document.querySelector('.main-content').classList.remove('workspace-open');
    document.querySelectorAll('.main-nav a').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#dashboard');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('تم إغلاق مساحة الإدارة');
});

document.querySelector('.hero-banner').addEventListener('click', () => showToast('لوحة منظمة I D H جاهزة للمتابعة'));
document.getElementById('notificationBtn').addEventListener('click', () => showToast('لديك 3 إشعارات جديدة'));
document.querySelector('.support-card button').addEventListener('click', () => showToast('سيتواصل معك فريق الدعم قريباً'));

document.getElementById('addRecord').addEventListener('click', () => {
    const name = window.prompt('اكتب اسم السجل الجديد:');
    if (!name) return;
    const row = document.createElement('tr');
    row.innerHTML = `<td><span class="donor-avatar green-bg">${name.charAt(0)}</span><span class="person">${name}<small>#IDH-NEW</small></span></td><td>سجل جديد</td><td>25 سبتمبر 2026</td><td><span class="payment">إدخال يدوي</span></td><td class="amount">غير محدد</td><td><span class="status pending">قيد المراجعة</span></td>`;
    document.getElementById('transactionsBody').prepend(row);
    showToast(`تمت إضافة السجل: ${name}`);
});

document.getElementById('deleteRecord').addEventListener('click', () => {
    const lastRow = document.querySelector('#transactionsBody tr:last-child');
    if (!lastRow) return showToast('لا توجد سجلات لمسحها');
    const recordName = lastRow.querySelector('.person')?.firstChild?.textContent?.trim() || 'السجل';
    lastRow.remove();
    showToast(`تم مسح ${recordName}`);
});

document.getElementById('sendMessage').addEventListener('click', () => {
    const message = window.prompt('اكتب الرسالة المراد إرسالها:');
    if (message) showToast('تم إرسال الرسالة إلى أعضاء النظام');
});

document.getElementById('inboxButton').addEventListener('click', () => {
    const inbox = document.getElementById('inboxPreview');
    inbox.hidden = !inbox.hidden;
    showToast(inbox.hidden ? 'تم إخفاء الوارد' : 'لديك رسالتان واردتان');
});

document.getElementById('exportData').addEventListener('click', () => {
    const data = { organization: 'I D H الخيرية', exportedBy: 'ENGFT', exportedAt: new Date().toISOString(), transactions: [...document.querySelectorAll('#transactionsBody tr')].map((row) => row.innerText) };
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    link.download = 'idh-system-export.json';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('تم تصدير بيانات النظام');
});

document.getElementById('clearData').addEventListener('click', () => {
    if (!window.confirm('هل أنت متأكد من إفراغ كل البيانات المحلية؟')) return;
    document.getElementById('transactionsBody').innerHTML = '';
    localStorage.removeItem('idh-system-data');
    localStorage.removeItem('idh-section-records');
    showToast('تم إفراغ البيانات المحلية بالكامل');
});

document.getElementById('editChannels').addEventListener('click', () => {
    const channel = window.prompt('اكتب اسم القناة التي تريد تحديثها:');
    if (channel) showToast(`تم فتح إعدادات قناة ${channel}`);
});

document.getElementById('composeEmail').addEventListener('click', () => {
    const recipient = window.prompt('اكتب البريد الإلكتروني للمستلم:');
    if (!recipient) return;
    window.location.href = `mailto:${recipient}`;
});

document.getElementById('openEmail').addEventListener('click', () => {
    window.location.href = 'mailto:itis@mydutyto.help';
});

document.getElementById('filterBtn').addEventListener('click', () => {
    const status = window.prompt('اكتب الحالة للتصفية: مكتمل أو قيد المراجعة');
    if (!status) return;
    transactionRows.forEach((row) => {
        row.hidden = !row.textContent.includes(status);
    });
    showToast(`تمت تصفية السجلات حسب: ${status}`);
});

searchInput.addEventListener('input', (event) => {
    const term = event.target.value.trim().toLowerCase();
    transactionRows.forEach((row) => {
        row.hidden = term && !row.textContent.toLowerCase().includes(term);
    });
});

document.querySelectorAll('.date-button').forEach((button) => button.addEventListener('click', () => showToast('التاريخ الحالي: 25 سبتمبر 2026')));
