<script lang="ts">
	import { _ } from 'svelte-i18n';

	interface Props {
		fileId: string;
		filename: string;
		/** Rendered inside a table drawer row rather than a card; smaller tap targets. */
		compact?: boolean;
	}

	let { fileId, filename, compact = false }: Props = $props();

	// Two groups: documents you read, and files another tool reads.
	const documentFormats = [
		{ id: 'docx', label: 'DOCX' },
		{ id: 'odt', label: 'ODT' },
		{ id: 'txt', label: 'TXT' }
	];
	const dataFormats = [
		{ id: 'srt', label: 'SRT' },
		{ id: 'trs', label: 'TRS' },
		{ id: 'json', label: 'JSON' }
	];

	const href = (format: string) => `/api/files/${fileId}/export?format=${format}`;
</script>

<div
	class="flex flex-wrap items-center gap-x-3 gap-y-2 {compact ? 'py-1.5' : 'py-2.5'}"
	role="group"
	aria-label={$_('files.formatLabel')}
>
	<span class="text-[11px] font-semibold uppercase tracking-[0.09em] text-base-content/45">
		{$_('files.formatLabel')}
	</span>
	<div class="flex flex-wrap items-center gap-2">
		{#each documentFormats as format (format.id)}
			<a
				class="format-chip"
				class:compact
				href={href(format.id)}
				download
				title="{$_(`files.formats.${format.id}`)} — {filename}"
				aria-label="{$_(`files.formats.${format.id}`)} — {filename}"
				onclick={(e) => e.stopPropagation()}
			>
				{format.label}
			</a>
		{/each}
		<span class="mx-0.5 h-5 w-px shrink-0 bg-base-300" aria-hidden="true"></span>
		{#each dataFormats as format (format.id)}
			<a
				class="format-chip"
				class:compact
				href={href(format.id)}
				download
				title="{$_(`files.formats.${format.id}`)} — {filename}"
				aria-label="{$_(`files.formats.${format.id}`)} — {filename}"
				onclick={(e) => e.stopPropagation()}
			>
				{format.label}
			</a>
		{/each}
	</div>
</div>

<style>
	.format-chip {
		display: inline-flex;
		align-items: center;
		min-height: 2.5rem;
		padding: 0 0.75rem;
		border: 1px solid var(--color-base-300, #d4d4d8);
		border-radius: 0.375rem;
		background-color: var(--color-base-100, #fff);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		font-variant-numeric: tabular-nums;
		color: var(--color-base-content, #1b1b1f);
		text-decoration: none;
		transition:
			border-color 120ms ease,
			color 120ms ease,
			background-color 120ms ease;
	}

	.format-chip.compact {
		min-height: 2rem;
		padding: 0 0.6rem;
	}

	.format-chip:hover {
		border-color: var(--color-primary, #45aeee);
		color: var(--color-primary, #45aeee);
	}

	.format-chip:focus-visible {
		outline: 2px solid var(--color-primary, #45aeee);
		outline-offset: 2px;
	}

	.format-chip:active {
		background-color: var(--color-base-200, #f4f4f5);
	}

	@media (prefers-reduced-motion: reduce) {
		.format-chip {
			transition: none;
		}
	}
</style>
