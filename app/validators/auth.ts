import vine from '@vinejs/vine'

/**
 * HIPAA-Compliant Password Validation
 * Requirements:
 * - Minimum 10 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const passwordRule = vine
  .string()
  .minLength(10)
  .maxLength(100)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)

export const registerValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(100),
    email: vine.string().trim().email().normalizeEmail(),
    password: passwordRule,
    role: vine.enum(['ADMIN', 'CLINIC', 'BCBA', 'RBT', 'PARENT']),
    clinicId: vine.number().optional(),
    supervisorId: vine.number().optional(),
    hourlyRate: vine.number().optional(),
    phone: vine.string().trim().optional(),
    address: vine.string().trim().optional(),
    permissions: vine.array(vine.string()).optional(),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(1),
  })
)

export const forgotPasswordValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
  })
)

export const resetPasswordValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(1),
    password: passwordRule,
  })
)