-- Roles and permissions (RBAC), login identities (Google / Apple / phone / e-mail), one-time verification codes, OAuth state, auth settings,
-- session metadata and account approval. Additive and idempotent. The legacy "User"."role" column stays as the coarse access class.

ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "registeredVia" TEXT NOT NULL DEFAULT 'password';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "method" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "legacyRole" TEXT,
  "selfRegistration" BOOLEAN NOT NULL DEFAULT false,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Role_key_key" ON "Role"("key");

CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "groupKey" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL DEFAULT '',
  "sensitive" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_code_key" ON "Permission"("code");

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId"),
  CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

CREATE TABLE IF NOT EXISTS "UserRoleAssignment" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "assignedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("userId","roleId"),
  CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "UserRoleAssignment_roleId_idx" ON "UserRoleAssignment"("roleId");

CREATE TABLE IF NOT EXISTS "LoginIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "email" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "LoginIdentity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoginIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoginIdentity_provider_providerUserId_key" ON "LoginIdentity"("provider","providerUserId");
CREATE INDEX IF NOT EXISTS "LoginIdentity_userId_idx" ON "LoginIdentity"("userId");

-- Only a SHA-256 of "<channel>:<target>:<code>" is stored; the code itself never touches the database.
CREATE TABLE IF NOT EXISTS "VerificationCode" (
  "id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VerificationCode_target_channel_idx" ON "VerificationCode"("target","channel","createdAt");
CREATE INDEX IF NOT EXISTS "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");

CREATE TABLE IF NOT EXISTS "OAuthState" (
  "stateHash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "verifier" TEXT NOT NULL,
  "bindHash" TEXT NOT NULL,
  "roleKey" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX IF NOT EXISTS "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

CREATE TABLE IF NOT EXISTS "AuthSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthSetting_pkey" PRIMARY KEY ("key")
);

-- ---- Permission catalogue (kept in step with src/lib/system/permissions.ts; a test compares the two) ----------------------------------
INSERT INTO "Permission" ("id","code","groupKey","nameAr","nameEn","sensitive") VALUES
 ('perm_users_view','users.view','users','عرض المستخدمين','View users',false),
 ('perm_users_create','users.create','users','إنشاء مستخدمين','Create users',true),
 ('perm_users_edit','users.edit','users','تعديل المستخدمين','Edit users',true),
 ('perm_users_disable','users.disable','users','تعطيل الحسابات وتفعيلها','Disable or enable accounts',true),
 ('perm_users_approve','users.approve','users','اعتماد الحسابات المعلّقة','Approve pending accounts',true),
 ('perm_users_manage_staff','users.manage_staff','users','إدارة المشرفين والمسوقين والمنسقين','Manage supervisors, marketers and coordinators',true),
 ('perm_roles_view','roles.view','roles','عرض الأدوار والصلاحيات','View roles and permissions',false),
 ('perm_roles_manage','roles.manage','roles','إدارة الأدوار والصلاحيات','Manage roles and permissions',true),
 ('perm_auth_settings','auth.settings','roles','إعدادات تسجيل الدخول والتحقق','Sign-in and verification settings',true),
 ('perm_audit_view','audit.view','roles','عرض سجل الأمان','View the security log',true),
 ('perm_services_view','services.view','services','عرض الخدمات','View services',false),
 ('perm_services_create','services.create','services','إضافة الخدمات','Add services',false),
 ('perm_services_edit','services.edit','services','تعديل الخدمات','Edit services',false),
 ('perm_services_delete','services.delete','services','حذف الخدمات','Delete services',true),
 ('perm_orders_view','orders.view','orders','عرض الطلبات','View orders',false),
 ('perm_orders_edit','orders.edit','orders','تحرير الطلبات','Edit orders',false),
 ('perm_orders_assign','orders.assign','orders','إسناد الطلبات','Assign orders',false),
 ('perm_orders_approve','orders.approve','orders','اعتماد الطلبات','Approve orders',true),
 ('perm_orders_track','orders.track','orders','متابعة حالات الطلبات','Follow order status',false),
 ('perm_orders_create','orders.create','orders','إنشاء الطلبات والحجوزات','Create orders and bookings',false),
 ('perm_orders_own','orders.own','orders','متابعة طلباتي','Follow my own orders',false),
 ('perm_orders_respond','orders.respond','orders','قبول الطلبات المسندة أو رفضها','Accept or reject assigned orders',false),
 ('perm_orders_status','orders.update_status','orders','تحديث حالة التنفيذ','Update fulfilment status',false),
 ('perm_tasks_view','tasks.view','tasks','عرض المهام','View tasks',false),
 ('perm_tasks_create','tasks.create','tasks','إنشاء المهام','Create tasks',false),
 ('perm_tasks_assign','tasks.assign','tasks','إسناد المهام','Assign tasks',false),
 ('perm_tasks_reassign','tasks.reassign','tasks','إعادة إسناد المهام','Reassign tasks',false),
 ('perm_tasks_complete','tasks.complete','tasks','إنهاء المهام','Complete tasks',false),
 ('perm_tasks_performance','tasks.performance','tasks','الاطلاع على أداء المكلفين','See the performance of assignees',false),
 ('perm_notes_add','notes.add','work','إضافة الملاحظات','Add notes',false),
 ('perm_docs_upload','documents.upload','work','رفع المستندات','Upload documents',false),
 ('perm_appointments_view','appointments.view','work','متابعة المواعيد','Follow appointments',false),
 ('perm_contacts_message','contacts.message','work','التواصل مع العميل أو المورد','Contact customers and vendors',false),
 ('perm_leads_view','leads.view','marketing','متابعة العملاء المحتملين','Follow leads',false),
 ('perm_leads_update','leads.update','marketing','تحديث حالة المتابعة','Update follow-up status',false),
 ('perm_offers_view','offers.view','marketing','متابعة العروض','Follow offers',false),
 ('perm_offers_manage','offers.manage','marketing','إدارة العروض والأسعار','Manage offers and prices',false),
 ('perm_profile_manage','profile.manage','account','إدارة الملف الشخصي','Manage own profile',false),
 ('perm_catalog_browse','catalog.browse','account','تصفح الخدمات والأسعار','Browse services and prices',false),
 ('perm_payments_pay','payments.pay','account','الدفع','Pay',false),
 ('perm_support_contact','support.contact','account','التواصل مع المنصة','Contact the platform',false),
 ('perm_reports_view','reports.view','reports','الاطلاع على التقارير المصرح بها','View authorised reports',false)
