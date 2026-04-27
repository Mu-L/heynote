import { defineStore } from 'pinia'
import {
    LIBRARY_SEARCH_CANCEL,
    LIBRARY_SEARCH_DONE,
    LIBRARY_SEARCH_ERROR,
    LIBRARY_SEARCH_MATCH,
    LIBRARY_SEARCH_START,
} from "@/src/common/constants"

export const useSearchStore = defineStore("search", {
    state: () => ({
        results: [],
        resultBufferIndex: {},
        query: "",
        caseSensitive: true,
        wholeWord: false,
        regexp: false,
        searching: false,
        error: null,
        searchId: 0,
        listenersInitialized: false,
        pendingMatches: [],
        flushScheduled: false,
    }),

    actions: {
        initializeSearchListeners() {
            if (this.listenersInitialized) {
                return
            }
            this.listenersInitialized = true
            window.heynote.mainProcess.on(LIBRARY_SEARCH_MATCH, (event, match) => {
                if (match.searchId !== this.searchId) {
                    return
                }
                this.queueMatch(match)
            })
            window.heynote.mainProcess.on(LIBRARY_SEARCH_DONE, (event, payload) => {
                if (payload.searchId !== this.searchId) {
                    return
                }
                this.flushPendingMatches()
                this.searching = false
            })
            window.heynote.mainProcess.on(LIBRARY_SEARCH_ERROR, (event, payload) => {
                if (payload.searchId !== this.searchId) {
                    return
                }
                this.flushPendingMatches()
                this.searching = false
                this.error = payload.message || "Search failed"
            })
        },

        // Queue streamed ripgrep matches and flush them at most once per frame so
        // large result sets do not trigger a Vue update for every single match.
        queueMatch(match) {
            this.pendingMatches.push(match)
            if (this.flushScheduled) {
                return
            }
            this.flushScheduled = true
            window.requestAnimationFrame(() => {
                this.flushScheduled = false
                this.flushPendingMatches()
            })
        },

        // Move queued matches into the rendered result tree, ignoring stale
        // matches from searches that have since been cancelled or replaced.
        flushPendingMatches() {
            if (this.pendingMatches.length === 0) {
                return
            }
            const matches = this.pendingMatches
            this.pendingMatches = []
            for (const match of matches) {
                if (match.searchId !== this.searchId) {
                    continue
                }
                this.addMatch(match)
            }
        },

        // Insert one match into the grouped result structure used by the tree UI.
        // Each buffer gets one top-level result item containing all its row matches.
        addMatch(match) {
            let resultIndex = this.resultBufferIndex[match.buffer]
            if (resultIndex === undefined) {
                resultIndex = this.results.length
                this.resultBufferIndex[match.buffer] = resultIndex
                this.results.push({
                    buffer: match.buffer,
                    matches: [],
                })
            }
            this.results[resultIndex].matches.push({
                line: match.line,
                lineNumber: match.lineNumber,
                submatches: match.submatches || [],
            })
        },

        search(query) {
            this.initializeSearchListeners()
            this.query = query
            this.searchId++
            this.results = []
            this.resultBufferIndex = {}
            this.pendingMatches = []
            this.error = null

            if (query.trim().length <= 2) {
                this.searching = false
                Promise.resolve(window.heynote.mainProcess.invoke(LIBRARY_SEARCH_CANCEL)).catch(() => {})
                return
            }

            const searchId = this.searchId
            this.searching = true
            Promise.resolve(window.heynote.mainProcess.invoke(LIBRARY_SEARCH_START, {
                searchId,
                query,
                caseSensitive: this.caseSensitive,
                wholeWord: this.wholeWord,
                regexp: false,
            })).catch((error) => {
                if (searchId !== this.searchId) {
                    return
                }
                this.searching = false
                this.error = error.message || "Search failed"
            })
        },

        cancelActiveSearch() {
            this.searchId++
            this.searching = false
            this.pendingMatches = []
            Promise.resolve(window.heynote.mainProcess.invoke(LIBRARY_SEARCH_CANCEL)).catch(() => {})
        },
    },
})
