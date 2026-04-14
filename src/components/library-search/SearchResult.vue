<script>
    import { mapStores } from "pinia"

    import { useHeynoteStore } from "@/src/stores/heynote-store"

    export default {
        props: ["result"],

        computed: {
            ...mapStores(useHeynoteStore),

            bufferName() {
                const buffer = this.heynoteStore.buffers[this.result.buffer]
                return buffer ? buffer.name : this.result.buffer
            },
        }
    }
</script>

<template>
    <div class="result-container">
        <div class="buffer">{{ bufferName }}</div>
        <div class="matches">
            <div class="match" v-for="match in result.matches">
                {{ match.line }}
            </div>
        </div>
    </div>
</template>

<style lang="sass" scoped>
    .result-container
        color: rgba(0,0,0, 0.7)
        +dark-mode
            color: rgba(255,255,255, 0.7)
        .buffer
            cursor: pointer
            padding: 5px 10px
            &:hover
                background: rgba(255,255,255, 0.1)
        .matches 
            .match
                cursor: pointer
                padding: 5px 20px
                //font-family: "Hack",
                &:hover
                    background: rgba(255,255,255, 0.1)
</style>
