import { expect, test } from "@playwright/test"
import { HeynotePage } from "./test-utils.js"

function createBufferContent(name, content = "") {
    return JSON.stringify({
        formatVersion: "2.0.0",
        name,
    }) + `\n∞∞∞text-a;created=2026-01-01T00:00:00.000Z\n${content}`
}

function installLibraryState() {
    const settings = {
        showLeftPanel: true,
        leftPanelWidth: 260,
    }
    const notes = {
        "scratch.txt": createBufferContent("Scratch", [
            "first needle match",
            "second needle match",
            "short non-match",
        ].join("\n")),
        "folder-a/project.txt": createBufferContent("Project Note", [
            "emoji context 🙂🙂🙂 and a long prefix before the important needle match",
            "another non-match",
        ].join("\n")),
        "folder-a/other.txt": createBufferContent("Other Note", "nothing to find here"),
    }
    return { settings, notes }
}

test.describe("library search", () => {
    test.beforeEach(async ({ page }) => {
        const state = installLibraryState()
        await page.addInitScript((seed) => {
            localStorage.clear()
            localStorage.setItem("settings", JSON.stringify(seed.settings))
            for (const [path, content] of Object.entries(seed.notes)) {
                localStorage.setItem(`heynote-library__${path}`, content)
            }
        }, state)

        const heynotePage = new HeynotePage(page)
        await heynotePage.goto()
        await page.getByRole("button", { name: "Search" }).click()
        await expect(page.locator(".search-container")).toBeVisible()
    })

    test("shows grouped results, counts, highlighting, and preview context", async ({ page }) => {
        await page.locator(".search-container input.search-query").fill("needle")

        await expect(page.locator(".result-summary")).toContainText("3 results in 2 buffers")
        await expect(page.locator(".result-container")).toHaveCount(2)
        await expect(page.locator(".result-container .buffer", { hasText: "Scratch" })).toBeVisible()
        await expect(page.locator(".result-container .buffer", { hasText: "Project Note" })).toBeVisible()

        await expect(page.locator(".result-container .match")).toHaveCount(3)
        await expect(page.locator(".result-container .match strong", { hasText: "needle" })).toHaveCount(3)

        const longMatchText = page.locator(".result-container .match", { hasText: "important" })
        await expect(longMatchText).toContainText("...g prefix before the important needle match")
        await expect(longMatchText.locator("strong")).toHaveText("needle")
    })

    test("collapses and expands matches for a buffer", async ({ page }) => {
        await page.locator(".search-container input.search-query").fill("needle")
        const scratchResult = page.locator(".result-container", { hasText: "Scratch" })

        await expect(scratchResult.locator(".match")).toHaveCount(2)
        await scratchResult.locator(".buffer").click()
        await expect(scratchResult.locator(".match")).toHaveCount(0)
        await scratchResult.locator(".buffer").click()
        await expect(scratchResult.locator(".match")).toHaveCount(2)
    })

    test("hides result summary and rows when the query is cleared", async ({ page }) => {
        const input = page.locator(".search-container input.search-query")
        await input.fill("needle")
        await expect(page.locator(".result-summary")).toBeVisible()

        await input.fill("")
        await expect(page.locator(".result-summary")).toHaveCount(0)
        await expect(page.locator(".result-container")).toHaveCount(0)
    })

    test("focuses the editor and switches to the Buffers tab when Escape is pressed in the search input", async ({ page }) => {
        const input = page.locator(".search-container input.search-query")
        await input.fill("needle")
        await expect(input).toBeFocused()

        await input.press("Escape")
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)
        await expect(page.locator(".buffer-tree")).toBeVisible()
        await expect(page.getByRole("button", { name: "Buffers" })).toHaveClass(/selected/)
    })

    test("opens the search tab and left panel with the default keyboard shortcut", async ({ page }) => {
        await page.locator(".status .status-block.sidebar").click()
        await expect(page.locator(".left-panel")).toHaveCount(0)
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)

        await page.locator("body").press("ControlOrMeta+Shift+F")

        await expect(page.locator(".left-panel")).toBeVisible()
        await expect(page.locator(".search-container")).toBeVisible()
        await expect(page.getByRole("button", { name: "Search" })).toHaveClass(/selected/)
        await expect(page.locator(".search-container input.search-query")).toBeFocused()
    })

    test("hides the sidebar on Escape when library search was opened from a hidden sidebar", async ({ page }) => {
        await page.locator(".status .status-block.sidebar").click()
        await expect(page.locator(".left-panel")).toHaveCount(0)

        await page.locator("body").press("ControlOrMeta+Shift+F")
        const input = page.locator(".search-container input.search-query")
        await expect(input).toBeFocused()

        await input.press("Escape")
        await expect(page.locator(".left-panel")).toHaveCount(0)
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)
    })

    test("keeps the sidebar visible on Escape after switching away from library search", async ({ page }) => {
        await page.locator(".status .status-block.sidebar").click()
        await expect(page.locator(".left-panel")).toHaveCount(0)

        await page.locator("body").press("ControlOrMeta+Shift+F")
        await expect(page.locator(".search-container input.search-query")).toBeFocused()

        await page.getByRole("button", { name: "Buffers" }).click()
        await expect(page.locator(".buffer-tree")).toBeVisible()

        await page.getByRole("button", { name: "Search" }).click()
        const input = page.locator(".search-container input.search-query")
        await expect(input).toBeFocused()

        await input.press("Escape")
        await expect(page.locator(".left-panel")).toBeVisible()
        await expect(page.locator(".buffer-tree")).toBeVisible()
        await expect(page.getByRole("button", { name: "Buffers" })).toHaveClass(/selected/)
        await expect(page.locator(".cm-editor")).toHaveClass(/cm-focused/)
    })

    test("shows indentation guides when the sidebar is hovered", async ({ page }) => {
        await page.locator(".search-container input.search-query").fill("needle")

        const guide = page.locator(".result-container .match .indent-guide").first()
        await expect(guide).toHaveCount(1)

        await page.mouse.move(500, 200)
        await expect.poll(async () => {
            return await guide.evaluate((element) => window.getComputedStyle(element).opacity)
        }).toBe("0")

        await page.locator(".left-panel").hover()
        await expect.poll(async () => {
            return await guide.evaluate((element) => window.getComputedStyle(element).opacity)
        }).toBe("1")
    })
})
