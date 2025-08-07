<script lang="ts">
	import { editor as editorStore } from '$lib/stores.svelte';
	import { getCoordinatingAgent } from '$lib/agents/coordinatingAgentSimple';
	import { logEditorSnapshot, createEditorSnapshot, searchInSnapshot } from '$lib/services/editorDebugger';
	import { TextReplacementTestHarness, generateTestCasesFromDocument } from '$lib/services/textReplacementTestHarness';
	
	let searchText = '';
	let replacementText = '';
	let debugOutput = '';
	let testResults: any[] = [];
	let isRunningTests = false;
	
	$: agent = getCoordinatingAgent();
	$: if ($editorStore) {
		agent.setEditor($editorStore);
		agent.setDebugMode(true);
	}
	
	function logSnapshot() {
		if (!$editorStore) {
			debugOutput = 'Editor not available';
			return;
		}
		
		logEditorSnapshot($editorStore, 'Manual Snapshot');
		debugOutput = 'Snapshot logged to console';
	}
	
	function searchDebug() {
		if (!$editorStore || !searchText) {
			debugOutput = 'Editor not available or search text empty';
			return;
		}
		
		const snapshot = createEditorSnapshot($editorStore);
		const results = searchInSnapshot(snapshot, searchText);
		
		let output = `Search for: "${searchText}"\n`;
		output += `Found: ${results.found}\n`;
		output += `Exact match: ${results.exactMatch}\n`;
		
		if (results.exactMatch) {
			output += `Locations: ${results.locations.length} matches\n`;
			results.locations.forEach((loc, i) => {
				output += `  [${i+1}] Position ${loc.position}: "${loc.context}"\n`;
			});
		}
		
		output += `\nWord Analysis:\n`;
		output += `  Search words: ${results.wordAnalysis.searchWords.join(', ')}\n`;
		output += `  Found words: ${results.wordAnalysis.foundWords.join(', ')}\n`;
		output += `  Missing words: ${results.wordAnalysis.missingWords.join(', ')}\n`;
		
		debugOutput = output;
		console.log('Search results:', results);
	}
	
	async function runTests() {
		if (!$editorStore) {
			debugOutput = 'Editor not available';
			return;
		}
		
		isRunningTests = true;
		testResults = [];
		
		try {
			const testCases = generateTestCasesFromDocument($editorStore);
			const harness = new TextReplacementTestHarness($editorStore, true);
			
			for (const testCase of testCases) {
				const result = await harness.runTest(testCase);
				testResults = [...testResults, result];
				await new Promise(resolve => setTimeout(resolve, 50));
			}
			
			harness.printSummary();
			
			const passed = testResults.filter(r => r.passed).length;
			const failed = testResults.filter(r => !r.passed).length;
			
			debugOutput = `Test Results:\n`;
			debugOutput += `✅ Passed: ${passed}/${testResults.length}\n`;
			debugOutput += `❌ Failed: ${failed}/${testResults.length}\n\n`;
			
			testResults.forEach((r, i) => {
				const icon = r.passed ? '✅' : '❌';
				debugOutput += `${icon} ${r.testId} (${r.method || 'none'}): ${r.executionTime.toFixed(1)}ms\n`;
				if (r.error) {
					debugOutput += `   Error: ${r.error}\n`;
				}
			});
			
		} catch (error) {
			debugOutput = `Test error: ${error}`;
			console.error('Test error:', error);
		} finally {
			isRunningTests = false;
		}
	}
	
	async function testReplacement() {
		if (!$editorStore || !searchText || !replacementText) {
			debugOutput = 'Please provide search and replacement text';
			return;
		}
		
		const harness = new TextReplacementTestHarness($editorStore, true);
		const testCase = {
			id: 'manual-test',
			description: 'Manual test',
			searchText,
			replacementText,
			expectedToFind: true
		};
		
		const result = await harness.runTest(testCase);
		
		debugOutput = `Test Result:\n`;
		debugOutput += `Success: ${result.passed}\n`;
		debugOutput += `Method: ${result.method || 'none'}\n`;
		debugOutput += `Time: ${result.executionTime.toFixed(2)}ms\n`;
		
		if (result.error) {
			debugOutput += `Error: ${result.error}\n`;
		}
		
		console.log('Test result:', result);
	}
</script>

<div class="bg-base-200 p-4 rounded-lg">
	<h3 class="text-lg font-semibold mb-4">🔧 Debug Panel</h3>
	
	<div class="space-y-4">
		<!-- Snapshot Tools -->
		<div class="border border-base-300 p-3 rounded">
			<h4 class="font-medium mb-2">Editor Snapshot</h4>
			<button 
				class="btn btn-sm btn-primary"
				on:click={logSnapshot}
			>
				📸 Log Snapshot
			</button>
		</div>
		
		<!-- Search Debug -->
		<div class="border border-base-300 p-3 rounded">
			<h4 class="font-medium mb-2">Search Debug</h4>
			<div class="flex gap-2">
				<input 
					type="text" 
					class="input input-sm input-bordered flex-1"
					placeholder="Search text..."
					bind:value={searchText}
				/>
				<button 
					class="btn btn-sm btn-primary"
					on:click={searchDebug}
				>
					🔍 Search
				</button>
			</div>
		</div>
		
		<!-- Test Replacement -->
		<div class="border border-base-300 p-3 rounded">
			<h4 class="font-medium mb-2">Test Replacement</h4>
			<div class="space-y-2">
				<input 
					type="text" 
					class="input input-sm input-bordered w-full"
					placeholder="Search text..."
					bind:value={searchText}
				/>
				<input 
					type="text" 
					class="input input-sm input-bordered w-full"
					placeholder="Replacement text..."
					bind:value={replacementText}
				/>
				<button 
					class="btn btn-sm btn-primary"
					on:click={testReplacement}
				>
					🔄 Test Replace
				</button>
			</div>
		</div>
		
		<!-- Automated Tests -->
		<div class="border border-base-300 p-3 rounded">
			<h4 class="font-medium mb-2">Automated Tests</h4>
			<button 
				class="btn btn-sm btn-primary"
				on:click={runTests}
				disabled={isRunningTests}
			>
				{#if isRunningTests}
					<span class="loading loading-spinner loading-xs"></span>
					Running...
				{:else}
					🧪 Run Test Suite
				{/if}
			</button>
		</div>
		
		<!-- Output -->
		{#if debugOutput}
			<div class="border border-base-300 p-3 rounded">
				<h4 class="font-medium mb-2">Output</h4>
				<pre class="text-xs bg-base-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">{debugOutput}</pre>
			</div>
		{/if}
		
		<!-- Test Results -->
		{#if testResults.length > 0}
			<div class="border border-base-300 p-3 rounded">
				<h4 class="font-medium mb-2">Test Results</h4>
				<div class="overflow-x-auto">
					<table class="table table-xs">
						<thead>
							<tr>
								<th>Test</th>
								<th>Result</th>
								<th>Method</th>
								<th>Time</th>
							</tr>
						</thead>
						<tbody>
							{#each testResults as result}
								<tr class:bg-success={result.passed} class:bg-error={!result.passed} class:bg-opacity-20={true}>
									<td>{result.testId}</td>
									<td>{result.passed ? '✅' : '❌'}</td>
									<td>{result.method || 'none'}</td>
									<td>{result.executionTime.toFixed(1)}ms</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>