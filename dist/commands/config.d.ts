interface ConfigOptions {
    set?: boolean;
    delete?: boolean;
    path?: boolean;
}
export declare function configCommand(options: ConfigOptions): Promise<void>;
export {};
