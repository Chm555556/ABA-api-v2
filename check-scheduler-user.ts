import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

async function checkSchedulerUser() {
  try {
    // Find scheduler user
    const scheduler = await User.findBy('email', 'scheduler@test.com')
    
    if (!scheduler) {
      console.log('❌ Scheduler user not found')
      return
    }
    
    console.log('✅ Scheduler user found:')
    console.log('  ID:', scheduler.id)
    console.log('  Name:', scheduler.name)
    console.log('  Email:', scheduler.email)
    console.log('  Role:', scheduler.role)
    console.log('  Active:', scheduler.isActive)
    console.log('  Verified:', scheduler.verified)
    
    // Test password
    const testPassword = 'Scheduler@1234'
    const isValid = await hash.verify(scheduler.password, testPassword)
    console.log('  Password test:', isValid ? '✅ Valid' : '❌ Invalid')
    
    // Try to verify with the user method
    const isValidUser = await scheduler.verifyPassword(testPassword)
    console.log('  User verify:', isValidUser ? '✅ Valid' : '❌ Invalid')
    
  } catch (error) {
    console.error('Error:', error.message)
  }
  
  process.exit(0)
}

checkSchedulerUser()
