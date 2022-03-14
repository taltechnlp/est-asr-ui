<script>
	import { me } from '$lib/stores';

	let myData;

	me.subscribe(value => {
		myData = value;
	});
</script>

<p>My name is {myData.name}</p>