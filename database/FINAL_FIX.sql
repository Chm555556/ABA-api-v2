-- ============================================
-- FINAL FIX FOR CLINIC_ID ISSUE
-- ============================================

-- Step 1: Add clinic_id column if it doesn't exist
-- (This will be done by the migration, but here's the manual version)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS clinic_id INT UNSIGNED NULL,
ADD CONSTRAINT fk_users_clinic_id 
FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;

-- Step 2: Create a default clinic if none exists
INSERT INTO clinics (name, email, phone, address, is_active, created_at, updated_at)
SELECT 'ABA Connect Clinic', 'admin@abaconnect.com', '555-0100', '123 Main Street, City, State 12345', 1, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM clinics LIMIT 1);

-- Step 3: Get the first clinic ID
SET @default_clinic_id = (SELECT id FROM clinics ORDER BY id ASC LIMIT 1);

-- Step 4: Update all users without clinic_id
UPDATE users 
SET clinic_id = @default_clinic_id 
WHERE role IN ('CLINIC', 'BCBA', 'RBT') 
AND (clinic_id IS NULL OR clinic_id = 0);

-- Step 5: Verify the fix
SELECT 
    id,
    name,
    email,
    role,
    clinic_id,
    is_active
FROM users 
WHERE role IN ('CLINIC', 'BCBA', 'RBT')
ORDER BY role, name;

-- Step 6: Show clinic information
SELECT * FROM clinics;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if any users still have NULL clinic_id
SELECT COUNT(*) as users_without_clinic
FROM users 
WHERE role IN ('CLINIC', 'BCBA', 'RBT') 
AND clinic_id IS NULL;

-- Show summary by role
SELECT 
    role,
    COUNT(*) as total_users,
    COUNT(clinic_id) as users_with_clinic,
    COUNT(*) - COUNT(clinic_id) as users_without_clinic
FROM users 
GROUP BY role;
