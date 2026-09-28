import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext();
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") {
      await route.abort();
      return;
    }
    if (
      url.pathname === "/src/data/repository.ts" ||
      /^\/assets\/repository-.*\.js$/.test(url.pathname)
    ) {
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.__subscriptions=0;export const subscribe=()=>{window.__subscriptions++;return ()=>{}};export const newId=()=>crypto.randomUUID();export const createClient=()=>{throw new Error('Escrita não autorizada no teste')};export const changeAccount=createClient;export const saveService=createClient;`,
      });
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5503");
  await page.locator("#auth-overlay").waitFor();
  assert.equal(
    await page.evaluate(() => window.__subscriptions),
    0,
    "Nenhuma consulta antes do acesso local",
  );
  await page.locator("#auth-senha").fill("senha-invalida-de-teste");
  await page.locator("#auth-btn").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#auth-erro").textContent === "Senha incorreta",
  );
  assert.equal(await page.locator("#auth-senha").inputValue(), "");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("le_auth_ok")),
    null,
  );
  assert.equal(await page.evaluate(() => window.__subscriptions), 0);
  assert.equal(await page.locator("#app-admin").count(), 0);
  console.log(
    "Acesso: senha incorreta recusada e nenhuma consulta ao banco antes da liberação local.",
  );
} finally {
  await browser.close();
}
