import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class CreateTestUser extends BaseCommand {
  static commandName = 'create:test-user'
  static description = ''

  static options: CommandOptions = {}

  async run() {
    this.logger.info('Hello world from "CreateTestUser"')
  }
}