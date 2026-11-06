// The permission catalogue. The database table "Permission" is seeded by migration 202611080001 with the same codes; `npm run test:rbac` fails if they drift.
// Code never checks a role name: it asks `can(user, 'orders.edit')`. Which roles hold which permission is data an administrator edits.
export const PERMISSION_GROUPS: Record<string, string> = {
  users: 'المستخدمون', roles: 'الأدوار والأمان', services: 'الخدمات', orders: 'الطلبات', tasks: 'المهام', work: 'العمل الميداني', marketing: 'التسويق', account: 'الحساب', reports: 'التقارير',
};
export const PERMISSIONS = [
  { code: 'users.view', group: 'users', sensitive: false }, { code: 'users.create', group: 'users', sensitive: true }, { code: 'users.edit', group: 'users', sensitive: true },
  { code: 'users.disable', group: 'users', sensitive: true }, { code: 'users.approve', group: 'users', sensitive: true }, { code: 'users.manage_staff', group: 'users', sensitive: true },
  { code: 'roles.view', group: 'roles', sensitive: false }, { code: 'roles.manage', group: 'roles', sensitive: true }, { code: 'auth.settings', group: 'roles', sensitive: true }, { code: 'audit.view', group: 'roles', sensitive: true },
  { code: 'services.view', group: 'services', sensitive: false }, { code: 'services.create', group: 'services', sensitive: false }, { code: 'services.edit', group: 'services', sensitive: false }, { code: 'services.delete', group: 'services', sensitive: true },
  { code: 'orders.view', group: 'orders', sensitive: false }, { code: 'orders.edit', group: 'orders', sensitive: false }, { code: 'orders.assign', group: 'orders', sensitive: false }, { code: 'orders.approve', group: 'orders', sensitive: true },
  { code: 'orders.track', group: 'orders', sensitive: false }, { code: 'orders.create', group: 'orders', sensitive: false }, { code: 'orders.own', group: 'orders', sensitive: false },
  { code: 'orders.respond', group: 'orders', sensitive: false }, { code: 'orders.update_status', group: 'orders', sensitive: false },
  { code: 'tasks.view', group: 'tasks', sensitive: false }, { code: 'tasks.create', group: 'tasks', sensitive: false }, { code: 'tasks.assign', group: 'tasks', sensitive: false },
  { code: 'tasks.reassign', group: 'tasks', sensitive: false }, { code: 'tasks.complete', group: 'tasks', sensitive: false }, { code: 'tasks.performance', group: 'tasks', sensitive: false },
  { code: 'notes.add', group: 'work', sensitive: false }, { code: 'documents.upload', group: 'work', sensitive: false }, { code: 'appointments.view', group: 'work', sensitive: false }, { code: 'contacts.message', group: 'work', sensitive: false },
  { code: 'leads.view', group: 'marketing', sensitive: false }, { code: 'leads.update', group: 'marketing', sensitive: false }, { code: 'offers.view', group: 'marketing', sensitive: false }, { code: 'offers.manage', group: 'marketing', sensitive: false },
  { code: 'profile.manage', group: 'account', sensitive: false }, { code: 'catalog.browse', group: 'account', sensitive: false }, { code: 'payments.pay', group: 'account', sensitive: false }, { code: 'support.contact', group: 'account', sensitive: false },
  { code: 'reports.view', group: 'reports', sensitive: false },
] as const;
export type PermissionCode = typeof PERMISSIONS[number]['code'];
export const PERMISSION_CODES: string[] = PERMISSIONS.map(p => p.code);

