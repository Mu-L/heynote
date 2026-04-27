import { defineStore } from 'pinia'

export const useSearchStore = defineStore("search", {
    state: () => ({
        results: [],
        query: "",
        caseSensitive: true,
        wholeWord: false,
        regexp: false,
    }),

    actions: {
        search(query) {
            this.query = query
            this.results = [
                {
                    buffer: "scratch.txt",
                    matches: [
                        {line: "testing: " + query},
                        {line: "another: " + query},
                    ],
                },
                {
                    buffer: "subdir/another.txt",
                    matches: [
                        {line: "tesssst: " + query},
                    ],
                },
            ]
        },
    },
})
