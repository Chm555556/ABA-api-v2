# Production Commands

This directory contains production-ready maintenance and utility commands for the ABA Connect application.

## Available Commands

### 🔧 Database Maintenance

#### `final_fix.ts`
**Command**: `node ace final:fix`
**Purpose**: Fix clinic_id assignments for all users and ensure database consistency
**Usage**: Run when users are missing clinic assignments or after database migrations
**Production Safe**: ✅ Yes

#### `fix_clinic_assignments.ts`
**Command**: `node ace fix:clinic-assignments`
**Purpose**: Assign all users without clinic_id to a default clinic
**Usage**: Run during initial setup or when clinic assignments are missing
**Production Safe**: ✅ Yes

### 👥 User Management

#### `create_admin_user.ts`
**Command**: `node ace create:admin-user <name> <email> [--role=BCBA] [--password=Admin123!]`
**Purpose**: Create admin users (ADMIN, BCBA, or SCHEDULER roles)
**Examples**:
```bash
# Create a BCBA user
node ace create:admin-user "Dr. Smith" "dr.smith@clinic.com" --role=BCBA --password=SecurePass123

# Create an admin user
node ace create:admin-user "Admin User" "admin@clinic.com" --role=ADMIN

# Create a scheduler
node ace create:admin-user "Scheduler" "scheduler@clinic.com" --role=SCHEDULER
```
**Production Safe**: ✅ Yes

#### `check_user.ts`
**Command**: `node ace check:user <email> [--password=newpassword]`
**Purpose**: Check user details and optionally reset password
**Examples**:
```bash
# Check user details
node ace check:user "user@example.com"

# Check user and reset password
node ace check:user "user@example.com" --password=NewPassword123
```
**Production Safe**: ✅ Yes

### 🎯 Demo & Training

#### `create_demo_sessions.ts`
**Command**: `node ace create:demo-sessions`
**Purpose**: Create demo group and community sessions for training and testing
**Usage**: Run to create sample data for training new staff or demonstrating features
**Production Safe**: ⚠️ Use with caution (creates test data)

## Usage Guidelines

### For Production Deployment
1. **Always backup your database** before running maintenance commands
2. **Test commands in staging** environment first
3. **Run during maintenance windows** for database modification commands

### For Development/Training
- Use `create:demo-sessions` to generate sample data
- Use `check:user` to troubleshoot authentication issues
- Use `create:admin-user` to quickly create test accounts

### Command Safety Levels
- ✅ **Production Safe**: Can be run safely in production
- ⚠️ **Use with Caution**: May create test data or modify existing data
- ❌ **Development Only**: Should never be run in production

## Removed Commands (Development Only)
The following debug commands were removed as they were specific to development troubleshooting:
- `check_client_37.ts` - Debug specific client
- `check_client_37_details.ts` - Debug client details
- `debug_client_37_json.ts` - Debug JSON parsing
- `debug_client_goals.ts` - Debug goal relationships
- `raw_client_check.ts` - Raw database debugging
- `check_bcba_user.ts` - Debug specific BCBA user
- `create_test_user.ts` - Empty placeholder

## Best Practices
1. Always run commands with appropriate user permissions
2. Monitor command output for errors or warnings
3. Keep logs of maintenance command executions
4. Document any custom modifications to these commands
5. Test commands in development before production use