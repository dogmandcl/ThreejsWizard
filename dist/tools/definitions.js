export const toolDefinitions = [
    {
        name: 'write_file',
        description: 'Create or overwrite a file with the given content. Use this to create JavaScript, TypeScript, HTML, CSS, GLSL shader files, configuration files (package.json, vite.config.js, tsconfig.json), and any other project files.',
        input_schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The file path relative to the current working directory (e.g., "src/main.js", "index.html", "package.json")',
                },
                content: {
                    type: 'string',
                    description: 'The complete content to write to the file',
                },
            },
            required: ['path', 'content'],
        },
    },
    {
        name: 'read_file',
        description: 'Read the contents of an existing file. Use this before modifying a file to understand its current state.',
        input_schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The file path relative to the current working directory',
                },
            },
            required: ['path'],
        },
    },
    {
        name: 'run_command',
        description: 'Execute a shell command. Use this to run npm commands (install, run dev, etc.), create directories, or perform other shell operations.',
        input_schema: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The shell command to execute (e.g., "npm install", "npm run dev", "mkdir src")',
                },
                cwd: {
                    type: 'string',
                    description: 'Optional working directory for the command (defaults to current directory)',
                },
            },
            required: ['command'],
        },
    },
    {
        name: 'list_files',
        description: 'List files and directories in a path. Use this to understand the current project structure.',
        input_schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The directory path to list (defaults to current directory)',
                },
                recursive: {
                    type: 'boolean',
                    description: 'If true, list files recursively (default: false)',
                },
            },
            required: [],
        },
    },
    {
        name: 'fetch_url',
        description: 'Fetch content from a URL (used to retrieve official documentation)',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string' }
            },
            required: ['url']
        }
    },
    {
        name: 'search_three_docs',
        description: 'Search official local Three.js documentation',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string' }
            },
            required: ['query']
        }
    }
];
