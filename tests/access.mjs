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
        body: `window.__subscriptions=0;export const app={};export const subscribe=()=>{window.__subscriptions++;return ()=>{}};export const newId=()=>crypto.randomUUID();export const createClient=()=>{throw new Error('Escrita não autorizada no teste')};export const changeAccount=createClient;export const saveService=createClient;`,
      });
      return;
    }
    if (
      url.pathname === "/src/data/auth.ts" ||
      /^\/assets\/auth-.*\.js$/.test(url.pathname)
    ) {
      // Simula o Firebase Authentication recusando credenciais.
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.__signIns=0;export const watchUser=(next)=>{queueMicrotask(()=>next(null));return ()=>{};};export const signIn=async()=>{window.__signIns++;throw Object.assign(new Error('recusado'),{code:'auth/invalid-credential'});};export const signOut=async()=>{};`,
      });
      return;
    }
    await route.continue();
  });
  // A antiga liberação local não deve mais dar acesso.
  await context.addInitScript(() => localStorage.setItem("le_auth_ok", "1"));
  const page = await context.newPage();
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5503");
  await page.locator("#auth-email").waitFor();
  assert.equal(
    await page.evaluate(() => window.__subscriptions),
    0,
    "Nenhuma consulta antes do login",
  );
  await page.locator("#auth-email").fill("teste@example.test");
  await page.locator("#auth-senha").fill("senha-invalida-de-teste");
  await page.locator("#auth-btn").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#auth-erro").textContent ===
      "E-mail ou senha incorretos",
  );
  assert.equal(await page.evaluate(() => window.__signIns), 1);
  assert.equal(await page.locator("#auth-senha").inputValue(), "");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("le_auth_ok")),
    null,
  );
  assert.equal(await page.evaluate(() => window.__subscriptions), 0);
  assert.equal(await page.locator("#app-admin").count(), 0);
  console.log(
    "Acesso: credencial recusada, liberação local ignorada e nenhuma consulta ao banco antes do login.",
  );
} finally {
  await browser.close();
}
