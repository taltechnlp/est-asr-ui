<script>
  import Nav from "$lib/nav.svelte";
  import "../app.css";
</script>

<Nav></Nav>

<main class="container max-w-xl mx-auto px-4">
  <slot />
</main>