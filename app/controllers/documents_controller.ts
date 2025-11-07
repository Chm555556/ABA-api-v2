// Placeholder controller to satisfy TypeScript imports
// This file is not used by the simple Express server

export default class DocumentsController {
  async index() {
    return { data: [] };
  }

  async store() {
    return { success: true };
  }

  async destroy() {
    return { success: true };
  }

  async download() {
    return { success: true };
  }
}