"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkItemConflict = checkItemConflict;
exports.mergeConflictingNotes = mergeConflictingNotes;
/**
 * Checks whether an incoming client mutation conflicts with the current server item.
 */
function checkItemConflict(clientItem, baseVersion, currentServerItem) {
    if (!currentServerItem) {
        // New item creation, no conflict possible on creation
        return null;
    }
    // If baseVersion is lower than server version, concurrent edits occurred
    if (baseVersion < currentServerItem.version) {
        // Check if the contents are actually different
        const contentDiffers = (clientItem.contentHtml || '') !== (currentServerItem.contentHtml || '');
        const titleDiffers = clientItem.title !== currentServerItem.title;
        const parentDiffers = clientItem.parentId !== currentServerItem.parentId;
        const deleteDiffers = clientItem.isDeleted !== currentServerItem.isDeleted;
        if (contentDiffers || titleDiffers || parentDiffers || deleteDiffers) {
            return {
                itemId: clientItem.id,
                clientItem,
                serverItem: currentServerItem,
                conflictType: 'concurrent_edit'
            };
        }
    }
    return null;
}
/**
 * Merges two conflicting notes by combining content with clear branch labels.
 */
function mergeConflictingNotes(localNote, remoteNote) {
    const mergedTitle = localNote.title !== remoteNote.title
        ? `${localNote.title} (Merged)`
        : localNote.title;
    const localTime = new Date(localNote.updatedAt).toLocaleString();
    const remoteTime = new Date(remoteNote.updatedAt).toLocaleString();
    const mergedHtml = `
<div class="merged-document">
  <div class="merge-section local-branch">
    <div class="merge-header"><strong>[Your Device Version — ${localTime}]</strong></div>
    ${localNote.contentHtml || ''}
  </div>
  <hr class="merge-divider" style="margin: 24px 0; border: 1px dashed #b9f32a;" />
  <div class="merge-section remote-branch">
    <div class="merge-header"><strong>[Cloud / Other Device Version — ${remoteTime}]</strong></div>
    ${remoteNote.contentHtml || ''}
  </div>
</div>
  `.trim();
    // Combine unique asset references
    const assetSet = new Set([...localNote.assetIds, ...remoteNote.assetIds]);
    return {
        ...localNote,
        title: mergedTitle,
        contentHtml: mergedHtml,
        plainText: (localNote.plainText || '') + '\n\n' + (remoteNote.plainText || ''),
        assetIds: Array.from(assetSet),
        updatedAt: Date.now(),
        version: Math.max(localNote.version, remoteNote.version) + 1
    };
}
