declare module "node:sqlite" {
  export type SQLInputValue = null | number | bigint | string | Uint8Array;
  export type SQLOutputValue = null | number | bigint | string | Uint8Array;

  export interface StatementSync {
    all(...namedParameters: unknown[]): Record<string, SQLOutputValue>[];
    get(...namedParameters: unknown[]): Record<string, SQLOutputValue> | undefined;
    run(...namedParameters: unknown[]): {
      changes: number | bigint;
      lastInsertRowid: number | bigint;
    };
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
