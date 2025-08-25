#!/usr/bin/env node

/**
 * Test Node.js integration of the PhoneticAnalyzerTool
 *
 * This script tests that the PhoneticAnalyzerTool can be imported and used
 * correctly from Node.js, simulating how it would be used in the coordinating agent.
 */

import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: We can't directly test the TypeScript imports here, but we can test the Python integration

async function testPhoneticTool() {
	console.log('🧪 Testing PhoneticAnalyzerTool Node.js Integration');
	console.log('='.repeat(50));

	try {
		// We can't directly import the tool in this script because it uses TypeScript and Svelte imports
		// Instead, let's test that the Python script can be called correctly

		console.log('✅ Testing Python script accessibility...');
		const scriptPath = path.join(__dirname, 'phonetic_analyzer.py');

		const testCases = [
			{ original: 'protocol', candidate: 'prototype' },
			{ original: 'käima', candidate: 'kaima' },
			{ original: 'võti', candidate: 'voti' }
		];

		for (const testCase of testCases) {
			console.log(`\n🔍 Testing: "${testCase.original}" vs "${testCase.candidate}"`);

			const result = await runPythonScript(scriptPath, [
				'analyze',
				testCase.original,
				testCase.candidate
			]);

			if (result.success) {
				const data = JSON.parse(result.stdout);
				console.log(`   ✅ Similarity: ${data.similarity_score.toFixed(3)}`);
				console.log(`   ✅ Confidence: ${data.confidence}`);
				console.log(`   ✅ Method: ${data.method}`);
			} else {
				console.log(`   ❌ Error: ${result.error}`);
				return false;
			}
		}

		console.log('\n🎉 All Node.js integration tests passed!');
		return true;
	} catch (error) {
		console.error('❌ Integration test failed:', error);
		return false;
	}
}

function runPythonScript(scriptPath, args) {
	return new Promise((resolve) => {
		const python = spawn('python3', [scriptPath, ...args]);

		let stdout = '';
		let stderr = '';

		python.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		python.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		python.on('close', (code) => {
			if (code === 0) {
				resolve({ success: true, stdout, stderr });
			} else {
				resolve({ success: false, error: stderr || `Exit code: ${code}`, stdout });
			}
		});

		python.on('error', (error) => {
			resolve({ success: false, error: error.message });
		});
	});
}

// Run the test
testPhoneticTool()
	.then((success) => {
		process.exit(success ? 0 : 1);
	})
	.catch((error) => {
		console.error('Test execution failed:', error);
		process.exit(1);
	});
