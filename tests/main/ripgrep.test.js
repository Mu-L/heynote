import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { startLibrarySearch } from "../../electron/main/ripgrep.js"

const makeTempDir = () =>
    fs.mkdtempSync(path.join(os.tmpdir(), "heynote-ripgrep-"))

function runLibrarySearch(basePath, options) {
    const events = []
    return new Promise((resolve, reject) => {
        startLibrarySearch({ basePath }, options, (payload) => {
            events.push(payload)
            if (payload.type === "error") {
                reject(new Error(payload.message))
            } else if (payload.type === "done") {
                resolve(events)
            }
        })
    })
}

describe("startLibrarySearch", () => {
    let tmpDir = ""

    beforeEach(() => {
        tmpDir = makeTempDir()
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it("streams fixed-string JSON matches grouped by note file", async () => {
        await fs.promises.mkdir(path.join(tmpDir, "subdir"))
        await fs.promises.mkdir(path.join(tmpDir, ".images"))
        await fs.promises.writeFile(
            path.join(tmpDir, "scratch.txt"),
            "Needle one\naxb should not match\nliteral a.b\n",
            "utf8"
        )
        await fs.promises.writeFile(
            path.join(tmpDir, "subdir", "note.txt"),
            "second needle\n",
            "utf8"
        )
        await fs.promises.writeFile(
            path.join(tmpDir, ".images", "ignored.txt"),
            "needle in hidden image dir\n",
            "utf8"
        )

        const events = await runLibrarySearch(tmpDir, {
            searchId: 123,
            query: "needle",
            caseSensitive: false,
            wholeWord: false,
        })
        const matches = events.filter((event) => event.type === "match")

        expect(matches).toHaveLength(2)
        expect(matches).toEqual(expect.arrayContaining([
            expect.objectContaining({
                searchId: 123,
                buffer: "scratch.txt",
                line: "Needle one",
                lineNumber: 1,
            }),
            expect.objectContaining({
                searchId: 123,
                buffer: path.join("subdir", "note.txt"),
                line: "second needle",
                lineNumber: 1,
            }),
        ]))
    })

    it("uses fixed-string matching instead of regex matching", async () => {
        await fs.promises.writeFile(
            path.join(tmpDir, "scratch.txt"),
            "literal a.b\nregex-looking axb\n",
            "utf8"
        )

        const events = await runLibrarySearch(tmpDir, {
            searchId: 456,
            query: "a.b",
            caseSensitive: true,
            wholeWord: false,
        })
        const matches = events.filter((event) => event.type === "match")

        expect(matches).toHaveLength(1)
        expect(matches[0]).toMatchObject({
            buffer: "scratch.txt",
            line: "literal a.b",
            lineNumber: 1,
        })
    })

    it("reports submatch offsets as JavaScript string indexes", async () => {
        const line = "🙂🙂 foobar 🙂 foo"
        await fs.promises.writeFile(
            path.join(tmpDir, "scratch.txt"),
            line + "\n",
            "utf8"
        )

        const events = await runLibrarySearch(tmpDir, {
            searchId: 789,
            query: "foo",
            caseSensitive: true,
            wholeWord: true,
        })
        const matches = events.filter((event) => event.type === "match")

        expect(matches).toHaveLength(1)
        expect(matches[0].submatches).toHaveLength(1)
        const [submatch] = matches[0].submatches
        expect(line.slice(submatch.start, submatch.end)).toBe("foo")
        expect(submatch.start).toBe(line.lastIndexOf("foo"))
    })
})
