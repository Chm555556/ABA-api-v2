import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

export default class extends BaseSeeder {
  async run() {
    console.log('🔧 Creating test group session...')

    // Configuration
    const RBT_ID = 11 // iamrbt
    const BCBA_ID = 1 // Adjust based on your database
    const now = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')

    // Get some active clients
    const clients = await db
      .from('clients')
      .where('status', 'active')
      .limit(3)
      .select('id', 'first_name', 'last_name')

    if (clients.length < 2) {
      console.error('❌ Need at least 2 active clients to create a group session')
      return
    }

    console.log(`✅ Found ${clients.length} clients:`)
    clients.forEach(c => console.log(`   - ${c.first_name} ${c.last_name} (ID: ${c.id})`))

    // Create a group session
    const groupSessionId = await db
      .table('session_logs')
      .insert({
        client_id: null, // Group sessions don't have a single client
        rbt_id: RBT_ID,
        bcba_id: BCBA_ID,
        date: DateTime.now().plus({ days: 1 }).toSQLDate(),
        start_time: '10:00',
        end_time: '11:30',
        duration: 90,
        total_hours: 1.5,
        cpt_code: '97153',
        service_type: 'Direct Service',
        location: 'clinic',
        location_address: '123 Main St, City, State 12345',
        session_type: 'group',
        session_notes: 'Test group session with multiple participants - created for testing tabs feature',
        rbt_signature: 'iamrbt',
        status: 'approved',
        bcba_approved: false,
        clinic_approved: false,
        is_recurring: false,
        is_series_master: false,
        created_at: now,
        updated_at: now,
      })

    console.log(`✅ Created group session ID: ${groupSessionId}`)

    // Add participants
    for (const client of clients) {
      await db
        .table('session_participants')
        .insert({
          session_log_id: groupSessionId,
          client_id: client.id,
          notes: `Participant: ${client.first_name} ${client.last_name}`,
          created_at: now,
          updated_at: now,
        })
      
      console.log(`   ✅ Added participant: ${client.first_name} ${client.last_name}`)
    }

    // Create a community session as well
    const communitySessionId = await db
      .table('session_logs')
      .insert({
        client_id: null,
        rbt_id: RBT_ID,
        bcba_id: BCBA_ID,
        date: DateTime.now().plus({ days: 2 }).toSQLDate(),
        start_time: '14:00',
        end_time: '16:00',
        duration: 120,
        total_hours: 2.0,
        cpt_code: '97153',
        service_type: 'Direct Service',
        location: 'community',
        location_address: 'Community Center, 456 Park Ave',
        session_type: 'community',
        session_notes: 'Test community session with multiple participants - created for testing tabs feature',
        rbt_signature: 'iamrbt',
        status: 'approved',
        bcba_approved: false,
        clinic_approved: false,
        is_recurring: false,
        is_series_master: false,
        created_at: now,
        updated_at: now,
      })

    console.log(`✅ Created community session ID: ${communitySessionId}`)

    // Add participants to community session
    for (const client of clients.slice(0, 2)) {
      await db
        .table('session_participants')
        .insert({
          session_log_id: communitySessionId,
          client_id: client.id,
          notes: `Community participant: ${client.first_name} ${client.last_name}`,
          created_at: now,
          updated_at: now,
        })
      
      console.log(`   ✅ Added participant: ${client.first_name} ${client.last_name}`)
    }

    console.log('\n🎉 Test sessions created successfully!')
    console.log(`\n📋 Summary:`)
    console.log(`   Group Session ID: ${groupSessionId} (${clients.length} participants)`)
    console.log(`   Community Session ID: ${communitySessionId} (2 participants)`)
    console.log(`\n💡 Test these sessions in the RBT Dashboard → My Sessions → View Details`)
  }
}
