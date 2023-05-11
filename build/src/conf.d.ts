/**
 * A Singleton class to hold configuration related objects.
 * Use the `get()` method to access the unique singleton instance.
 *
 * Resolution order for paths is:
 * - Explicitly set paths (via CLI option)
 * - Env var
 * - Well-known location
 *
 *
 */
export declare class Conf {
    private _root;
    private _projectConfig;
    private _ignore;
    private _auth;
    private _authLocal;
    private static _instance;
    /**
     * Private to prevent direct construction calls with the `new` operator.
     */
    private constructor();
    set projectRootDirectory(path: string | undefined);
    get projectRootDirectory(): string | undefined;
    set projectConfig(filePath: string | undefined);
    get projectConfig(): string | undefined;
    set ignore(path: string | undefined);
    get ignore(): string | undefined;
    set auth(path: string | undefined);
    get auth(): string | undefined;
    set authLocal(path: string | undefined);
    get authLocal(): string | undefined;
    private buildPathOrUseEnv;
    /**
     * The static method that controls the access to the Conf singleton instance.
     *
     * @returns {Conf}
     */
    static get(): Conf;
}