/** Roles whose members an administrator holding `users.manage_staff` may manage (never administrators or the system administrator). */
export const STAFF_ROLE_KEYS = ['supervisor', 'marketer', 'coordinator'];
/** Legacy coarse access class per role key, used when a user has no role rows yet (accounts created by scripts or older code paths). */
export const LEGACY_ROLE_KEY: Record<string, string> = { SUPER_ADMIN: 'system_admin', ADMIN: 'admin', VENDOR: 'vendor', CLIENT: 'client' };
/** Higher wins when a person holds several roles: the legacy `User.role` column mirrors the strongest one. */
export const LEGACY_RANK: Record<string, number> = { CLIENT: 0, VENDOR: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export const SECURITY_EVENTS: Record<string, string> = {
  'account.created': 'إنشاء حساب', 'login.success': 'نجاح تسجيل الدخول', 'login.failed': 'فشل تسجيل الدخول', 'otp.sent': 'إرسال رمز تحقق', 'otp.failed': 'فشل التحقق من الرمز',
  'otp.locked': 'تجاوز محاولات الرمز', 'otp.send_failed': 'تعذر إرسال الرمز', 'identity.linked': 'ربط وسيلة دخول', 'identity.takeover_guard': 'تحييد حساب غير موثق عند إثبات الملكية', 'contact.changed': 'تغيير البريد أو الجوال',
  'role.created': 'إنشاء دور', 'role.updated': 'تعديل دور', 'role.permissions_changed': 'تعديل صلاحيات دور', 'role.deleted': 'حذف دور', 'user.roles_changed': 'تغيير دور مستخدم',
  'user.disabled': 'تعطيل حساب', 'user.enabled': 'تفعيل حساب', 'user.approved': 'اعتماد حساب', 'user.rejected': 'رفض حساب', 'settings.changed': 'تعديل إعدادات الدخول',
  'session.revoked': 'إنهاء جلسات', 'login.new_device': 'دخول من جهاز أو عنوان جديد', 'logout': 'تسجيل الخروج',
};

/**
 * The roles a fresh installation starts with. Migration 202611080001 seeds the same set into PostgreSQL; this copy seeds databases that were built without the
 * migration files (the isolated test schemas) the first time roles are needed, and `npm run test:rbac` fails if the two disagree.
 */
export interface DefaultRole { key: string; nameAr: string; nameEn: string; isSystem: boolean; legacyRole: string | null; selfRegistration: boolean; requiresApproval: boolean; sortOrder: number; permissions: string[] | 'all' }
export const DEFAULT_ROLES: DefaultRole[] = [
  { key: 'system_admin', nameAr: 'مدير النظام', nameEn: 'System administrator', isSystem: true, legacyRole: 'SUPER_ADMIN', selfRegistration: false, requiresApproval: false, sortOrder: 1, permissions: 'all' },
  { key: 'admin', nameAr: 'إداري', nameEn: 'Administrator', isSystem: false, legacyRole: 'ADMIN', selfRegistration: false, requiresApproval: false, sortOrder: 2,
    permissions: ['users.view', 'users.manage_staff', 'services.view', 'services.create', 'services.edit', 'orders.view', 'orders.edit', 'orders.assign', 'orders.track', 'orders.approve', 'tasks.view', 'tasks.create', 'tasks.assign', 'tasks.reassign', 'tasks.performance', 'notes.add', 'reports.view', 'profile.manage'] },
  { key: 'supervisor', nameAr: 'مشرف', nameEn: 'Supervisor', isSystem: false, legacyRole: null, selfRegistration: false, requiresApproval: false, sortOrder: 3,
    permissions: ['services.view', 'services.edit', 'orders.view', 'orders.edit', 'orders.track', 'tasks.view', 'tasks.create', 'tasks.assign', 'tasks.reassign', 'notes.add', 'appointments.view', 'profile.manage'] },
  { key: 'client', nameAr: 'عميل', nameEn: 'Customer', isSystem: true, legacyRole: 'CLIENT', selfRegistration: true, requiresApproval: false, sortOrder: 4,
    permissions: ['catalog.browse', 'orders.create', 'orders.own', 'payments.pay', 'support.contact', 'profile.manage'] },
  { key: 'vendor', nameAr: 'مورد', nameEn: 'Vendor', isSystem: true, legacyRole: 'VENDOR', selfRegistration: true, requiresApproval: false, sortOrder: 5,
    permissions: ['profile.manage', 'services.view', 'services.create', 'services.edit', 'offers.view', 'offers.manage', 'orders.view', 'orders.respond', 'orders.update_status', 'support.contact', 'reports.view'] },
  { key: 'marketer', nameAr: 'مسوق', nameEn: 'Marketer', isSystem: false, legacyRole: null, selfRegistration: true, requiresApproval: true, sortOrder: 6,
    permissions: ['leads.view', 'leads.update', 'offers.view', 'orders.view', 'notes.add', 'tasks.view', 'tasks.complete', 'profile.manage'] },
  { key: 'coordinator', nameAr: 'منسق', nameEn: 'Coordinator', isSystem: false, legacyRole: null, selfRegistration: true, requiresApproval: true, sortOrder: 7,
    permissions: ['orders.view', 'orders.track', 'orders.update_status', 'contacts.message', 'notes.add', 'appointments.view', 'documents.upload', 'tasks.view', 'tasks.complete', 'profile.manage'] },
];
