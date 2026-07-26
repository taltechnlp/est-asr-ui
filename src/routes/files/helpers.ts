export const toTime = (timestampt) => {
		const ts = new Date(timestampt);
		const date = ts.toLocaleDateString('et-ET', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});
		const time = ts.toLocaleTimeString('et-ET', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
		return `${date} ${time}`;
	};

// Seconds are noise when scanning a list. Split so the list can set the day
// and the clock time at different sizes; the exact stamp stays in the tooltip.
export const toDateParts = (timestampt) => {
	const ts = new Date(timestampt);
	return {
		date: ts.toLocaleDateString('et-ET', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		}),
		time: ts.toLocaleTimeString('et-ET', {
			hour: '2-digit',
			minute: '2-digit'
		})
	};
};