ON CONFLICT ("code") DO UPDATE SET "groupKey"=EXCLUDED."groupKey","nameAr"=EXCLUDED."nameAr","nameEn"=EXCLUDED."nameEn","sensitive"=EXCLUDED."sensitive";

-- ---- Default roles. Names and permissions stay editable afterwards; the migration never overwrites an existing role. ------------
INSERT INTO "Role" ("id","key","nameAr","nameEn","description","active","isSystem","legacyRole","selfRegistration","requiresApproval","sortOrder","updatedAt") SELECT v.*, CURRENT_TIMESTAMP FROM (VALUES
 ('role_system_admin','system_admin','مدير النظام','System administrator','صلاحيات كاملة لا يمكن تعديلها',true,true,'SUPER_ADMIN',false,false,1),
 ('role_admin','admin','إداري','Administrator','إدارة الخدمات والطلبات والمستخدمين التابعين',true,false,'ADMIN',false,false,2),
 ('role_supervisor','supervisor','مشرف','Supervisor','متابعة تشغيلية وإسناد المهام',true,false,NULL,false,false,3),
 ('role_client','client','عميل','Customer','تصفح الخدمات وإنشاء الطلبات',true,true,'CLIENT',true,false,4),
 ('role_vendor','vendor','مورد','Vendor','إدارة الخدمات والعروض والطلبات المسندة',true,true,'VENDOR',true,false,5),
 ('role_marketer','marketer','مسوق','Marketer','متابعة العملاء المحتملين والعروض',true,false,NULL,true,true,6),
 ('role_coordinator','coordinator','منسق','Coordinator','متابعة الطلبات التنفيذية والمواعيد',true,false,NULL,true,true,7)
) AS v("id","key","nameAr","nameEn","description","active","isSystem","legacyRole","selfRegistration","requiresApproval","sortOrder")
ON CONFLICT ("key") DO NOTHING;

-- Default grants, only for roles that have none yet (so an administrator's later edits are never reverted by a re-run).
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r."id", p."id" FROM "Role" r JOIN "Permission" p ON
  (r."key"='system_admin')
  OR (r."key"='admin' AND p."code" IN ('users.view','users.manage_staff','services.view','services.create','services.edit','orders.view','orders.edit','orders.assign','orders.track','orders.approve','tasks.view','tasks.create','tasks.assign','tasks.reassign','tasks.performance','notes.add','reports.view','profile.manage'))
  OR (r."key"='supervisor' AND p."code" IN ('services.view','services.edit','orders.view','orders.edit','orders.track','tasks.view','tasks.create','tasks.assign','tasks.reassign','notes.add','appointments.view','profile.manage'))
  OR (r."key"='client' AND p."code" IN ('catalog.browse','orders.create','orders.own','payments.pay','support.contact','profile.manage'))
  OR (r."key"='vendor' AND p."code" IN ('profile.manage','services.view','services.create','services.edit','offers.view','offers.manage','orders.view','orders.respond','orders.update_status','support.contact','reports.view'))
  OR (r."key"='marketer' AND p."code" IN ('leads.view','leads.update','offers.view','orders.view','notes.add','tasks.view','tasks.complete','profile.manage'))
  OR (r."key"='coordinator' AND p."code" IN ('orders.view','orders.track','orders.update_status','contacts.message','notes.add','appointments.view','documents.upload','tasks.view','tasks.complete','profile.manage'))
WHERE NOT EXISTS (SELECT 1 FROM "RolePermission" rp WHERE rp."roleId"=r."id")
ON CONFLICT DO NOTHING;

-- Existing accounts keep working: every user gets the role that matches their legacy access class.
INSERT INTO "UserRoleAssignment" ("userId","roleId")
SELECT u."id", CASE u."role" WHEN 'SUPER_ADMIN' THEN 'role_system_admin' WHEN 'ADMIN' THEN 'role_admin' WHEN 'VENDOR' THEN 'role_vendor' ELSE 'role_client' END
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "UserRoleAssignment" a WHERE a."userId"=u."id")
ON CONFLICT DO NOTHING;

-- Existing phone and e-mail logins become login identities (unverified: they were never proven by a code), so an OTP login can find the account.
INSERT INTO "LoginIdentity" ("id","userId","provider","providerUserId","email")
SELECT 'li_p_' || u."id", u."id", 'PHONE', u."phone", u."email" FROM "User" u WHERE u."phone" IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO "LoginIdentity" ("id","userId","provider","providerUserId","email","verifiedAt")
SELECT 'li_e_' || u."id", u."id", 'EMAIL', lower(u."email"), u."email", u."emailVerifiedAt" FROM "User" u WHERE u."email" IS NOT NULL
ON CONFLICT DO NOTHING;
