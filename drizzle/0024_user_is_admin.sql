ALTER TABLE "user"
ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;

-- Seed the initial admin (hipstersmoothie.com) if they've already signed in.
UPDATE "user"
SET "is_admin" = true
WHERE "did" = 'did:plc:m2sjv3wncvsasdapla35hzwj';
