<script context="module">
    export async function load({ session }) {
      if (!session?.user) {
      return {
          status: 302,
          redirect: "/sign-in"
      }
      }
      return {
      props: {
          user: session.user
      }
      };
    }
  </script>