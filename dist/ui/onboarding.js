import chalk from 'chalk';
export async function runOnboarding(ui) {
    console.log(chalk.cyan.bold('  Let\'s set up your project!\n'));
    // Ask for language preference
    const language = await ui.select('Which language would you like to use?', [
        { label: 'TypeScript (recommended)', value: 'typescript' },
        { label: 'JavaScript', value: 'javascript' },
    ]);
    // Ask for target platform
    const target = await ui.select('What platform are you building for?', [
        { label: 'Browser (web app)', value: 'browser' },
        { label: 'Mobile (React Native, etc.)', value: 'mobile' },
        { label: 'Desktop (Electron, etc.)', value: 'desktop' },
    ]);
    // Ask for project description
    console.log();
    console.log(chalk.cyan('  Now describe what you\'d like to build:'));
    console.log(chalk.gray('  (e.g., "A 3D solar system with orbiting planets")'));
    console.log();
    const description = await ui.prompt();
    console.log();
    console.log(chalk.gray('  ─────────────────────────────────────────'));
    console.log();
    return {
        language,
        target,
        description,
    };
}
export function buildContextMessage(prefs) {
    return `The user wants to create a Three.js project with these preferences:
- Language: ${prefs.language}
- Target platform: ${prefs.target}

Their project description: ${prefs.description}

Please create the project structure and initial files based on these requirements. Start by setting up the basic Three.js scene.`;
}
