const { execSync } = require('child_process');
try {
  const output = execSync('netstat -ano').toString();
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes(':8082')) {
      const parts = line.trim().split(/\s+/);
      // Format is usually: Proto LocalAddress ForeignAddress State PID
      // Sometimes it is: Proto LocalAddress ForeignAddress PID (for UDP or listening without state)
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid) && pid !== '0') {
        console.log(`Killing process on port 8082 with PID: ${pid}`);
        try {
          execSync(`taskkill /F /PID ${pid}`);
        } catch (err) {
          console.error(`Failed to kill PID ${pid}:`, err.message);
        }
      }
    }
  }
} catch (e) {
  console.log('Error searching port 8082:', e.message);
}
