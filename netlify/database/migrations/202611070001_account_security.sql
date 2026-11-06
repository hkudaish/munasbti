-- Password reset and e-mail verification: one-time tokens (hashed) and the verification timestamp. Additive and idempotent.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AccountToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "AccountToken_userId_purpose_idx" ON "AccountToken"("userId", "purpose");
CREATE INDEX IF NOT EXISTS "AccountToken_expiresAt_idx" ON "AccountToken"("expiresAt");
