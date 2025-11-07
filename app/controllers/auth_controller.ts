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

      // Create new user
      const user = await User.create({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role,
        // clinicId: payload.clinicId,
        supervisorId: payload.supervisorId,
        hourlyRate: payload.hourlyRate,
        phone: payload.phone,
        address: payload.address,
        permissions: payload.permissions || [],
      })

      // Generate JWT token
      const token = await User.accessTokens.create(user)

      return response.status(201).json({
        message: 'User registered successfully',
        token
      })
    } catch (error) {
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
    // try {
      console.log('LOGIN')
      const payload = await request.validateUsing(loginValidator)
      
      // Find user by email
      const user = await User.query().where('email', payload.email).first()
      if (!user) {
        return response.status(401).json({
          message: 'Invalid credentials',
        })
      }

      // Verify password
      const isValidPassword = await user.verifyPassword(payload.password)
      if (!isValidPassword) {
        return response.status(401).json({
          message: 'Invalid credentials',
        })
      }

      // Check if user is active
      if (!user.isActive) {
        return response.status(401).json({
          message: 'Account is deactivated',
        })
      }

      // Generate JWT token
      const token = await User.accessTokens.create(user)

      return response.json({
        message: 'Login successful',
        token: token.value!.release()
      })
    // } catch (error) {
    //   return response.status(400).json({
    //     message: 'Login failed',
    //     errors: error.messages || error.message,
    //   })
    // }
  }

  /**
   * Get current user profile
   */
  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      
      return response.json(user)
    } catch (error) {
      return response.status(401).json({
        message: 'Unauthorized',
      })
    }
  }

  /**
   * Handle user logout
   */
  async logout({ response }: HttpContext) {
    return response.json({
      message: 'Logged out successfully',
    })
  }

  /**
   * Refresh JWT token
   */
  async refresh({ auth, response }: HttpContext) {
    try {
      const user = auth.user!
      
      // Generate new JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      )

      return response.json({
        message: 'Token refreshed successfully',
        data: {
          token,
        },
      })
    } catch (error) {
      return response.status(401).json({
        message: 'Token refresh failed',
      })
    }
  }
}