import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator, registerValidator } from '#validators/auth'

export default class AuthController {
  /**
   * Handle user registration
   */
  async register({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(registerValidator)
      
      // Check if user already exists
      const existingUser = await User.findBy('email', payload.email)
      if (existingUser) {
        return response.status(400).json({
          message: 'User with this email already exists',
        })
      }

      // Create new user with clinic_id if provided
      const user = await User.create({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role,
        clinicId: payload.clinicId || null,
        supervisorId: payload.supervisorId,
        hourlyRate: payload.hourlyRate,
        phone: payload.phone,
        address: payload.address,
        permissions: payload.permissions || [],
        isActive: true,
        verified: false,
      })

      // Generate JWT token
      const token = await User.accessTokens.create(user)

      return response.status(201).json({
        message: 'User registered successfully',
        token: token.value!.release(),
      })
    } catch (error) {
      console.error('Registration error:', error)
      return response.status(400).json({
        message: 'Registration failed',
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * Handle user login
   */
  async login({ request, response }: HttpContext) {
    try {
      console.log('🔐 LOGIN attempt')
      const payload = await request.validateUsing(loginValidator)
      
      // Find user by email with fresh data from database
      const user = await User.query()
        .where('email', payload.email)
        .preload('clinic') // Preload clinic relationship if it exists
        .first()
      
      if (!user) {
        console.log('❌ User not found:', payload.email)
        return response.status(401).json({
          message: 'Invalid credentials',
        })
      }

      console.log('👤 User found:', {
        id: user.id,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      })

      // Verify password
      const isValidPassword = await user.verifyPassword(payload.password)
      if (!isValidPassword) {
        console.log('❌ Invalid password for:', payload.email)
        return response.status(401).json({
          message: 'Invalid credentials',
        })
      }

      // Check if user is active
      if (!user.isActive) {
        console.log('❌ User is inactive:', payload.email)
        return response.status(401).json({
          message: 'Account is deactivated',
        })
      }

      // Refresh user data to ensure we have the latest clinic_id
      await user.refresh()

      // Generate JWT token
      const token = await User.accessTokens.create(user)

      console.log('✅ Login successful for:', user.email, 'Token generated')

      return response.json({
        message: 'Login successful',
        token: token.value!.release(),
      })
    } catch (error) {
      console.error('❌ Login error:', error)
      return response.status(400).json({
        message: 'Login failed',
        errors: error.messages || error.message,
      })
    }
  }

  /**
   * Get current user profile
   * This is called by NextAuth after login to get user details
   */
  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      
      // CRITICAL: Reload user from database to get fresh data including clinic_id
      await user.refresh()
      
      // Preload clinic relationship if it exists
      if (user.clinicId) {
        await user.load('clinic')
      }
      
      console.log('📋 me() called - User:', {
        id: user.id,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
      })
      
      // Return complete user object with all fields
      return response.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        clinicId: user.clinicId,
        supervisorId: user.supervisorId,
        hourlyRate: user.hourlyRate,
        phone: user.phone,
        address: user.address,
        isActive: user.isActive,
        verified: user.verified,
        permissions: user.permissions || [],
        createdAt: user.createdAt.toISO(),
        updatedAt: user.updatedAt?.toISO(),
      })
    } catch (error) {
      console.error('❌ me() error:', error)
      return response.status(401).json({
        message: 'Unauthorized',
        error: error.message,
      })
    }
  }

  /**
   * Handle user logout
   */
  async logout({ auth, response }: HttpContext) {
    try {
      const user = auth.user
      
      if (user) {
        // Revoke all tokens for this user
        await User.accessTokens.delete(user, user.currentAccessToken.identifier)
        console.log('✅ User logged out:', user.email)
      }

      return response.json({
        message: 'Logged out successfully',
      })
    } catch (error) {
      console.error('Logout error:', error)
      return response.json({
        message: 'Logged out successfully',
      })
    }
  }

  /**
   * Refresh JWT token
   */
  async refresh({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      
      // Reload user to get fresh data including clinic_id
      await user.refresh()
      
      // Preload clinic relationship if it exists
      if (user.clinicId) {
        await user.load('clinic')
      }
      
      // Generate new JWT token
      const token = await User.accessTokens.create(user)

      console.log('🔄 Token refreshed for user:', user.email, 'Clinic:', user.clinicId)

      return response.json({
        message: 'Token refreshed successfully',
        token: token.value!.release(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId,
          supervisorId: user.supervisorId,
          hourlyRate: user.hourlyRate,
          phone: user.phone,
          address: user.address,
          isActive: user.isActive,
          verified: user.verified,
          permissions: user.permissions || [],
        },
      })
    } catch (error) {
      console.error('Token refresh error:', error)
      return response.status(401).json({
        message: 'Token refresh failed',
        error: error.message,
      })
    }
  }
}
