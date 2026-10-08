const { chromium } = require("playwright");
const fs = require("fs");
fs.mkdirSync("test-results", { recursive: true });
(async () => {
  const results = [];
  for (const [width, height] of [
    [375, 667],
    [390, 844],
    [768, 1024],
    [820, 1180],
    [1024, 1366],
    [1180, 820],
  ]) {
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    let user = null,
      orders = [];
    let currentRole = "ADMIN";
    const products = [
      "AMERICANO",
      "CAFE LATTE",
      "CAPPUCCINO",
      "CARAMEL LATTE",
      "SPANISH LATTE",
      "WHITE CHOCO MOCHA",
      "DARK CHOCO MOCHA",
      "CARAMEL MACCHIATO",
      "VANILLA LATTE",
      "HAZELNUT LATTE",
      "SEA SALT LATTE",
    ].map((name, i) => ({
      id: "product-" + i,
      name,
      active: true,
      priceCentavos: 12500,
    }));
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      const path = require("path");
      let file = path.join("apps/web/dist", url.pathname);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = "apps/web/dist/index.html";
      const ext = path.extname(file);
      await route.fulfill({
        contentType:
          {
            ".js": "application/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".woff2": "font/woff2",
            ".woff": "font/woff",
            ".html": "text/html",
          }[ext] || "application/octet-stream",
        body: fs.readFileSync(file),
      });
    });
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      let body = {},
        status = 200;
      if (url.pathname === "/api/auth/me") {
        body = user || { message: "Unauthorized" };
        if (!user) status = 401;
      } else if (url.pathname === "/api/auth/login") {
        user = {
          id: "admin",
          username: "admin",
          displayName: "Administrator",
          role: currentRole,
        };
        body = { user };
      } else if (url.pathname === "/api/auth/logout") {
        user = null;
        body = { ok: true };
      } else if (url.pathname === "/api/products") body = products;
      else if (url.pathname === "/api/reports")
        body = {
          count: orders.length,
          paidCount: 0,
          paidCentavos: 0,
          open: orders.length,
          statuses: [],
        };
      else if (url.pathname === "/api/orders" && req.method() === "POST") {
        const d = req.postDataJSON();
        body = {
          ...d,
          id: "order-" + width,
          status: "NEW",
          payment: "UNPAID",
          createdAt: new Date().toISOString(),
          totalCentavos: 25000,
          items: d.items.map((i) => ({
            ...i,
            id: "item",
            name: "AMERICANO",
            unitPriceCentavos: 12500,
          })),
        };
        orders.push(body);
      } else if (url.pathname === "/api/orders")
        body = { rows: orders, total: orders.length, page: 1 };
      else if (url.pathname === "/api/users")
        body = [{ ...user, active: true }];
      else if (url.pathname === "/api/audit") body = [];
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    // Serve SPA entry for direct routes on static server.
    page.on("requestfailed", (r) =>
      console.log("FAILED", r.url(), r.failure()),
    );
    page.on("response", (r) => {
      if (r.status() >= 400) console.log("HTTP", r.status(), r.url());
    });
    page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
    await page.goto("http://127.0.0.1:5173/login");
    await page.waitForTimeout(1500);
    await page.getByLabel("Username", { exact: true }).fill("admin");
    await page.getByLabel("Password", { exact: true }).fill("password");
    await page.getByRole("button", { name: "SIGN IN", exact: true }).click();
    await page
      .getByRole("heading", { name: "Dashboard", exact: true })
      .waitFor();
    if (width <= 600) await page.getByLabel("Toggle navigation").click();
    await page.getByRole("link", { name: "Cashier", exact: true }).click();
    await page.getByRole("button", { name: "AMERICANO" }).click();
    await page.getByLabel("Add one AMERICANO").click();
    await page.getByLabel("Customer", { exact: true }).fill("Kenji");
    await page.getByLabel("Source", { exact: true }).selectOption("SMS");
    await page.getByLabel("Phone", { exact: true }).fill("09123456789");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) throw Error("POS horizontal overflow at " + width);
    await page.screenshot({
      path: "test-results/cashier-" + width + "x" + height + ".png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "CREATE ORDER", exact: true })
      .click();
    await page.getByText("created.", { exact: false }).waitFor();
    if (orders[0].items[0].quantity !== 2) throw Error("Cart quantity failed");
    await page.getByRole("link", { name: "Open order board" }).click();
    await page.getByRole("heading", { name: "Orders", exact: true }).waitFor();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw Error("Orders overflow at " + width);
    results.push({
      viewport: width + "x" + height,
      login: "pass",
      cart: "pass",
      SMS_order: "pass",
      orders: "pass",
      horizontalOverflow: false,
    });
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(
    "test-results/browser-results.json",
    JSON.stringify(results, null, 2),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
