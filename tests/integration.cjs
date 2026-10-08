// Run only against a dedicated, disposable test database.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
if (process.env.INTEGRATION_TEST_DATABASE !== "true")
  throw Error(
    "Set INTEGRATION_TEST_DATABASE=true only for a disposable test DB",
  );
const child = spawn(process.execPath, ["apps/api/dist/main.js"], {
  env: {
    ...process.env,
    PORT: "3001",
    APP_ORIGIN: "http://localhost:8080",
    COOKIE_SECURE: "false",
  },
  stdio: "inherit",
});
let cookie = "";
const base = "http://127.0.0.1:3001/api";
async function request(path, method = "GET", data, extra = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:8080",
      "X-Estylo-Request": "1",
      Cookie: cookie,
      ...extra,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const c = res.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  return { status: res.status, body: await res.json() };
}
(async () => {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await request("/health")).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert(ready, "API readiness");
  assert.equal((await request("/orders")).status, 401);
  assert.equal(
    (
      await request("/auth/login", "POST", {
        username: process.env.ADMIN_USERNAME || "admin",
        password: process.env.ADMIN_PASSWORD,
      })
    ).status,
    201,
  );
  const adminCookie = cookie;
  const products = (await request("/products")).body;
  assert.equal(products.length, 11);
  const product = products[0];
  assert.equal(
    (
      await request("/products/" + product.id, "PATCH", {
        priceCentavos: 12500,
        active: true,
      })
    ).status,
    200,
  );
  const name = "cashier-" + Date.now();
  const created = await request("/users", "POST", {
    username: name,
    displayName: "Test cashier",
    password: "IntegrationPassword123!",
    role: "CASHIER",
  });
  assert.equal(created.status, 201);
  assert.equal(
    (
      await request("/auth/login", "POST", {
        username: name,
        password: "IntegrationPassword123!",
      })
    ).status,
    201,
  );
  const cashierCookie = cookie;
  assert.equal((await request("/users")).status, 403);
  assert.equal(
    (
      await request("/products/" + product.id, "PATCH", {
        priceCentavos: 1,
        active: true,
      })
    ).status,
    403,
  );
  const payload = {
    customer: "Test customer",
    phone: "09123456789",
    address: "",
    fulfillment: "PICKUP",
    source: "SMS",
    items: [{ productId: product.id, quantity: 2 }],
  };
  const key = "integration-" + Date.now();
  const [one, two] = await Promise.all([
    request("/orders", "POST", payload, { "Idempotency-Key": key }),
    request("/orders", "POST", payload, { "Idempotency-Key": key }),
  ]);
  assert.equal(one.status, 201);
  assert.equal(two.status, 201);
  assert.equal(one.body.id, two.body.id);
  assert.equal(one.body.totalCentavos, 25000);
  const id = one.body.id;
  assert.equal(
    (await request("/orders/" + id, "PATCH", { status: "COMPLETED" })).status,
    409,
  );
  assert.equal(
    (await request("/orders/" + id, "PATCH", { status: "PREPARING" })).status,
    200,
  );
  assert.equal(
    (await request("/orders/" + id, "PATCH", { status: "READY" })).status,
    200,
  );
  assert.equal(
    (
      await request("/orders/" + id, "PATCH", {
        status: "COMPLETED",
        payment: "PAID",
      })
    ).status,
    200,
  );
  cookie = adminCookie;
  assert.equal(
    (await request("/users/" + created.body.id, "PATCH", { active: false }))
      .status,
    200,
  );
  cookie = cashierCookie;
  assert.equal((await request("/orders")).status, 401);
  cookie = adminCookie;
  assert((await request("/audit")).body.length > 0);
  console.log("PostgreSQL integration smoke checks passed.");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => child.kill());
