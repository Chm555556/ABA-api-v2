/**
 * Simple script to fix clinic assignments using AdonisJS
 * Run with: node ace fix:clinic
 */

import { BaseCommand } from '@adonisjs/core/ace'
import db from '@adonisjs/lucid/services/db'

export default class FixClinic extends BaseCommand {
  static commandName = 'fix:clinic'
  static description = 'Fix clinic assignments for users'

  async run() {
    try {
      console.log('🔧 Fixing clinic assignments...\n')

      // Check users without clinic
      const usersWithoutClinic = await db.from('users').whereNull('clinic_id')
      console.log(`Found ${usersWithoutClinic.length} users without clinic\n`)

      if (usersWithoutClinic.length === 0) {
        console.log('✅ All users already have clinic assignments!')
        return
      }

      // Show users
      console.log('Users without clinic:')
      usersWithoutClinic.forEach((user: any) => {
        console.log(`  - ${user.name} (${user.email}) - ${user.role}`)
      })
      console.log('')

      // Get or create clinic
      let clinic = await db.from('clinics').first()
      
      if (!clinic) {
        console.log('Creating default clinic...')
        const [clinicId] = await db.table('clinics').insert({
          name: 'ABA Connect Main Clinic',
          address: '123 Main Street',
          phone: '555-0100',
          email: 'info@abaconnect.com',
          created_at: new Date(),
          updated_at: new Date(),
        })
        clinic = { id: clinicId }
        console.log(`✅ Created clinic ID: ${clinicId}\n`)
      } else {
        console.log(`✅ Using clinic: ${clinic.name} (ID: ${clinic.id})\n`)
      }

      // Update users
      const updated = await db
        .from('users')
        .whereNull('clinic_id')
        .update({ clinic_id: clinic.id, updated_at: new Date() })

      console.log(`✅ Updated ${updated} users\n`)

      // Verify
      const remaining = await db.from('users').whereNull('clinic_id').count('* as total')
      console.log('📊 Summary:')
      console.log(`  Users without clinic: ${remaining[0].total}`)

      if (remaining[0].total === 0) {
        console.log('\n🎉 SUCCESS! All users now have clinic assignments!')
      }

    } catch (error) {
      console.error('❌ Error:', error.message)
      throw error
    }
  }
}
