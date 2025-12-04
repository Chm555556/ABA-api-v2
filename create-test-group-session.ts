/**
 * Script to create a test group session with multiple participants
 * Run with: node ace run:script create-test-group-session.ts
 */

import { DateTime } from 'luxon'
import SessionLog from '#models/session_log'
import SessionParticipant from '#models/session_participant'
import Client from '#models/client'

// Configuration
const RBT_ID = 11 // iamrbt
const BCBA_ID = 1 // Adjust based on your database

async function createTestGroupSession() {
  console.log('🔧 Creating test group session...')

  // Get some clients to add as participants
  const clients = await Client.query()
    .where('status', 'active')
    .limit(3)

  if (clients.length < 2) {
    console.error('❌ Need at least 2 active clients to create a group session')
    return
  }

  console.log(`✅ Found ${clients.length} clients:`)
  clients.forEach(c => console.log(`   - ${c.fullName} (ID: ${c.id})`))

  // Create a group session
  const groupSession = await SessionLog.create({
    clientId: null, // Group sessions don't have a single client
    rbtId: RBT_ID,
    bcbaId: BCBA_ID,
    date: DateTime.now().plus({ days: 1 }),
    startTime: '10:00',
    endTime: '11:30',
    duration: 90,
    totalHours: 1.5,
    cptCode: '97153',
    serviceType: 'Direct Service',
    location: 'clinic',
    locationAddress: '123 Main St, City, State 12345',
    sessionType: 'group',
    sessionNotes: 'Test group session with multiple participants',
    rbtSignature: 'iamrbt',
    status: 'approved',
    bcbaApproved: false,
    clinicApproved: false,
    isRecurring: false,
    isSeriesMaster: false,
  })

  console.log(`✅ Created group session ID: ${groupSession.id}`)

  // Add participants
  for (const client of clients) {
    const participant = await SessionParticipant.create({
      sessionLogId: groupSession.id,
      clientId: client.id,
      notes: `Participant: ${client.fullName}`,
    })
    console.log(`   ✅ Added participant: ${client.fullName} (Participant ID: ${participant.id})`)
  }

  // Create a community session as well
  const communitySession = await SessionLog.create({
    clientId: null,
    rbtId: RBT_ID,
    bcbaId: BCBA_ID,
    date: DateTime.now().plus({ days: 2 }),
    startTime: '14:00',
    endTime: '16:00',
    duration: 120,
    totalHours: 2.0,
    cptCode: '97153',
    serviceType: 'Direct Service',
    location: 'community',
    locationAddress: 'Community Center, 456 Park Ave',
    sessionType: 'community',
    sessionNotes: 'Test community session with multiple participants',
    rbtSignature: 'iamrbt',
    status: 'approved',
    bcbaApproved: false,
    clinicApproved: false,
    isRecurring: false,
    isSeriesMaster: false,
  })

  console.log(`✅ Created community session ID: ${communitySession.id}`)

  // Add participants to community session
  for (const client of clients.slice(0, 2)) {
    const participant = await SessionParticipant.create({
      sessionLogId: communitySession.id,
      clientId: client.id,
      notes: `Community participant: ${client.fullName}`,
    })
    console.log(`   ✅ Added participant: ${client.fullName} (Participant ID: ${participant.id})`)
  }

  console.log('\n🎉 Test sessions created successfully!')
  console.log(`\n📋 Summary:`)
  console.log(`   Group Session ID: ${groupSession.id} (${clients.length} participants)`)
  console.log(`   Community Session ID: ${communitySession.id} (2 participants)`)
  console.log(`\n💡 Test these sessions in the RBT Dashboard → My Sessions → View Details`)
}

// Run the script
createTestGroupSession()
  .then(() => {
    console.log('\n✅ Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })
