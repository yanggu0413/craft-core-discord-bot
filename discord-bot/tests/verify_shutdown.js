const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.resolve(__dirname, '../db_shutdown_test.db');

// Helper to delete DB file if it exists
function cleanupDb() {
  if (fs.existsSync(DB_FILE)) {
    try { fs.unlinkSync(DB_FILE); } catch (e) {}
  }
}

function runVerification(envName) {
  return new Promise((resolve, reject) => {
    cleanupDb();
    
    console.log(`\n--- Running verification with NODE_ENV=${envName} ---`);
    
    const botProcess = spawn('node', [
      '-r', path.resolve(__dirname, './preload-exception-trigger.js'),
      'src/index.js'
    ], {
      env: {
        ...process.env,
        NODE_ENV: envName,
        DATABASE_PATH: DB_FILE,
        WEBSOCKET_PORT: '9099',
        WEBSOCKET_SECRET: 'shutdown_secret',
        DISCORD_TOKEN: 'mock_token'
      },
      cwd: path.resolve(__dirname, '../'),
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    let stdoutData = '';
    let stderrData = '';
    let shutdownCalls = {
      wsStop: false,
      dbClose: false,
      clientDestroy: false
    };

    botProcess.stdout.on('data', (data) => {
      const str = data.toString();
      stdoutData += str;
      process.stdout.write(`[BOT STDOUT]: ${str}`);

      if (str.includes('[VERIFY-SHUTDOWN] wsServer.stop called')) {
        shutdownCalls.wsStop = true;
      }
      if (str.includes('[VERIFY-SHUTDOWN] db.close called')) {
        shutdownCalls.dbClose = true;
      }
      if (str.includes('[VERIFY-SHUTDOWN] client.destroy called')) {
        shutdownCalls.clientDestroy = true;
      }
    });

    botProcess.stderr.on('data', (data) => {
      const str = data.toString();
      stderrData += str;
      process.stderr.write(`[BOT STDERR]: ${str}`);
      
      if (str.includes('[VERIFY-SHUTDOWN] wsServer.stop called')) {
        shutdownCalls.wsStop = true;
      }
      if (str.includes('[VERIFY-SHUTDOWN] db.close called')) {
        shutdownCalls.dbClose = true;
      }
      if (str.includes('[VERIFY-SHUTDOWN] client.destroy called')) {
        shutdownCalls.clientDestroy = true;
      }
    });

    // We wait for the server to be ready before triggering the error
    let triggered = false;
    const interval = setInterval(() => {
      if (stdoutData.includes('WebSocket server listening') || stdoutData.includes('Logged in as')) {
        clearInterval(interval);
        if (!triggered) {
          triggered = true;
          // Trigger exception depending on the environment to test both paths
          const triggerType = envName === 'production' ? 'TRIGGER_UNCAUGHT_EXCEPTION' : 'TRIGGER_UNHANDLED_REJECTION';
          console.log(`Sending trigger: ${triggerType}`);
          botProcess.send({ type: triggerType });
        }
      }
    }, 100);

    botProcess.on('close', (code) => {
      clearInterval(interval);
      cleanupDb();
      resolve({
        code,
        stdoutData,
        stderrData,
        shutdownCalls
      });
    });

    botProcess.on('error', (err) => {
      clearInterval(interval);
      cleanupDb();
      reject(err);
    });

    // Safety timeout
    setTimeout(() => {
      clearInterval(interval);
      botProcess.kill('SIGKILL');
      cleanupDb();
      reject(new Error('Process hung, killed by safety timeout.'));
    }, 10000);
  });
}

async function main() {
  try {
    // 1. Run Production Verification
    const prodResult = await runVerification('production');
    console.log('\n--- Production Verification Result ---');
    console.log(`Exit Code: ${prodResult.code} (Expected: 1)`);
    console.log(`wsServer.stop called: ${prodResult.shutdownCalls.wsStop}`);
    console.log(`db.close called: ${prodResult.shutdownCalls.dbClose}`);
    console.log(`client.destroy called: ${prodResult.shutdownCalls.clientDestroy}`);

    // Verify logs are JSON formatted in production
    const prodLines = prodResult.stdoutData.split('\n')
      .concat(prodResult.stderrData.split('\n'))
      .map(line => line.trim())
      .filter(line => line.startsWith('{') && line.endsWith('}'));
    
    console.log(`Found ${prodLines.length} valid JSON log line(s) in output.`);
    let allLogsAreJson = prodResult.stdoutData.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.includes('[VERIFY-SHUTDOWN]') && !l.includes('[TRIGGER]') && !l.includes('ExperimentalWarning'))
      .every(l => {
        try {
          JSON.parse(l);
          return true;
        } catch (e) {
          console.log(`Non-JSON log line found: "${l}"`);
          return false;
        }
      });

    // 2. Run Development Verification
    const devResult = await runVerification('development');
    console.log('\n--- Development Verification Result ---');
    console.log(`Exit Code: ${devResult.code} (Expected: 1)`);
    console.log(`wsServer.stop called: ${devResult.shutdownCalls.wsStop}`);
    console.log(`db.close called: ${devResult.shutdownCalls.dbClose}`);
    console.log(`client.destroy called: ${devResult.shutdownCalls.clientDestroy}`);

    // Check that the normal application logs are not JSON in development console, but are simple text
    const devLines = devResult.stdoutData.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.includes('[VERIFY-SHUTDOWN]') && !l.includes('[TRIGGER]') && !l.includes('ExperimentalWarning'));
    
    // Specifically check that the startup logs (which are normal application logs) are in simple text format
    const appLogs = devLines.filter(l => l.includes('Logged in as') || l.includes('WebSocket server listening') || l.includes('Initiating graceful shutdown'));
    let devLogsAreColorized = appLogs.length > 0 && appLogs.every(l => {
      try {
        JSON.parse(l);
        return false; // If it's valid JSON, it's not the simple format
      } catch (e) {
        return true; // Correctly simple text
      }
    });

    // Summary asserts
    const shutdownWorks = prodResult.shutdownCalls.wsStop && prodResult.shutdownCalls.dbClose && prodResult.shutdownCalls.clientDestroy &&
                          devResult.shutdownCalls.wsStop && devResult.shutdownCalls.dbClose && devResult.shutdownCalls.clientDestroy;
    
    const exitCodesCorrect = prodResult.code === 1 && devResult.code === 1;

    console.log('\n=====================================');
    console.log('            VERDICT REPORT           ');
    console.log('=====================================');
    console.log(`Shutdown Sequence Closes All:  ${shutdownWorks ? 'PASS' : 'FAIL'}`);
    console.log(`Exit Codes Correct (1):       ${exitCodesCorrect ? 'PASS' : 'FAIL'}`);
    console.log(`Production JSON Logs Correct:  ${allLogsAreJson ? 'PASS' : 'FAIL'}`);
    console.log(`Development Custom Format:    ${devLogsAreColorized ? 'PASS' : 'FAIL'}`);
    
    if (shutdownWorks && exitCodesCorrect && allLogsAreJson && devLogsAreColorized) {
      console.log('\nALL VERIFICATION STEPS PASSED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.log('\nSOME VERIFICATION STEPS FAILED.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Verification script failed with error:', err);
    process.exit(1);
  }
}

main();
