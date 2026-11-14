export declare const MIGRATIONS: string[];
export declare function migrate(db: { exec(sql: string): void; prepare(sql: string): { get(): unknown } }): void;
