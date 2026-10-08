
import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserRole } from "@prisma/client";
import * as argon2 from "argon2";

import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: dto.username,
      },
    });

    if (
      !user?.active ||
      user.role === UserRole.GUEST ||
      !(await argon2.verify(user.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException(
        "Invalid username or password"
      );
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
    };
  }
}
