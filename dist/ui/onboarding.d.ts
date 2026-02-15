import { TerminalUI } from './TerminalUI.js';
import { ProjectPreferences } from '../core/types.js';
export declare function runOnboarding(ui: TerminalUI): Promise<ProjectPreferences>;
export declare function buildContextMessage(prefs: ProjectPreferences): string;
