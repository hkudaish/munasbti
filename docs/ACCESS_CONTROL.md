# Roles, permissions and sign-in methods

Model: **User → Role → Permissions**. Code asks `can(user, 'orders.edit')`; it never compares a role name. Which roles hold which permission is data, edited by the system administrator in the app.

## Screens (all under `/access`, linked from the system admin page)

| Screen | Permission | What it does |
|---|---|---|
| `/access/users` المستخدمون والصلاحيات | `users.view` | list/search/filter, create, change roles, edit contacts, enable/disable, approve/reject pending accounts |
| `/access/roles` الأدوار والصلاحيات | `roles.view` / `roles.manage` | create and edit roles, tick permissions, set "self-registration" and "needs approval", disable a role |
| `/access/settings` إعدادات تسجيل الدخول والتحقق | `auth.settings` | switch Google / Apple / SMS / WhatsApp / e-mail codes / password on or off, pick the provider per channel, default channel |
| `/access/security-log` سجل الأمان | `audit.view` | sign-ins, failures, codes sent, role and permission changes, linking, disabling |

Every action is enforced on the server (`/api/access`); hiding a button is only a convenience.

## Default roles (seeded by migration `202611080001`, editable afterwards)

| Role | Starts with | Self-registration | Needs approval |
|---|---|---|---|
| مدير النظام `system_admin` | every permission, fixed | no | – |
| إداري `admin` | users.view, users.manage_staff, services.*, orders.view/edit/assign/track/approve, tasks.*, reports.view | no | – |
| مشرف `supervisor` | services.view/edit, orders.view/edit/track, tasks.view/create/assign/reassign, notes, appointments | no | – |
| عميل `client` | catalog.browse, orders.create/own, payments.pay, support.contact, profile.manage | yes | no |
| مورد `vendor` | services.*, offers.*, orders.view/respond/update_status, reports.view | yes (business form) | no (vendor review still applies) |
| مسوق `marketer` | leads.*, offers.view, orders.view, notes, tasks.view/complete | yes | yes |
| منسق `coordinator` | orders.view/track/update_status, contacts.message, notes, appointments, documents.upload, tasks.view/complete | yes | yes |

The full catalogue is in `src/lib/system/permissions.ts` (a test compares it with the migration). A person can hold several roles; permissions are the union. A pending or rejected account holds none.

### Safeguards
- Nobody can grant a **sensitive** permission (flagged ⚠) they do not hold; only the system administrator touches administrators or the system administrator role.
- The last active system administrator cannot be disabled, demoted or removed. The system administrator role cannot be stripped or deleted, and always holds every permission.
- A role open to self-registration without approval cannot carry sensitive permissions.
- Changing a person's roles, contact details or status ends their sessions at once.
- Adding a new permission means adding it to `permissions.ts` **and** a migration row; adding a role needs no code.

## Sign-in methods

All of them end in the same place: an `AuthSession` cookie. Switch them on in `/access/settings`; a method whose server variables are missing is hidden from visitors (see `.env.hostinger.example`).

- **Password** (existing): kept, with lockout, CAPTCHA and authenticator-app second factor.
- **Phone / e-mail + one-time code**: one flow for sign-in and sign-up. The response to "send code" is identical for known and unknown targets. Code: 6 digits, 10 minutes, stored only as an HMAC, 5 attempts, single use, resend delay 60 s, 5 codes/hour per target, 20/hour per address, CAPTCHA when Turnstile is configured. Unknown target: the code is verified, then a name and account type are requested, then the account is created.
- **Google** and **Apple**: authorization-code flow with single-use `state`, a browser-binding cookie, `nonce` checked inside the ID token, PKCE for Google. Apple posts back (`form_post`), so the binding cookie is `SameSite=None; Secure` in production (HTTPS required). Callback URLs: `https://<domain>/api/auth/oauth/google/callback` and `.../apple/callback`.
- **Providers** (`src/lib/server/notify`): a registry per channel (SMS: Twilio; WhatsApp: Meta Cloud API; e-mail: SMTP). Adding a provider is one registry entry; the provider is chosen in the settings screen; secrets stay in environment variables.

## One person, several ways in (`LoginIdentity`)

An identity is `(provider, providerUserId)`: the Google/Apple `sub`, the normalised e-mail, or the +E.164 phone. Sign-in resolves in this order: linked identity → an account whose **verified** contact matches (phone proven by the code just entered, or an e-mail the provider vouches for) → create a new account if self-registration allows. A name is never used to match anyone, and an unverified Google e-mail is never linked.

**Takeover guard.** If the account that matches was created with that phone/e-mail but never verified (older accounts, or someone typing another person's number), the person who now proves control owns it: the account's password and sessions are cleared and the event is logged. They can set a new password with "forgot password".

## Limits worth knowing
- Accounts with an authenticator app (TOTP) must use password or code sign-in, which can ask for the app code; Google/Apple sign-in is refused for them (a redirect cannot prompt).
- Vendors register through the business form (it collects company data); the vendor role cannot be assigned to an account without a business profile.
- The roles screen shows the task permissions (`tasks.*`) but the app has no task module yet, so there is no "assigned tasks" column; the permissions are ready to attach when it exists.
- Existing screens and APIs still check the coarse legacy class (`User.role`: client / vendor / admin / system admin), which is kept in step with the roles automatically. New screens use permissions. Moving every old check to `can()` is a separate, incremental step.
- Supervisor, marketer and coordinator accounts keep the "customer" legacy class, so they see the customer site plus whatever permission-based screens they are granted.
