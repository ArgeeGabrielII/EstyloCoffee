import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const request = ctx.switchToHttp().getRequest();
    const token = request.cookies?.estylo_token;
    if (!token) throw new UnauthorizedException("Authentication required");
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user?.active) throw new UnauthorizedException("Account inactive");
      request.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired session");
    }
  }
}
