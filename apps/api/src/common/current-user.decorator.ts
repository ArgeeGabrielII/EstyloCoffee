import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserRole } from "@prisma/client";
export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
