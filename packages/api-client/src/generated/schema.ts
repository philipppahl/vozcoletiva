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
        /** Healthcheck and version */
        get: operations["getHello"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Preview an invite by URL token */
        get: operations["previewInviteByToken"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/{token}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Accept an invite and become a project member */
        post: operations["acceptInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/by-code/{code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Preview an invite by short code */
        get: operations["previewInviteByCode"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/invites/by-code/{code}/accept": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Accept an invite by short code */
        post: operations["acceptInviteByCode"];
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
        /** Current user profile */
        get: operations["getMe"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the caller's projects */
        get: operations["listMyProjects"];
        put?: never;
        /** Create a project */
        post: operations["createProject"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a project by slug */
        get: operations["getProject"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/invites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List a project's invites */
        get: operations["listInvites"];
        put?: never;
        /** Issue a new invite */
        post: operations["issueInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/invites/{inviteId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke an invite */
        delete: operations["revokeInvite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List members of a project */
        get: operations["listMembers"];
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
        AcceptInviteResponse: {
            project: {
                id: string;
                name: string;
                slug: string;
            };
            role: components["schemas"]["Role"];
        };
        ApiError: {
            error: string;
            message: string;
        };
        CreateProjectBody: {
            name: string;
            slug: string;
            /**
             * @default custom
             * @enum {string}
             */
            template: "custom";
        };
        Hello: {
            /** @constant */
            ok: true;
            version: string;
        };
        Invite: {
            code: string;
            /** Format: date-time */
            expires_at?: string | null;
            id: string;
            /** Format: date-time */
            issued_at: string;
            issued_by: string;
            max_uses?: number | null;
            note?: string | null;
            project_id: string;
            /** Format: date-time */
            revoked_at?: string | null;
            role: components["schemas"]["Role"];
            token: string;
            use_count: number;
        };
        InviteListResponse: {
            invites: components["schemas"]["Invite"][];
        };
        InvitePreview: {
            /** Format: date-time */
            expires_at?: string | null;
            max_uses?: number | null;
            project_name: string;
            project_slug: string;
            revoked: boolean;
            role: components["schemas"]["Role"];
            use_count: number;
            valid: boolean;
        };
        IssueInviteBody: {
            expires_in_days?: number;
            max_uses?: number;
            note?: string;
            role: components["schemas"]["Role"];
        };
        Member: {
            display_name: string;
            /** Format: date-time */
            joined_at: string;
            role: components["schemas"]["Role"];
            user_id: string;
        };
        MemberListResponse: {
            members: components["schemas"]["Member"][];
        };
        Ok: {
            ok: boolean;
        };
        Project: {
            /** Format: date-time */
            created_at: string;
            id: string;
            name: string;
            owner_id: string;
            slug: string;
            template: string;
            /** @enum {string} */
            visibility: "private" | "public";
        };
        ProjectDetailResponse: {
            project: components["schemas"]["Project"];
            role: components["schemas"]["Role"];
        };
        ProjectListEntry: {
            project: components["schemas"]["Project"];
            role: components["schemas"]["Role"];
        };
        ProjectListResponse: {
            projects: components["schemas"]["ProjectListEntry"][];
        };
        /** @enum {string} */
        Role: "owner" | "admin" | "moderator" | "member" | "observer";
        UserProfile: {
            /** Format: date-time */
            created_at: string;
            display_name: string;
            /** @enum {string} */
            locale: "en" | "pt";
            /** @enum {string} */
            theme: "system" | "light" | "dark";
            user_id: string;
        };
    };
    responses: {
        /** @description Bad request. */
        BadRequest: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ApiError"];
            };
        };
        /** @description Forbidden. */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ApiError"];
            };
        };
        /** @description Not found. */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ApiError"];
            };
        };
    };
    parameters: {
        Slug: string;
    };
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
    previewInviteByToken: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invite metadata + validity. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitePreview"];
                };
            };
            404: components["responses"]["NotFound"];
        };
    };
    acceptInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                token: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Membership added (or already present). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AcceptInviteResponse"];
                };
            };
            404: components["responses"]["NotFound"];
            /** @description Invite revoked, expired, or used up. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    previewInviteByCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invite metadata + validity. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InvitePreview"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
        };
    };
    acceptInviteByCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                code: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Membership added. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AcceptInviteResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            404: components["responses"]["NotFound"];
            /** @description Invite revoked, expired, or used up. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    getMe: {
        parameters: {
            query?: {
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
    listMyProjects: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A list of projects with the caller's role on each. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectListResponse"];
                };
            };
            /** @description Missing or invalid auth. */
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
    createProject: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProjectBody"];
            };
        };
        responses: {
            /** @description Project created. Caller is the Owner. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Project"];
                };
            };
            /** @description Invalid name / slug / template. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Slug already taken. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    getProject: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Project + caller's role. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProjectDetailResponse"];
                };
            };
            /** @description Not a member. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Project does not exist. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
    listInvites: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invites for the project. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InviteListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
        };
    };
    issueInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["IssueInviteBody"];
            };
        };
        responses: {
            /** @description Invite created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Invite"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
        };
    };
    revokeInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                inviteId: string;
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invite revoked. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listMembers: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Members of the project. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MemberListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
}
