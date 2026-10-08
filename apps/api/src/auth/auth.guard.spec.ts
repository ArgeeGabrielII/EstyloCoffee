import { ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { AuthGuard } from "./auth.guard";
function ctx(request: object) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}
describe("Authentication guard", () => {
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: "staff" }) };
  const p = { user: { findUnique: jest.fn() } };
  const guard = new AuthGuard(
    jwt as unknown as JwtService,
    p as unknown as PrismaService,
  );
  it("requires a cookie", async () => {
    await expect(guard.canActivate(ctx({ cookies: {} }))).rejects.toThrow();
  });
  it("rejects a deactivated account even with a valid token", async () => {
    p.user.findUnique.mockResolvedValue({ active: false });
    await expect(
      guard.canActivate(ctx({ cookies: { estylo_token: "valid" } })),
    ).rejects.toThrow();
  });
  it("uses current database role and identity", async () => {
    p.user.findUnique.mockResolvedValue({
      id: "staff",
      username: "staff",
      displayName: "Staff",
      active: true,
      role: "CASHIER",
    });
    const request: { cookies: object; user?: { role: string } } = {
      cookies: { estylo_token: "valid" },
    };
    expect(await guard.canActivate(ctx(request))).toBe(true);
    expect(request.user?.role).toBe("CASHIER");
  });
});
