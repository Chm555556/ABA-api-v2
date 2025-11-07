import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: string[] }) {
    const { response, auth } = ctx
    
    if (!auth?.user) {
      return response.status(401).json({
        message: 'Authentication required',
      })
    }

    const userRole = auth.user.role
    const allowedRoles = options.roles

    if (!allowedRoles.includes(userRole)) {
      return response.status(403).json({
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: userRole,
      })
    }

    await next()
  }
}