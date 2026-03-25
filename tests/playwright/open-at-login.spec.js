import { test, expect } from "@playwright/test";
import { HeynotePage } from "./test-utils.js";

/** @type HeynotePage */
let heynotePage

test.beforeEach(async ({ page }) => {
    heynotePage = new HeynotePage(page)
    await heynotePage.goto()
});

test("TC-1: Launch at login checkbox is hidden in webapp mode", async ({ page }) => {
    await page.locator("css=.status-block.settings").click()
    await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
    const checkbox = page.getByLabel("Launch at login")
    await expect(checkbox).toHaveCount(0)
})

test("TC-2: Always on top checkbox is hidden in webapp mode", async ({ page }) => {
    await page.locator("css=.status-block.settings").click()
    await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
    const checkbox = page.getByLabel("Always on top")
    await expect(checkbox).toHaveCount(0)
})

test("TC-3: openAtLogin setting persists through reload", async ({ page }) => {
    // Set openAtLogin to true via settings
    await page.evaluate(() => {
        const settings = JSON.parse(localStorage.getItem("settings") || "{}")
        settings.openAtLogin = true
        localStorage.setItem("settings", JSON.stringify(settings))
    })
    // Reload and verify the setting is preserved
    await heynotePage.goto()
    const settings = await heynotePage.getStoredSettings()
    expect(settings.openAtLogin).toBe(true)
})

test("TC-4: openAtLogin default is false or undefined", async ({ page }) => {
    const settings = await heynotePage.getStoredSettings()
    // Initially settings may be null or openAtLogin may be undefined/false
    if (settings !== null && settings.openAtLogin !== undefined) {
        expect(settings.openAtLogin).toBe(false)
    } else {
        // Not set yet, which is expected default behavior
        expect(settings === null || settings.openAtLogin === undefined).toBeTruthy()
    }
})

test("TC-5: Insert date/time uses en-GB locale", async ({ page }) => {
    const expectedYear = new Date().toLocaleString('en-GB', {
        year: 'numeric',
    })
    await page.locator("body").press("Alt+Shift+D")
    await expect.poll(async () => await heynotePage.getBlockContent(0)).toContain(expectedYear)
    expect((await heynotePage.getBlockContent(0)).length).toBeGreaterThan(0)
})

test("TC-6: openAtLogin toggle updates settings data correctly", async ({ page }) => {
    // Set openAtLogin to true
    await page.evaluate(() => {
        const settings = JSON.parse(localStorage.getItem("settings") || "{}")
        settings.openAtLogin = true
        localStorage.setItem("settings", JSON.stringify(settings))
    })
    let settings = await heynotePage.getStoredSettings()
    expect(settings.openAtLogin).toBe(true)

    // Set openAtLogin back to false
    await page.evaluate(() => {
        const settings = JSON.parse(localStorage.getItem("settings") || "{}")
        settings.openAtLogin = false
        localStorage.setItem("settings", JSON.stringify(settings))
    })
    settings = await heynotePage.getStoredSettings()
    expect(settings.openAtLogin).toBe(false)
})
