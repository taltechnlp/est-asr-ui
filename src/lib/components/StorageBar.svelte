<script lang="ts">
    import { _ } from 'svelte-i18n';

    interface Props {
        used: string;
        limit: string;
        remaining: string;
        usedPercent: number;
    }

    let { used, limit, remaining, usedPercent }: Props = $props();

    function formatBytes(bytes: string): string {
        const b = BigInt(bytes);
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = Number(b);
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        return `${value.toFixed(unitIndex > 1 ? 2 : 0)} ${units[unitIndex]}`;
    }

    const badgeClass = $derived(
        usedPercent > 90
            ? 'badge-error'
            : usedPercent > 70
              ? 'badge-warning'
              : 'badge-ghost'
    );
</script>

<div class="flex items-center gap-3 text-sm">
    <span class="text-base-content/60">{$_('files.storageUsed')}:</span>
    <div class="flex items-center gap-2">
        <progress
            class="progress progress-primary w-32 h-2"
            value={usedPercent}
            max="100"
        ></progress>
        <span class="badge {badgeClass} badge-sm">{formatBytes(used)} / {formatBytes(limit)}</span>
        <div class="tooltip tooltip-bottom" data-tip={$_('files.storageLimitInfo')}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 stroke-current text-base-content/50 cursor-help">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        </div>
    </div>
</div>
