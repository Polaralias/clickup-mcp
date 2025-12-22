import bcrypt from "bcryptjs"

export class PasswordService {
  async hash(password: string): Promise<string> {
    return await bcrypt.hash(password, 10)
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash)
  }
}
