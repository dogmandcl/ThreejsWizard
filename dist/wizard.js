#!/usr/bin/env node
import 'dotenv/config';
import { ThreeJsWizard } from './core/ThreeJsWizard.js';
// Check for API key
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Please set it in a .env file or export it in your shell.');
    process.exit(1);
}
// Create and start the wizard
const wizard = new ThreeJsWizard();
// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    wizard.stop();
    process.exit(0);
});
process.on('SIGTERM', () => {
    wizard.stop();
    process.exit(0);
});
// Start the REPL
wizard.start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
