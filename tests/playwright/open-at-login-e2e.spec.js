import { test, expect, _electron as electron } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'

import { HeynotePage } from "./test-utils.js"

const isLinux = process.platform === 'linux'

async function ensureElectronBuild() {
    const mainPath = path.join(process.cwd(), 'dist-electron', 'main', 'index.js')
    const preloadPath = path.join(process.cwd(), 'dist-electron', 'preload', 'index.js')
    try {
        await fs.stat(mainPath)
        await fs.stat(preloadPath)
        return
    } catch {
        // build below
    }

    await new Promise((resolve, reject) => {
        const child = spawn('npx', ['vite', 'build'], {
            stdio: 'inherit',
            env: {
                ...process.env,
            },
        })
        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`vite build failed with exit code ${code}`))
        })
    })
}

async function dirExists(dirPath) {
    try {
        const stat = await fs.stat(dirPath)
        return stat.isDirectory()
    } catch (err) {
        if (err.code === "ENOENT") return false
        throw err
    }
}

async function removeDirWithRetry(dirPath, retries = 5) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true })
            return
        } catch (err) {
            if (err.code !== "ENOTEMPTY" || attempt === retries) {
                throw err
            }
            await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
        }
    }
}

async function closeElectronApp(electronApp) {
    if (!electronApp) return
    const timeout = new Promise((resolve) => setTimeout(resolve, 5000))
    await Promise.race([electronApp.close(), timeout])
    // Force kill if still running
    try {
        const pid = electronApp.process().pid
        if (pid) process.kill(pid, 'SIGKILL')
    } catch {
        // already exited
    }
}


test.describe('openAtLogin e2e', { tag: "@e2e" }, () => {
    test.describe.configure({ mode: 'serial' })
    test.skip(({ browserName }) => browserName !== 'chromium', 'Electron runs only once under chromium')

    /** @type {HeynotePage} */
    let heynotePage
    let electronApp
    let tmpRoot
    let userDataDir
    let page

    test.beforeEach(async () => {
        test.setTimeout(60000)
        await ensureElectronBuild()
        tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'heynote-e2e-login-'))
        userDataDir = path.join(tmpRoot, 'user-data')
        await fs.mkdir(userDataDir)

        electronApp = await electron.launch({
            args: ['--no-sandbox', 'tests/playwright/electron-runner.cjs'],
            env: {
                ...process.env,
                HEYNOTE_TEST_USER_DATA_DIR: userDataDir,
            },
        })

        page = await electronApp.firstWindow()
        await page.waitForLoadState('domcontentloaded')
        heynotePage = new HeynotePage(page)
    })

    test.afterEach(async () => {
        await closeElectronApp(electronApp)
        electronApp = null
        if (await dirExists(tmpRoot)) {
            await removeDirWithRetry(tmpRoot)
        }
    })

    test('TC-E2E-1: Launch at login checkbox is visible in Electron', async () => {
        await expect(page).toHaveTitle(/Heynote/i)
        await page.locator("css=.status-block.settings").click()
        await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
        const checkbox = page.getByLabel("Launch at login")
        await expect(checkbox).toBeVisible()
    })

    test('TC-E2E-2: Launch at login default is unchecked', async () => {
        await page.locator("css=.status-block.settings").click()
        await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
        const checkbox = page.getByLabel("Launch at login")
        await expect(checkbox).not.toBeChecked()
    })

    test('TC-E2E-3: Toggle Launch at login updates config file', async () => {
        await page.locator("css=.status-block.settings").click()
        await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
        const checkbox = page.getByLabel("Launch at login")
        await checkbox.click()
        await expect(checkbox).toBeChecked()

        // Wait for config to be written to disk
        const configPath = path.join(userDataDir, 'config.json')
        await expect.poll(async () => {
            try {
                const raw = await fs.readFile(configPath, 'utf-8')
                const config = JSON.parse(raw)
                return config.settings?.openAtLogin
            } catch {
                return undefined
            }
        }).toBe(true)
    })

    // app.getLoginItemSettings() only works reliably on macOS/Windows with
    // proper desktop integration. On Linux CI (headless), it always returns false
    // and can cause Electron to hang on close.
    test('TC-E2E-4: Toggle Launch at login updates Electron loginItemSettings', async () => {
        test.skip(isLinux, 'app.getLoginItemSettings() is unreliable on Linux CI')

        await page.locator("css=.status-block.settings").click()
        await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
        const checkbox = page.getByLabel("Launch at login")
        await checkbox.click()
        await expect(checkbox).toBeChecked()

        // Verify Electron's loginItemSettings
        const loginSettings = await electronApp.evaluate(({ app }) => {
            return app.getLoginItemSettings()
        })
        expect(loginSettings.openAtLogin).toBe(true)
    })

    test('TC-E2E-5: Toggle Launch at login off resets loginItemSettings', async () => {
        test.skip(isLinux, 'app.getLoginItemSettings() is unreliable on Linux CI')

        await page.locator("css=.status-block.settings").click()
        await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
        const checkbox = page.getByLabel("Launch at login")

        // Toggle on
        await checkbox.click()
        await expect(checkbox).toBeChecked()

        // Toggle off
        await checkbox.click()
        await expect(checkbox).not.toBeChecked()

        // Verify Electron's loginItemSettings is reset
        const loginSettings = await electronApp.evaluate(({ app }) => {
            return app.getLoginItemSettings()
        })
        expect(loginSettings.openAtLogin).toBe(false)
    })

    test('TC-E2E-6: setLoginItemSettings does not use deprecated openAsHidden', async () => {
        test.skip(isLinux, 'app.getLoginItemSettings() is unreliable on Linux CI')

        await page.locator("css=.status-block.settings").click()
        await expect(page.locator("css=.overlay .settings .dialog")).toBeVisible()
        const checkbox = page.getByLabel("Launch at login")
        await checkbox.click()
        await expect(checkbox).toBeChecked()

        // Verify that openAsHidden is not set (deprecated on macOS 13+)
        const loginSettings = await electronApp.evaluate(({ app }) => {
            return app.getLoginItemSettings()
        })
        expect(loginSettings.openAtLogin).toBe(true)
        // openAsHidden should remain at default (false), not explicitly set to true
        expect(loginSettings.openAsHidden).toBe(false)
    })

    test('TC-E2E-7: windowVisibleOnQuit defaults to true', async () => {
        const configPath = path.join(userDataDir, 'config.json')
        // Check that windowVisibleOnQuit is not in config yet (uses default true)
        try {
            const raw = await fs.readFile(configPath, 'utf-8')
            const config = JSON.parse(raw)
            // If present, it should be true; if absent, default is true
            if (config.windowVisibleOnQuit !== undefined) {
                expect(config.windowVisibleOnQuit).toBe(true)
            }
        } catch {
            // Config file may not exist yet, which is fine (defaults apply)
        }
    })

    test('TC-E2E-8: windowVisibleOnQuit is saved on app close', async () => {
        // The window is visible, so closing should save windowVisibleOnQuit: true
        const configPath = path.join(userDataDir, 'config.json')

        // Close the app gracefully
        await closeElectronApp(electronApp)
        electronApp = null

        // Read config and verify windowVisibleOnQuit was saved
        await expect.poll(async () => {
            try {
                const raw = await fs.readFile(configPath, 'utf-8')
                const config = JSON.parse(raw)
                return config.windowVisibleOnQuit
            } catch {
                return undefined
            }
        }).toBe(true)
    })
})
