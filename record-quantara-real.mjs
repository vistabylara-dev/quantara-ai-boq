import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.QUANTARA_URL || "https://quantara.vistabylara.com";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const root = path.resolve(process.cwd(), "tutorial-recording");
const rawDir = path.join(root, "raw");
const finalDir = path.join(root, "final");
const statePath = path.join(root, `.quantara-auth-${stamp}.json`);
const sourcePdf = path.join(__dirname, "quantara_tutorial_source.pdf");
fs.mkdirSync(rawDir, { recursive: true });
fs.mkdirSync(finalDir, { recursive: true });

const clientName = `Quantara Tutorial Client ${stamp.slice(0, 10)}`;
const clientCompany = "Quantara Tutorial Construction LLC";
const clientEmail = `quantara.tutorial.${Date.now()}@example.com`;
const projectName = `Quantara Tutorial Project ${stamp.slice(0, 10)}`;
const projectRef = `QT-${Date.now()}`;

function log(s) { console.log(`\n[QUANTARA RECORDER] ${s}`); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function shown(locator, ms = 1800) {
  try { return await locator.isVisible({ timeout: ms }); } catch { return false; }
}
async function safeClick(locator, label, wait = 1300) {
  if (await shown(locator, 2500)) {
    log(`Click: ${label}`);
    await locator.scrollIntoViewIfNeeded().catch(()=>{});
    await locator.click();
    await sleep(wait);
    return true;
  }
  log(`Skip (not currently available): ${label}`);
  return false;
}
async function settle(page, ms=1800) {
  await page.waitForLoadState("domcontentloaded").catch(()=>{});
  await sleep(ms);
}

log("Launching Quantara. Login is intentionally NOT recorded.");
const browser = await chromium.launch({
  headless: false,
  args: ["--start-maximized"],
});

const auth = await browser.newContext({
  viewport: { width: 1600, height: 900 },
});
const login = await auth.newPage();
await login.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });

console.log(`
============================================================
LOGIN SAFELY IN THE OPEN BROWSER WINDOW.
The recording has NOT started yet, so your password is not recorded.
After Quantara reaches /dashboard, the tutorial recording starts automatically.
============================================================
`);

