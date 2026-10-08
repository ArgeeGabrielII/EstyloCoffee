import { RolesGuard } from "./roles.guard";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
function context(role: string) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext;
}
describe("Role enforcement", () => {
  const reflector = {
    getAllAndOverride: () => ["ADMIN"],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  it("denies cashier from admin resources", () =>
    expect(() => guard.canActivate(context("CASHIER"))).toThrow());
  it("allows admin", () =>
    expect(guard.canActivate(context("ADMIN"))).toBe(true));
});
