<script lang="ts">
	import { _ } from 'svelte-i18n';
</script>

<div class="flex items-center flex-col sm:flex-row">
	<input type="checkbox" id="hotkeys-modal" class="modal-toggle" />
	<div class="modal">
		<div class="modal-box" style="max-width: 46rem">
			<label for="hotkeys-modal" class="btn btn-sm btn-circle absolute right-2 top-2">✕</label>
			<h3 class="font-bold text-lg">{$_('editor.hotkeys.heading')}</h3>
			<div class="overflow-x-auto w-full">
				<table class="table w-full">
					<tbody>
						<tr>
							<td>
								{$_('editor.hotkeys.playPause')}
							</td>
							<td><kbd class="kbd kbd-md">Tab</kbd></td>
						</tr>
                        <tr>
							<td>
								{$_('editor.hotkeys.rewind')}
							<td><kbd class="kbd kbd-md">Shift</kbd>
                            +
                            <kbd class="kbd kbd-md">Tab</kbd>
                            </td>
						</tr>
                        <tr>
							<td>
								{$_('editor.hotkeys.skipForward')}
							</td>
							<td><kbd class="kbd kbd-md">Alt</kbd>
                            +
                            <kbd class="kbd kbd-md">Tab</kbd></td>
						</tr>
                        <tr>
							<td>
								{$_('file.toolbarUndo')}
							</td>
							<td><kbd class="kbd kbd-md">Control</kbd>
                            +
                            <kbd class="kbd kbd-md">Z</kbd></td>
						</tr>
                        <tr>
							<td>
								{$_('file.toolbarRedo')}
							</td>
							<td><kbd class="kbd kbd-md">Control</kbd>
                            +
                            <kbd class="kbd kbd-md">Y</kbd></td>
						</tr>
                        <tr>
							<td>
								{$_('editor.hotkeys.splitParagraph')}
							</td>
							<td><kbd class="kbd kbd-md">Enter</kbd></td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
