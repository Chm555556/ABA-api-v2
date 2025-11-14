/**
 * Quick script to fix clinic assignments
 * Run with: node scripts/fix_clinic_assignments.js
 */

const mysql = require('mysql2/promise')
require('dotenv').config()

async function fixClinicAssignments() {
  console.log('🔧 Starting clinic assignment fix...\n')

  // Create database connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'aba_connect',
  })

  try {
    // Step 1: Check users without clinic
    console.log('📊 Checking users without clinic...')
    const [usersWithoutClinic] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE clinic_id IS NULL'
    )
    console.log(`Found ${usersWithoutClinic.length} users without clinic assignment\n`)

    if (usersWithoutClinic.length === 0) {
      console.log('✅ All users already have clinic assignments!')
      await connection.end()
      return
    }

    // Show users without clinic
    console.log('Users without clinic:')
    usersWithoutClinic.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.role}`)
    })
    console.log('')

    // Step 2: Check if clinic exists
    console.log('🏥 Checking for existing clinics...')
    const [clinics] = await connection.execute('SELECT id, name FROM clinics')
    
    let clinicId
    if (clinics.length === 0) {
      console.log('No clinic found, creating default clinic...')
      const [result] = await connection.execute(
        `INSERT INTO clinics (name, address, phone, email, created_at, updated_at) 
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [
          'ABA Connect Main Clinic',
          '123 Main Street, City, State 12345',
          '555-0100',
          'info@abaconnect.com'
        ]
      )
      clinicId = result.insertId
      console.log(`✅ Created clinic with ID: ${clinicId}\n`)
    } else {
      clinicId = clinics[0].id
      console.log(`✅ Using existing clinic: ${clinics[0].name} (ID: ${clinicId})\n`)
    }

    // Step 3: Update users
    console.log('🔄 Assigning users to clinic...')
    const [updateResult] = await connection.execute(
      'UPDATE users SET clinic_id = ?, updated_at = NOW() WHERE clinic_id IS NULL',
      [clinicId]
    )
    console.log(`✅ Updated ${updateResult.affectedRows} users\n`)

    // Step 4: Verify
    console.log('✅ Verification:')
    const [verification] = await connection.execute(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.clinic_id,
        c.name as clinic_name
      FROM users u
      LEFT JOIN clinics c ON u.clinic_id = c.id
      ORDER BY u.role, u.name
    `)

    console.log('\n📋 All Users:')
    console.log('─'.repeat(100))
    console.log('ID | Name | Email | Role | Clinic ID | Clinic Name')
    console.log('─'.repeat(100))
    verification.forEach(user => {
      console.log(
        `${user.id} | ${user.name} | ${user.email} | ${user.role} | ${user.clinic_id || 'NULL'} | ${user.clinic_name || 'NO CLINIC'}`
      )
    })
    console.log('─'.repeat(100))

    // Final count
    const [finalCount] = await connection.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN clinic_id IS NULL THEN 1 ELSE 0 END) as without_clinic,
        SUM(CASE WHEN clinic_id IS NOT NULL THEN 1 ELSE 0 END) as with_clinic
      FROM users
    `)

    console.log('\n📊 Summary:')
    console.log(`  Total users: ${finalCount[0].total}`)
    console.log(`  Users with clinic: ${finalCount[0].with_clinic}`)
    console.log(`  Users without clinic: ${finalCount[0].without_clinic}`)

    if (finalCount[0].without_clinic === 0) {
      console.log('\n🎉 SUCCESS! All users now have clinic assignments!')
    } else {
      console.log(`\n⚠️  WARNING: ${finalCount[0].without_clinic} users still without clinic`)
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    throw error
  } finally {
    await connection.end()
  }
}

// Run the script
fixClinicAssignments()
  .then(() => {
    console.log('\n✅ Script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
