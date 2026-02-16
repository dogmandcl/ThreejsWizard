import chalk from 'chalk';
import { TerminalUI } from './TerminalUI.js';
import { ProjectPreferences, ProjectLanguage, ProjectTarget, ExecutionMode } from '../core/types.js';

export async function runOnboarding(ui: TerminalUI): Promise<ProjectPreferences> {
  console.log(chalk.cyan.bold('  Let\'s set up your project!\n'));

  // Ask for language preference
  const language = await ui.select('Which language would you like to use?', [
    { label: 'TypeScript (recommended)', value: 'typescript' },
    { label: 'JavaScript', value: 'javascript' },
  ]) as ProjectLanguage;

  // Ask for target platform
  const target = await ui.select('What platform are you building for?', [
    { label: 'Browser (web app)', value: 'browser' },
    { label: 'Mobile (React Native, etc.)', value: 'mobile' },
    { label: 'Desktop (Electron, etc.)', value: 'desktop' },
  ]) as ProjectTarget;

  // Ask for project description with mode toggle
  console.log();
  console.log(chalk.cyan('  Describe what you\'d like to build:'));
  console.log(chalk.gray('  (e.g., "A 3D solar system with orbiting planets")'));
  console.log();

  const { text: description, mode } = await ui.promptWithMode('single-shot');

  console.log();
  ui.printModeInfo(mode);
  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log();

  return {
    language,
    target,
    description,
    mode,
  };
}

export function buildContextMessage(prefs: ProjectPreferences): string {
  const modeInstruction = prefs.mode === 'planning'
    ? `\n\nIMPORTANT: The user has requested Planning Mode. You MUST output a detailed implementation plan with Architecture Overview, Dependencies, File Structure, and Execution Steps BEFORE writing any code.`
    : `\n\nThe user has requested Single-Shot Mode. Plan internally and proceed directly to implementation without outputting a formal plan.`;

  return `The user wants to create a Three.js project with these preferences:
- Language: ${prefs.language}
- Target platform: ${prefs.target}
- Execution mode: ${prefs.mode === 'planning' ? 'Planning Mode (detailed plan first)' : 'Single-Shot Mode (direct implementation)'}

Their project description: ${prefs.description}${modeInstruction}

Please create the project structure and initial files based on these requirements. Start by setting up the basic Three.js scene.`;
}
