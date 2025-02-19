<!-- @migration-task Error while migrating Svelte code: $$props is used together with named props in a way that cannot be automatically migrated. -->
<script>
    export let name;
    export let width = "24px";
    export let height = "24px";
    export let focusable = "false";
    let icons = [
        {
            box: 24,
            name: "floppy-save",
            svg: `<g stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></g>`
        },
        {
            box: 24,
            name: "delete",
            svg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />`
        },
        {
            box: 24,
            name: "edit",
            svg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />`
        },
        {
            box: 24,
            name: "save",
            svg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />`
        },
        {
            box: 32,
            name: "trash",
            svg: `<path d="M12 12h2v12h-2z" /><path d="M18 12h2v12h-2z" /><path d="M4 6v2h2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8h2V6zm4 22V8h16v20z" /><path d="M12 2h8v2h-8z" />`
        },
        {
            box: 24,
            name: "dropdown-arrow",
            svg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />`
        },
        {
            box: 24,
            name: "user",
            svg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />`
        }
    ];
    let displayIcon = icons.find((e) => e.name === name);
</script>
<svg
    class={$$props.class}
    {focusable}
    width={width}
    height={height}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 {displayIcon.box} {displayIcon.box}">{@html displayIcon.svg}</svg>