await login.waitForURL(/\/dashboard(?:[/?#]|$)/, { timeout: 0 });
await auth.storageState({ path: statePath });
await auth.close();

log("Authenticated. Starting REAL production UI recording now.");
const context = await browser.newContext({
  storageState: statePath,
  viewport: { width: 1600, height: 900 },
  recordVideo: {
    dir: rawDir,
    size: { width: 1600, height: 900 },
  },
});
const page = await context.newPage();
const video = page.video();

try {
  // 1. Dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 2500);

  // 2. Create a real tutorial client
  log("STEP 1: Create tutorial client");
  await page.goto(`${BASE}/clients/new`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);
  await page.getByLabel("Client name").fill(clientName);
  await page.getByLabel("Company name").fill(clientCompany);
  await page.getByLabel("Email").fill(clientEmail);
  await page.getByLabel("Phone").fill("+971 50 000 0000");
  await page.getByLabel("Address").fill("Dubai, United Arab Emirates");
  await page.getByLabel("Notes").fill("Tutorial/demo client created by the Quantara real-UI recorder.");
  await sleep(1200);
  await page.getByRole("button", { name: /Save client/i }).click();
  await page.waitForURL(/\/clients\/[^/]+$/, { timeout: 30000 });
  await settle(page, 2000);

  // 3. Create project with actual Quantara project form
  log("STEP 2: Create project workspace");
  await page.goto(`${BASE}/projects/new`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);
  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Project reference").fill(projectRef);

  const clientPicker = page.getByRole("button", { name: /Select or create a client/i });
  await clientPicker.click();
  const searchClient = page.getByPlaceholder("Search clients...");
  await searchClient.fill(clientEmail);
  await sleep(700);
  const clientResult = page.getByRole("button", { name: new RegExp(clientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
  if (await shown(clientResult, 5000)) {
    await clientResult.click();
  } else {
    throw new Error("Tutorial client was created but could not be selected in the project form.");
  }

  await page.getByLabel("Location").fill("Dubai, UAE");
  await page.getByLabel("Currency").fill("AED");
  await page.getByLabel("Tax rate (%)").fill("5");
  await page.getByLabel("Language").fill("English");
  await page.getByLabel("Project description").fill(
    "Real Quantara tutorial project used to demonstrate source processing, BOQ review, document generation and TAYQAN."
  );
  await sleep(1600);
  await page.getByRole("button", { name: /^Create project$/i }).click();
  await page.waitForURL(/\/projects\/[^/?#]+(?:[/?#]|$)/, { timeout: 30000 });
  await settle(page, 2200);

  const u = new URL(page.url());
  const parts = u.pathname.split("/").filter(Boolean);
  const projectKey = parts[1];
  if (!projectKey) throw new Error(`Could not determine project id from ${page.url()}`);
  log(`Created project route: ${projectKey}`);

  // 4. Real source upload and processing
  log("STEP 3: Upload and process a real demo source");
  await page.goto(`${BASE}/projects/${projectKey}/files`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 1800);
  await page.locator('input[type="file"]').setInputFiles(sourcePdf);
  await page.getByText("quantara_tutorial_source.pdf", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await settle(page, 1800);
  await page.getByText("quantara_tutorial_source.pdf", { exact: true }).click();
  await settle(page, 1400);

  const classify = page.getByRole("button", { name: /^Classify$/i });
  if (await safeClick(classify, "Classify", 1000)) {
    await page.getByText(/Classification/i).first().waitFor({ state: "visible", timeout: 10000 }).catch(()=>{});
    await sleep(5000);
  }

  const render = page.getByRole("button", { name: /^Render Pages$/i });
  if (await render.isEnabled().catch(()=>false)) {
    await safeClick(render, "Render Pages", 1000);
    await sleep(7000);
  }

  const detect = page.getByRole("button", { name: /^Detect Schedule Tables$/i });
  if (await detect.isEnabled().catch(()=>false)) {
    await safeClick(detect, "Detect Schedule Tables", 1000);
    await sleep(7000);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page, 2500);

  // 5. BOQ Studio
  log("STEP 4: Build/review the BOQ");
  await page.goto(`${BASE}/projects/${projectKey}/boq`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 2200);

  const wizard = page.getByText("Choose how you want Quantara to begin");
  if (await shown(wizard, 1500)) {
    const manualHeading = page.getByRole("heading", { name: "Start Manually" });
    if (await shown(manualHeading)) {
      await manualHeading.click();
      await settle(page, 1200);
    }
  }

  // Open the Add Item interface if needed.
  if (!(await shown(page.getByPlaceholder("Item code"), 1200))) {
    const addCandidates = [
      page.getByRole("button", { name: /Add First Item/i }).first(),
      page.getByRole("button", { name: /^Add item$/i }).first(),
      page.getByRole("button", { name: /Add Item/i }).first(),
    ];
    for (const cand of addCandidates) {
      if (await safeClick(cand, "Add item", 900)) break;
    }
  }

  const manualTabs = [
    page.getByRole("button", { name: /Enter Item Manually/i }).last(),
    page.getByRole("button", { name: /Create manually/i }).last(),
  ];
  for (const tab of manualTabs) {
    if (await safeClick(tab, "Manual item entry", 700)) break;
  }

  if (await shown(page.getByPlaceholder("Item code"), 3500)) {
    await page.getByPlaceholder("Item code").fill("QT-001");
    await page.getByPlaceholder("Category").fill("MEP");
    await page.getByPlaceholder("Description").fill("Supply and install 25mm PPR pipe");
    await page.getByPlaceholder("Unit", { exact: true }).fill("m");
    await page.getByPlaceholder("Quantity").fill("120");
    await page.getByPlaceholder("Unit cost").fill("18.50");
    await sleep(1400);
    await page.getByRole("button", { name: /Add to BOQ/i }).click();
    await page.locator('input[value="QT-001"]').waitFor({ state: "visible", timeout: 15000 }).catch(()=>{});
    await settle(page, 1800);
  } else {
    log("Could not open manual item form; BOQ page is still recorded exactly as production presented it.");
  }

  const saveDraft = page.getByRole("button", { name: /Save draft/i });
  await safeClick(saveDraft, "Save draft", 1800);

  // Show verification before lock.
  log("STEP 5: Verification");
  await page.goto(`${BASE}/projects/${projectKey}/verification`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 3000);

  // Return and lock if production permits.
  await page.goto(`${BASE}/projects/${projectKey}/boq`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 1500);
  const lock = page.getByRole("button", { name: /Lock revision/i });
  if (await lock.isEnabled().catch(()=>false)) {
    await safeClick(lock, "Lock revision", 1800);
    const confirm = page.getByRole("button", { name: /Confirm.*lock|Lock revision/i }).last();
    if (await shown(confirm, 1200) && await confirm.isEnabled().catch(()=>false)) {
      await safeClick(confirm, "Confirm lock", 1800);
    }
  } else {
    log("Lock revision is not currently enabled; recording preserves the actual production state.");
  }

  // 6. Documents
  log("STEP 6: Generate a professional document");
  await page.goto(`${BASE}/projects/${projectKey}/documents`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 2500);

  const preview = page.getByRole("link", { name: /Preview My Professional BOQ/i });
  if (await shown(preview, 2000)) {
    await preview.click();
    await settle(page, 2500);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await settle(page, 1600);
  }

  const format = page.getByLabel("Format");
  if (await shown(format, 1800)) {
    await format.selectOption("PDF").catch(()=>{});
  }
  const generate = page.getByRole("button", { name: /Generate document/i });
  if (await generate.isEnabled().catch(()=>false)) {
    await safeClick(generate, "Generate PDF document", 2500);
    await sleep(7000);
  } else {
    log("PDF is not currently generatable (lock/verification/commercial rule). Demonstrating CSV fallback.");
    if (await shown(format, 1000)) await format.selectOption("CSV").catch(()=>{});
    if (await generate.isEnabled().catch(()=>false)) {
      await safeClick(generate, "Generate CSV document", 2500);
      await sleep(5000);
    }
  }

  // 7. TAYQAN
  log("STEP 7: Hire TAYQAN");
  await page.goto(`${BASE}/projects/${projectKey}/tayqan`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page, 3500);

  const objective = page.locator("#tayqan-objective");
  const instructions = page.locator("#tayqan-instructions");
  if (await shown(objective, 2500)) {
    await objective.fill("Review this BOQ before client submission.");
    await instructions.fill("Check quantities, rates, revision evidence, verification issues and material questions.");
    await sleep(1700);
    const hire = page.getByRole("button", { name: /Hire TAYQAN/i });
    if (await shown(hire, 2500)) {
      await safeClick(hire, "Hire TAYQAN", 2500);
      // Give the durable worker time to progress, showing real statuses.
      for (let i = 0; i < 5; i++) {
        await sleep(6000);
        await page.reload({ waitUntil: "domcontentloaded" }).catch(()=>{});
        await settle(page, 1200);
        if (await shown(page.getByText(/Findings/i), 500)) break;
      }
    }
  } else {
    log("TAYQAN already has an assignment or production returned another real state; recording that state as-is.");
  }

  await settle(page, 5000);
  log("Real UI tutorial path completed.");
} catch (err) {
  console.error("\n[QUANTARA RECORDER] The real production run stopped at the current step:", err);
  console.error("The video up to the exact failure point will still be saved for diagnosis.");
  await sleep(3000);
} finally {
  await page.close().catch(()=>{});
  await context.close().catch(()=>{});

  let rawPath = null;
  try { rawPath = await video.path(); } catch {}
  if (rawPath && fs.existsSync(rawPath)) {
    const webm = path.join(finalDir, `Quantara_REAL_UI_Tutorial_${stamp}.webm`);
    fs.copyFileSync(rawPath, webm);
    log(`REAL screen recording saved: ${webm}`);

    // Convert automatically when ffmpeg is available on the Windows PC.
    const check = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"], { encoding: "utf8" });
    if (check.status === 0) {
      const mp4 = path.join(finalDir, `Quantara_REAL_UI_Tutorial_${stamp}.mp4`);
      const conv = spawnSync("ffmpeg", [
        "-y", "-i", webm,
        "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        mp4
      ], { stdio: "inherit" });
      if (conv.status === 0) log(`MP4 saved: ${mp4}`);
    } else {
      log("ffmpeg is not installed, so the genuine recording is saved as WebM. It can be uploaded to ChatGPT for final MP4 editing.");
    }
  }

  try { fs.unlinkSync(statePath); } catch {}
  await browser.close().catch(()=>{});
}
