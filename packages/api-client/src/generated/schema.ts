/* eslint-disable */
// AUTO-GENERATED from apps/api/openapi.yaml — do not edit by hand.
// Regenerate with: bun run api:generate

export interface paths {
    "/v1/hello": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Healthcheck and version
         * @description Returns a small JSON payload confirming the API is reachable.
         */
        get: operations["getHello"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Current user profile
         * @description Returns the authenticated user's profile. On first call after sign-up,
         *     creates the profile in the data store (idempotent under concurrent calls).
         */
        get: operations["getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ApiError: {
            /** @description Machine-readable error code. */
            error: string;
            /** @description Human-readable error message. */
            message: string;
        };
        Hello: {
            /** @constant */
            ok: true;
            /**
             * @description The semver of the deployed Lambda build.
             * @example 0.1.0
             */
            version: string;
        };
        UserProfile: {
            /** Format: date-time */
            created_at: string;
            display_name: string;
            /** @enum {string} */
            locale: "en" | "pt";
            /** @enum {string} */
            theme: "system" | "light" | "dark";
            /** @description Cognito sub (UUID). */
            user_id: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getHello: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description API is reachable. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Hello"];
                };
            };
        };
    };
    getMe: {
        parameters: {
            query?: {
                /**
                 * @description Display name used at first-profile creation. Ignored on subsequent
                 *     calls when the profile already exists. Sign-up flow forwards the
                 *     value the user entered.
                 */
                display_name?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description User profile. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserProfile"];
                };
            };
            /** @description Missing, malformed, or expired access token. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
}
