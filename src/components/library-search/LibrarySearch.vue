<script>
    import { mapState, mapStores, mapWritableState } from "pinia"

    import { useSearchStore } from '@/src/stores/search-store';
    import { useHeynoteStore } from "@/src/stores/heynote-store";
    import InputToggle from '@/src/editor/search/InputToggle.vue';
    import SearchResult from "./SearchResult.vue";

    export default {
        components: {
            InputToggle,
            SearchResult,
        },

        data() {
            return {
                query: "",
            }
        },

        mounted() {
            this.searchStore.initializeSearchListeners()
            this.query = this.searchStore.query
            this.$refs.input.focus()
        },

        beforeUnmount() {
            this.searchStore.cancelActiveSearch()
        },

        watch: {
            query() {
                this.search()
            },
            caseSensitive() {
                this.search()
            },
            wholeWord() {
                this.search()
            },
        },

        computed: {
            ...mapStores(useSearchStore, useHeynoteStore),
            ...mapState(useSearchStore, [
                "results",
            ]),
            ...mapWritableState(useSearchStore, [
                "caseSensitive",
                "wholeWord",
                "regexp",
            ]),

            hasSearchQuery() {
                return this.query.trim().length > 2
            },

            resultCount() {
                return this.results.reduce((count, result) => count + result.matches.length, 0)
            },

            bufferCount() {
                return this.results.length
            },
        },

        methods: {
            search() {
                this.searchStore.search(this.query)
            },

            focusEditor() {
                this.heynoteStore.currentLeftPanel = "buffer-tree"
                this.heynoteStore.focusEditor()
            },
        },
    }
</script>

<template>
    <div class="search-container">
        <header class="header">
            <div class="input-container">
                <input
                    type="text"
                    v-model="query"
                    ref="input"
                    placeholder="Find…"
                    class="search-query"
                    main-field
                    @keydown.esc.prevent.stop="focusEditor"
                />
                <div class="input-buttons">
                    <InputToggle 
                        v-model="caseSensitive" 
                        type="case-sensitive"
                    />
                    <InputToggle 
                        v-model="wholeWord" 
                        type="whole-words"
                    />
                    <InputToggle 
                        v-model="regexp" 
                        type="regex"
                        :disabled="true"
                    />
                </div>
            </div>
            <div v-if="hasSearchQuery" class="result-summary">
                <b>{{ resultCount }}</b> results in <b>{{ bufferCount }}</b> buffers
            </div>
        </header>
        <div class="results">
            <SearchResult
                v-for="result in results"
                :key="result.buffer"
                :result="result"
                :query="query"
                :caseSensitive="caseSensitive"
            />
        </div>
    </div>
</template>

<style lang="sass" scoped>
    .search-container
        --search-indent-guide-opacity: 0
        font-size: 13px
        padding: 0px
        padding-top: 4px
        display: flex
        flex-direction: column
        height: 100%
        &:hover
            --search-indent-guide-opacity: 1

        .header
            padding: 0 8px 0 10px
            .result-summary
                margin-top: 8px
                padding: 0 1px
                font-size: 12px
                line-height: 16px
                color: rgba(0,0,0, 0.55)
                +dark-mode
                    color: rgba(255,255,255, 0.55)
                b
                    color: rgba(0,0,0, 0.8)
                    +dark-mode
                        color: rgba(255,255,255, 0.8)
            .input-container
                position: relative
                flex-grow: 1

                input[type="text"]
                    background: #fff
                    padding: 6px 5px
                    border: 1px solid #ccc
                    box-sizing: border-box
                    border-radius: 3px
                    width: 100%
                    padding-right: 74px
                    &:focus
                        outline: none
                        border: 1px solid #fff
                        outline: 2px solid #48b57e
                        border-radius: 2px
                    &::placeholder
                        color: rgba(0,0,0, 0.6)
                    +dark-mode
                        background: #3b3b3b
                        color: rgba(255,255,255, 0.9)
                        border: 1px solid #4c4c4c
                        &:focus
                            border: 1px solid #3b3b3b
                        &::placeholder
                            color: rgba(255,255,255, 0.6)
                    +webapp-mobile
                        font-size: 16px
                        max-width: 100%
                
                .input-buttons
                    position: absolute
                    top: 0
                    right: 2px
                    bottom: 0
                    display: flex
                    align-items: center
        
        .results
            padding-top: 12px
            overflow-y: scroll
            height: 100%

    :global(.left-panel:hover) .search-container
        --search-indent-guide-opacity: 1
</style>
