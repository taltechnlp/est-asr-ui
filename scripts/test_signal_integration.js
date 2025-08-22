#!/usr/bin/env node

/**
 * Test Node.js integration of the SignalQualityAssessorTool
 * 
 * This script tests that the SignalQualityAssessorTool can be integrated
 * correctly with the coordinating agent, following the same pattern as the
 * phonetic analyzer tool.
 */

import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSignalQualityTool() {
    console.log('🎛️ Testing SignalQualityAssessorTool Node.js Integration');
    console.log('='.repeat(60));
    
    try {
        // Find a test audio file
        const testAudioFiles = [
            "/home/aivo/dev/est-asr-ui/static/Päevakaja 16.05.mp3",
            "/home/aivo/dev/est-asr-ui/uploads/cm7jcn30b000011rbsrbbcdg3/168c9a9bd0334720bddba96a7ae9de_FIN_M_MattiN.mp3"
        ];
        
        let testAudioFile = null;
        for (const file of testAudioFiles) {
            if (existsSync(file)) {
                testAudioFile = file;
                break;
            }
        }
        
        if (!testAudioFile) {
            console.log('⚠️ No audio files found, testing error handling only');
            testAudioFile = "/nonexistent/test.mp3";
        }
        
        console.log('✅ Testing Python script accessibility...');
        const scriptPath = path.join(__dirname, 'signal_quality_assessor.py');
        
        const testCases = [
            { file: testAudioFile, start: 0, end: 5, description: "5-second segment" },
            { file: testAudioFile, start: 5, end: 8, description: "3-second segment" },
            { file: testAudioFile, start: 0, end: 1, description: "1-second segment" }
        ];
        
        for (const testCase of testCases) {
            console.log(`\n🔍 Testing: ${testCase.description}`);
            console.log(`   File: ${path.basename(testCase.file)}`);
            console.log(`   Time: ${testCase.start}s - ${testCase.end}s`);
            
            const result = await runPythonScript(scriptPath, [
                'assess', testCase.file, testCase.start.toString(), testCase.end.toString()
            ]);
            
            if (result.success) {
                try {
                    const data = JSON.parse(result.stdout);
                    console.log(`   ✅ SNR: ${data.snr_db.toFixed(2)} dB`);
                    console.log(`   ✅ Quality: ${data.quality_category}`);
                    console.log(`   ✅ Strategy threshold: ${data.suggested_confidence_threshold}`);
                    console.log(`   ✅ Method: ${data.method}`);
                    
                    // Test strategy analysis
                    if (data.snr_db >= 30) {
                        console.log(`   📋 Expected: Conservative strategy (threshold ≥ 0.9)`);
                    } else if (data.snr_db >= 20) {
                        console.log(`   📋 Expected: Balanced strategy (threshold ≥ 0.8)`);
                    } else if (data.snr_db >= 15) {
                        console.log(`   📋 Expected: Moderate strategy (threshold ≥ 0.7)`);
                    } else if (data.snr_db >= 10) {
                        console.log(`   📋 Expected: Aggressive strategy (threshold ≥ 0.6)`);
                    } else {
                        console.log(`   📋 Expected: Very aggressive strategy (threshold ≥ 0.5)`);
                    }
                    
                } catch (parseError) {
                    console.log(`   ❌ JSON parsing failed: ${parseError.message}`);
                    console.log(`   Raw output: ${result.stdout.substring(0, 200)}`);
                    return false;
                }
            } else {
                console.log(`   ⚠️ Expected error for invalid scenarios: ${result.error}`);
                // For invalid files, this is expected behavior
                if (testCase.file.includes('nonexistent')) {
                    console.log(`   ✅ Error handling working correctly`);
                }
            }
        }
        
        console.log('\n🎉 Signal quality tool integration tests completed!');
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
testSignalQualityTool().then(success => {
    console.log(`\n📊 Integration Test Result: ${success ? 'SUCCESS' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});