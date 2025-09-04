import runSpeedtest from "../functions/stats/speedtest";

if (require.main === module) {
    runSpeedtest()
        .then(result => {
            console.log('\n========================================');
            console.log('         SPEEDTEST RESULTS');
            console.log('========================================');
            console.log(`Ping:      ${result.ping} ms`);
            console.log(`Download:  ${result.download.speed} Mbps`);
            console.log(`Upload:    ${result.upload.speed} Mbps`);
            console.log(`Server:    ${result.download.serverLocation}`);
            console.log(`Time:      ${result.timestamp.toISOString()}`);
            console.log('========================================');
        })
        .catch(error => {
            console.error('Error running speedtest:', error);
            process.exit(1);
        });
}