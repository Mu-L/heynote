<script>
    import { mapState, mapActions } from 'pinia'

    import { mapWritableState, mapStores } from 'pinia'
    import { useHeynoteStore } from "../stores/heynote-store"
    import { useErrorStore } from "../stores/error-store"
    import { useSettingsStore } from "../stores/settings-store"
    import { useEditorCacheStore } from '../stores/editor-cache'

    import { OPEN_SETTINGS_EVENT, MOVE_BLOCK_EVENT, CHANGE_BUFFER_EVENT } from '@/src/common/constants'

    import StatusBar from './StatusBar.vue'
    import Editor from './Editor.vue'
    import LanguageSelector from './LanguageSelector.vue'
    import BufferSelector from './BufferSelector.vue'
    import Settings from './settings/Settings.vue'
    import ErrorMessages from './ErrorMessages.vue'
    import NewBuffer from './NewBuffer.vue'
    import EditBuffer from './EditBuffer.vue'

    export default {
        components: {
            Editor,
            StatusBar,
            LanguageSelector,
            Settings,
            BufferSelector,
            ErrorMessages,
            NewBuffer,
            EditBuffer,
        },

        data() {
            return {
                development: window.location.href.indexOf("dev=1") !== -1,
                showSettings: false,
                settings: window.heynote.settings,
            }
        },

        mounted() {
            this.settingsStore.setUp()
            
            window.heynote.mainProcess.on(OPEN_SETTINGS_EVENT, () => {
                this.showSettings = true
            })

            window.heynote.mainProcess.on(MOVE_BLOCK_EVENT, (path) => {
                this.openMoveToBufferSelector()
            })

            window.heynote.mainProcess.on(CHANGE_BUFFER_EVENT, () => {
                this.openBufferSelector()
            })
        },

        beforeUnmount() {
            this.settingsStore.tearDown()
        },

        watch: {
            // when a dialog is closed, we want to focus the editor
            showLanguageSelector(value) { this.dialogWatcher(value) },
            showBufferSelector(value) { this.dialogWatcher(value) },
            showCreateBuffer(value) { this.dialogWatcher(value) },
            showEditBuffer(value) { this.dialogWatcher(value) },
            showMoveToBufferSelector(value) { this.dialogWatcher(value) },
            showCommandPalette(value) { this.dialogWatcher(value) },

            currentBufferPath() {
                this.focusEditor()
            },

            currentBufferName() {
                window.heynote.setWindowTitle(this.currentBufferName)
            },
        },

        computed: {
            ...mapStores(useSettingsStore, useEditorCacheStore),
            ...mapState(useHeynoteStore, [
                "currentBufferPath",
                "currentBufferName",
                "showLanguageSelector",
                "showBufferSelector",
                "showCreateBuffer",
                "showEditBuffer",
                "showMoveToBufferSelector",
                "showCommandPalette",
            ]),

            dialogVisible() {
                return this.showLanguageSelector || this.showBufferSelector || this.showCreateBuffer || this.showEditBuffer || this.showMoveToBufferSelector || this.showCommandPalette || this.showSettings
            },

            editorInert() {
                return this.dialogVisible
            },
        },

        methods: {
            ...mapActions(useHeynoteStore, [
                "openLanguageSelector",
                "openBufferSelector",
                "openCreateBuffer",
                "closeDialog",
                "closeBufferSelector",
                "openBuffer",
                "closeMoveToBufferSelector",
            ]),

            // Used as a watcher for the booleans that control the visibility of editor dialogs. 
            // When a dialog is closed, we want to focus the editor
            dialogWatcher(value) {
                if (!value) {
                    this.focusEditor()
                }
            },

            focusEditor() {
                // we need to wait for the next tick for the cases when we set the inert attribute on the editor
                // in which case issuing a focus() call immediately would not work 
                this.$nextTick(() => {
                    this.$refs.editor.focus()
                })
            },

            openSettings() {
                this.showSettings = true
            },
            closeSettings() {
                this.showSettings = false
                this.focusEditor()
            },

            onSelectLanguage(language) {
                this.closeDialog()
                this.$refs.editor.setLanguage(language)
            },

            formatCurrentBlock() {
                this.$refs.editor.formatCurrentBlock()
            },

            onMoveCurrentBlockToOtherEditor(path) {
                this.editorCacheStore.moveCurrentBlockToOtherEditor(path)
                this.closeMoveToBufferSelector()
            },
        },
    }

</script>

<template>
    <div class="container">
        <Editor 
            :theme="settingsStore.theme"
            :development="development"
            :debugSyntaxTree="false"
            :inert="editorInert"
            class="editor"
            ref="editor"
        />
        <StatusBar 
            :autoUpdate="settings.autoUpdate"
            :allowBetaVersions="settings.allowBetaVersions"
            @openBufferSelector="openBufferSelector"
            @openLanguageSelector="openLanguageSelector"
            @formatCurrentBlock="formatCurrentBlock"
            @openSettings="showSettings = true"
            @click="() => {$refs.editor.focus()}"
            class="status" 
        />
        <div class="overlay">
            <LanguageSelector 
                v-if="showLanguageSelector" 
                @selectLanguage="onSelectLanguage"
                @close="closeDialog"
            />
            <BufferSelector 
                v-if="showBufferSelector || showCommandPalette" 
                :initialFilter="showCommandPalette ? '>' : ''"
                :commandsEnabled="true"
                @openBuffer="openBuffer"
                @openCreateBuffer="(nameSuggestion) => openCreateBuffer('new', nameSuggestion)"
                @close="closeBufferSelector"
            />
            <BufferSelector 
                v-if="showMoveToBufferSelector" 
                headline="Move block to..."
                :commandsEnabled="false"
                @openBuffer="onMoveCurrentBlockToOtherEditor"
                @openCreateBuffer="(nameSuggestion) => openCreateBuffer('currentBlock', nameSuggestion)"
                @close="closeMoveToBufferSelector"
            />
            <Settings 
                v-if="showSettings"
                :initialSettings="settingsStore.settings"
                :themeSetting="settingsStore.themeSetting"
                @closeSettings="closeSettings"
            />
            <NewBuffer 
                v-if="showCreateBuffer"
                @close="closeDialog"
            />
            <EditBuffer 
                v-if="showEditBuffer"
                @close="closeDialog"
            />
            <ErrorMessages />
        </div>
    </div>
</template>

<style scoped lang="sass">
    .container
        width: 100%
        height: 100%
        position: relative
        .editor
            height: calc(100% - 21px)
        .status
            position: absolute
            bottom: 0
            left: 0
</style>
