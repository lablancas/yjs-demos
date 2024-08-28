/* eslint-env browser */

import * as Y from 'yjs'
import { ySyncPlugin, ySyncPluginKey, yUndoPlugin, undo, redo } from 'y-prosemirror'
import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { schema } from './schema.js'
import { exampleSetup } from 'prosemirror-example-setup'
import { keymap } from 'prosemirror-keymap'
import * as random from 'lib0/random.js'
import { html, render } from 'lit-html'
import * as dom from 'lib0/dom.js'
import * as pair from 'lib0/pair.js'

/**
 * @typedef {Object} Version
 * @property {number} date
 * @property {Uint8Array} snapshot
 * @property {number} clientID
 */

/**
 * @param {Y.Doc} doc
 */
const addVersion = doc => {
  const versions = doc.getArray('versions')
  const prevVersion = versions.length === 0 ? null : versions.get(versions.length - 1)
  const prevSnapshot = prevVersion === null ? Y.emptySnapshot : Y.decodeSnapshot(prevVersion.snapshot)
  const snapshot = Y.snapshot(doc)
  if (prevVersion != null) {
    // account for the action of adding a version to ydoc
    prevSnapshot.sv.set(prevVersion.clientID, /** @type {number} */ (prevSnapshot.sv.get(prevVersion.clientID)) + 1)
  }
  if (!Y.equalSnapshots(prevSnapshot, snapshot)) {
    versions.push([{
      date: new Date().getTime(),
      snapshot: Y.encodeSnapshot(snapshot),
      clientID: doc.clientID
    }])
  }
}

const renderVersion = (editorview, version, prevSnapshot) => {
  editorview.dispatch(editorview.state.tr.setMeta(ySyncPluginKey, { snapshot: Y.decodeSnapshot(version.snapshot), prevSnapshot: prevSnapshot == null ? Y.emptySnapshot : Y.decodeSnapshot(prevSnapshot) }))
}

const unrenderVersion = editorview => {
  const binding = ySyncPluginKey.getState(editorview.state).binding
  if (binding != null) {
    binding.unrenderSnapshot()
  }
}

/**
 * @param {EditorView} editorview
 * @param {Version} version
 * @param {Version|null} prevSnapshot
 */
const versionTemplate = (editorview, version, prevSnapshot) => html`<div class="version-list" @click=${() => renderVersion(editorview, version, prevSnapshot)}>${new Date(version.date).toLocaleString()}</div>`

const versionList = (editorview, doc) => {
  const versions = doc.getArray('versions')
  return html`<div>${versions.length > 0 ? versions.map((version, i) => versionTemplate(editorview, version, i > 0 ? versions.get(i - 1).snapshot : null)) : html`<div>No snapshots..</div>`}</div>`
}

const snapshotButton = doc => {
  return html`<button @click=${() => addVersion(doc)}>Snapshot</button>`
}

/**
 * @param {HTMLElement} parent
 * @param {Y.Doc} doc
 * @param {EditorView} editorview
 */
export const attachVersion = (parent, doc, editorview) => {
  let open = false
  const rerender = () => {
    render(html`<div class="version-modal" ?hidden=${open}>${snapshotButton(doc)}${versionList(editorview, doc)}</div>`, vContainer)
  }
  const btn = document.createElement('button')
  btn.setAttribute('type', 'button')
  btn.textContent = 'Versions'
  btn.addEventListener('click', () => {
    open = !open
    unrenderVersion(editorview)
    rerender()
  })
  const vContainer = document.createElement('div')
  parent.insertBefore(btn, null)
  parent.insertBefore(vContainer, null)
  doc.getArray('versions').observe(rerender)
  rerender()
}

const testUsers = [
  { username: 'Alice', color: '#ecd444', lightColor: '#ecd44433' },
  { username: 'Bob', color: '#ee6352', lightColor: '#ee635233' },
  { username: 'Max', color: '#6eeb83', lightColor: '#6eeb8333' }
]

const colors = [
  { light: '#ecd44433', dark: '#ecd444' },
  { light: '#ee635233', dark: '#ee6352' },
  { light: '#6eeb8333', dark: '#6eeb83' }
]

const user = random.oneOf(testUsers)

window.addEventListener('load', () => {
  const ydoc = new Y.Doc()
  const permanentUserData = new Y.PermanentUserData(ydoc)
  permanentUserData.setUserMapping(ydoc, ydoc.clientID, user.username)
  ydoc.gc = false
  const yXmlFragment = ydoc.get('prosemirror', Y.XmlFragment)

  const editor = document.createElement('div')
  editor.setAttribute('id', 'editor')
  const editorContainer = document.createElement('div')
  editorContainer.insertBefore(editor, null)
  const prosemirrorView = new EditorView(editor, {
    state: EditorState.create({
      schema,
      plugins: [
        ySyncPlugin(yXmlFragment, { permanentUserData, colors }),
        yUndoPlugin(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo
        })
      ].concat(exampleSetup({ schema }))
    })
  })
  document.body.insertBefore(editorContainer, null)

  attachVersion(document.getElementById('y-version'), ydoc, prosemirrorView)

  // @ts-ignore
  window.example = { ydoc, yXmlFragment, prosemirrorView }
})
