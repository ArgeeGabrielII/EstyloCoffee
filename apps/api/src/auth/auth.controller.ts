import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { CurrentUser, AuthUser } from "../common/current-user.decorator";
import { AuthGuard } from "./auth.guard";
import { LoginDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto);
    res.cookie("estylo_token", result.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 12 * 60 * 60 * 1000,
    });
    return { user: result.user };
  }
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("estylo_token");
    return { ok: true };
  }
  @Get("me")
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
