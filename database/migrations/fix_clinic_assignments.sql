-- ============================================================================
-- Fix Clinic Assignments - Complete Setup
-- ============================================================================
-- Run this script to ensure all users have proper clinic assignments

-- Step 1: Check current state
-- ============================================================================
SELECT 'Current Users Without Clinic:' as info;
SELECT id, name, email, role, clinic_id 
FROM users 
WHERE clinic_id IS NULL;

-- Step 2: Check if clinics table exists and has data
-- ============================================================================
SELECT 'Existing Clinics:' as info;
SELECT id, name FROM clinics;

-- Step 3: Create a default clinic if none exists
-- ============================================================================
INSERT INTO clinics (name, address, phone, email, created_at, updated_at)
SELECT 
    'ABA Connect Main Clinic',
    '123 Main Street, City, State 12345',
    '555-0100',
    'info@abaconnect.com',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM clinics LIMIT 1);

-- Step 4: Get the clinic ID (either existing or newly created)
-- ============================================================================
SET @clinic_id = (SELECT id FROM clinics ORDER BY id ASC LIMIT 1);

-- Step 5: Assign ALL users without clinic to the default clinic
-- ============================================================================
UPDATE users 
SET clinic_id = @clinic_id,
    updated_at = NOW()
WHERE clinic_id IS NULL;

-- Step 6: Verify the fix
-- ============================================================================
SELECT 'Users After Fix:' as info;
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    u.clinic_id,
    c.name as clinic_name
FROM users u
LEFT JOIN clinics c ON u.clinic_id = c.id
ORDER BY u.role, u.name;

-- Step 7: Final verification
-- ============================================================================
SELECT 'Summary:' as info;
SELECT 
    COUNT(*) as total_users,
    SUM(CASE WHEN clinic_id IS NULL THEN 1 ELSE 0 END) as users_without_clinic,
    SUM(CASE WHEN clinic_id IS NOT NULL THEN 1 ELSE 0 END) as users_with_clinic
FROM users;

SELECT 'Done! All users now have clinic assignments.' as result;
