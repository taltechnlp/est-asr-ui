<script lang="ts">
	import { _ } from 'svelte-i18n';
	let { fontSize = $bindable() } = $props();
	const handleFontSizeChange = (e) => {
		if (e.target.value) {
			localStorage.setItem("fontSize", e.target.value)
		}
	}
</script>

<div class="flex items-center flex-col sm:flex-row">
	<input type="checkbox" id="settings-modal" class="modal-toggle" />
	<div class="modal">
		<div class="modal-box" style="max-width: 52rem">
			<label for="settings-modal" class="btn btn-sm btn-circle absolute right-2 top-2">✕</label>
			<h3 class="font-bold text-lg">{$_('editor.settings.heading')}</h3>
			<div class="overflow-x-auto w-full">
				<table class="table w-full">
					<tbody>
						<tr>
							<td>{$_('editor.settings.fontSize')}</td>
							<td class="grid-container">
							  <input
								type="range"
								min="10"
								max="22"
								class="range pl-2"
								step="2"
								onchange={handleFontSizeChange}
								bind:value={fontSize}
							  />
							  <span class="w-full flex justify-between text-xs px-4">
								<span class="w-1 tex">XXS</span>
								<span class="w-1">XS</span>
								<span class="w-1">S</span>
								<span class="w-1">M</span>
								<span class="w-1">L</span>
								<span class="w-1">XL</span>
								<span class="w-1">XXL</span>
							  </span>
							</td>
						  </tr>
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>

<style>
	td.grid-container {
	  display: grid;
	  grid-template-rows: auto auto; /* Adjust as needed */
	  gap: 0.5rem; /* Optional: Add some spacing */
	}
  
	td.grid-container > input {
	  /* Style the range input */
	}
  
	td.grid-container > span {
	  /* Style the labels */
	}
</style>