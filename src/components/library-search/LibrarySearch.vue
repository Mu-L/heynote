<script>
    import { mapState, mapStores, mapWritableState } from "pinia"

    import { useSearchStore } from '@/src/stores/search-store';
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
            this.query = this.searchStore.query
            this.$refs.input.focus()
        },

        computed: {
            ...mapStores(useSearchStore),
            ...mapState(useSearchStore, [
                "results",
            ]),
            ...mapWritableState(useSearchStore, [
                "caseSensitive",
                "wholeWord",
                "regexp",
            ]),
        },

        methods: {
            search() {
                console.log("searching for:", this.query)
                this.searchStore.search(this.query)
            },

            onToggleClick() {
                this.search()
            },

            onQueryKeyUp() {
                if (this.query.length >= 2) {
                    this.search()
                }
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
                    @keyup="onQueryKeyUp"
                    placeholder="Find…"
                    class="search-query"
                    main-field
                />
                <div class="input-buttons">
                    <InputToggle 
                        v-model="caseSensitive" 
                        type="case-sensitive"
                        @click="onToggleClick"
                    />
                    <InputToggle 
                        v-model="wholeWord" 
                        type="whole-words"
                        @click="onToggleClick"
                    />
                    <InputToggle 
                        v-model="regexp" 
                        type="regex"
                        @click="onToggleClick"
                    />
                </div>
            </div>
        </header>
        <div class="results">
            <SearchResult
                v-for="result in results"
                :result="result"
            />
        </div>
    </div>
</template>

<style lang="sass" scoped>
    .search-container
        font-size: 13px
        padding: 4px 0px

        .header
            padding: 0 8px 0 10px
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
</style>
