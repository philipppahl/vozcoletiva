/* eslint-disable */
// AUTO-GENERATED from apps/api/openapi.yaml — do not edit by hand.
// Regenerate with: bun run api:generate

export interface paths {
    "/v1/conversations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a conversation */
        get: operations["getConversation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/conversations/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List top-level messages (newest-first, cursor) */
        get: operations["listMessages"];
        put?: never;
        /** Post a message (a reply quotes another via reply_to_id) */
        post: operations["postMessage"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/conversations/{id}/messages/{mid}/reactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Toggle a reaction on a message
         * @description Add (`active: true`) or remove a fixed reaction. Idempotent; returns the message's updated reaction tallies.
         */
        put: operations["setReaction"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/conversations/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Advance the conversation read marker */
        post: operations["markConversationRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/dms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the caller's direct messages */
        get: operations["listDms"];
        put?: never;
        /**
         * Start (or get) a direct message with another user
         * @description Idempotent per user pair — the same two users always resolve to the same conversation. The peer must be an existing user.
         */
        post: operations["startDm"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/handles/{handle}/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Check whether a handle is free to claim
         * @description Reports whether `handle` can be claimed. Auth-optional — the sign-up form checks before the account exists. When a valid token is present, the caller's own current handle reads as available (so the profile form does not flag a no-op save).
         */
        get: operations["getHandleAvailability"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
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
        /**
         * Update the caller's display name
         * @description Sets the caller's display name (upsert). Cognito holds auth only; this is the single bootstrap/edit path for the display name. The sign-up flow calls this once the account is confirmed.
         */
        patch: operations["updateMe"];
        trace?: never;
    };
    "/v1/me/avatar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Set the caller's avatar
         * @description Upload a profile photo. The client crops + resizes to ~256px WebP and sends the bytes as base64; the server re-validates type + size, stores it under an immutable versioned key, and returns the public URL.
         */
        post: operations["setAvatar"];
        /** Remove the caller's avatar */
        delete: operations["deleteAvatar"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/handle": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Set or change the caller's @handle
         * @description Claims a unique, case-insensitive @handle for the caller (used for mentions and as a public identifier). Releasing the previous handle and claiming the new one is atomic. Idempotent if the handle is unchanged.
         */
        put: operations["setHandle"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/inbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The caller's inbox (notifications) */
        get: operations["listInbox"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/inbox/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mark one inbox item read */
        post: operations["markInboxItemRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/inbox/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mark all inbox items read */
        post: operations["markAllInboxRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/notification-prefs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get notification preferences */
        get: operations["getNotificationPrefs"];
        /** Update notification preferences */
        put: operations["putNotificationPrefs"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/push-subscriptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Register a Web Push subscription */
        post: operations["addPushSubscription"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/me/push-subscriptions/remove": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Remove a Web Push subscription */
        post: operations["removePushSubscription"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/messages/{id}/thread": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a thread (parent + replies) */
        get: operations["getThread"];
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
    "/v1/projects/{slug}/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List categories (topics) in a project */
        get: operations["listCategories"];
        put?: never;
        /** Create a category (owner/admin) */
        post: operations["createCategory"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a category (owner/admin) */
        delete: operations["deleteCategory"];
        options?: never;
        head?: never;
        /** Rename a category (owner/admin) */
        patch: operations["renameCategory"];
        trace?: never;
    };
    "/v1/projects/{slug}/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List a project's channels */
        get: operations["listChannels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List documents (derived from passed Document proposals) */
        get: operations["listDocuments"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/documents/by-name/{name}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a document by name (versions + current + active amendment) */
        get: operations["getDocumentByName"];
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
    "/v1/projects/{slug}/proposals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List proposals in a project */
        get: operations["listProposals"];
        put?: never;
        /** Create a proposal (Decision), or a fork via parent_id */
        post: operations["createProposal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/proposals/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a proposal (with your current vote) */
        get: operations["getProposal"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/proposals/{id}/comments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List comments on a proposal */
        get: operations["listComments"];
        put?: never;
        /** Add a comment to a proposal */
        post: operations["createComment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/proposals/{id}/comments/{commentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Soft-delete a comment (author or admin) */
        delete: operations["deleteComment"];
        options?: never;
        head?: never;
        /** Edit a comment (author only) */
        patch: operations["updateComment"];
        trace?: never;
    };
    "/v1/projects/{slug}/proposals/{id}/comments/{commentId}/reactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Toggle a reaction on a comment
         * @description Add (`active: true`) or remove a fixed reaction (decision 0033). Idempotent; returns the comment's updated reaction tallies.
         */
        put: operations["setCommentReaction"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/proposals/{id}/tree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the deliberation tree (root + forks) */
        get: operations["getProposalTree"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/proposals/{id}/vote": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cast or change a vote */
        post: operations["castVote"];
        /** Retract your current vote */
        delete: operations["retractVote"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/proposals/{id}/withdraw": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Withdraw a proposal (author-only, before close) */
        post: operations["withdrawProposal"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{slug}/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search a project (proposals, documents, members, channels) */
        get: operations["searchProject"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get a presigned URL to upload chat media
         * @description Returns a short-lived presigned S3 PUT URL. The client uploads the bytes directly to S3 with the exact Content-Type, then posts a message referencing the returned `key`.
         */
        post: operations["createUpload"];
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
        Attachment: {
            duration_ms?: number;
            height?: number;
            /** @enum {string} */
            kind: "image" | "doc" | "voice";
            mime: string;
            name?: string;
            size?: number;
            url: string;
            width?: number;
        };
        AttachmentInput: {
            duration_ms?: number;
            height?: number;
            key: string;
            /** @enum {string} */
            kind: "image" | "doc" | "voice";
            mime?: string;
            name?: string;
            size?: number;
            width?: number;
        };
        AvatarResponse: {
            avatar_url: string;
        };
        AvatarUploadBody: {
            /** @description Standard base64 of the image bytes (PNG/JPEG/WebP, ≤512 KB decoded). */
            data: string;
        };
        CastVoteBody: {
            choice: components["schemas"]["Choice"];
        };
        Category: {
            id: string;
            name: string;
            position: number;
        };
        CategoryListResponse: {
            categories: components["schemas"]["Category"][];
        };
        CategoryNameBody: {
            name: string;
        };
        Channel: {
            description?: string | null;
            id: string;
            /** @enum {string} */
            kind: "channel";
            last_message?: components["schemas"]["LastMessagePreview"] | null;
            member_count: number;
            name: string;
            project_id: string;
            unread_count: number;
        };
        ChannelListResponse: {
            channels: components["schemas"]["Channel"][];
        };
        ChannelSearchHit: {
            description: string | null;
            id: string;
            name: string;
        };
        /** @description A vote in a deliberation: the picked alternative's proposal id, or the special token `__none__` ("none of these") or `__abstain__`. */
        Choice: string;
        Comment: {
            author_display_name: string;
            author_id: string;
            body?: string | null;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            deleted_at?: string | null;
            deleted_by?: string | null;
            /** Format: date-time */
            edited_at?: string | null;
            id: string;
            proposal_id: string;
            reactions: components["schemas"]["Reaction"][];
            reply_to?: components["schemas"]["CommentReplyTo"] | null;
        };
        CommentListResponse: {
            comments: components["schemas"]["Comment"][];
        };
        /** @description Immutable snapshot of the comment a reply quotes (decision 0033). */
        CommentReplyTo: {
            author_display_name: string;
            id: string;
            preview: string;
        };
        CreateCommentBody: {
            body: string;
            reply_to_id?: string | null;
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
        CreateProposalBody: {
            body: string;
            /** @description Category (topic) for a root; defaults to the project's first. Ignored for a fork. */
            category_id?: string | null;
            /** @description Required for a `document` root — the stable document name. */
            document_name?: string | null;
            /**
             * Format: date-time
             * @description Required for a root; inherited for a fork.
             */
            ends_at?: string;
            /** @description 2+ labels turn a brand-new Decision into a multi-option vote (the proposal becomes the non-votable question, each label a child option). 1 label is rejected; 0/absent is a plain yes/no decision. */
            options?: string[] | null;
            /** @description When set, creates a fork under this parent's deliberation. */
            parent_id?: string | null;
            /** @description `decision` (default) or `document`. Root only; forks inherit. */
            proposal_kind?: components["schemas"]["ProposalKind"];
            quorum?: number | null;
            title: string;
            /** @description Required for a root; inherited from the root for a fork. */
            voting_rule?: components["schemas"]["VotingRule"];
        };
        DmConversation: {
            id: string;
            /** @enum {string} */
            kind: "dm";
            last_message?: components["schemas"]["LastMessagePreview"] | null;
            participants: components["schemas"]["DmParticipant"][];
            unread_count: number;
        };
        DmListResponse: {
            dms: components["schemas"]["DmConversation"][];
        };
        DmParticipant: {
            avatar_url?: string | null;
            display_name: string;
            handle?: string | null;
            user_id: string;
        };
        DocumentDetail: {
            active_amendment?: components["schemas"]["Proposal"] | null;
            current_version: components["schemas"]["Proposal"];
            name: string;
            version_count: number;
            versions: components["schemas"]["Proposal"][];
        };
        DocumentListResponse: {
            documents: components["schemas"]["DocumentSummary"][];
        };
        DocumentSearchHit: {
            name: string;
            snippet: string;
            version_count: number;
        };
        DocumentSummary: {
            active_amendment?: components["schemas"]["Proposal"] | null;
            current_version?: components["schemas"]["Proposal"] | null;
            name: string;
            version_count: number;
        };
        HandleAvailability: {
            available: boolean;
            handle: string;
        };
        Hello: {
            /** @constant */
            ok: true;
            version: string;
        };
        InboxItem: {
            actor_display_name?: string | null;
            actor_id: string;
            comment_id?: string | null;
            conversation_id?: string | null;
            /** Format: date-time */
            created_at: string;
            document_name?: string | null;
            id: string;
            /** @enum {string} */
            kind: "mention" | "reply" | "comment-on-yours" | "proposal-closed" | "document-amended";
            message_id?: string | null;
            preview: string;
            project_id: string;
            project_name: string;
            project_slug: string;
            proposal_id?: string | null;
            /** Format: date-time */
            read_at?: string | null;
        };
        InboxListResponse: {
            items: components["schemas"]["InboxItem"][];
            unread_count: number;
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
        LastMessagePreview: {
            /** Format: date-time */
            at: string;
            author_display_name: string;
            body_preview: string;
        };
        Member: {
            avatar_url?: string | null;
            display_name: string;
            handle?: string | null;
            /** Format: date-time */
            joined_at: string;
            role: components["schemas"]["Role"];
            user_id: string;
        };
        MemberListResponse: {
            members: components["schemas"]["Member"][];
        };
        MemberSearchHit: {
            display_name: string;
            role: string;
            user_id: string;
        };
        Message: {
            attachments: components["schemas"]["Attachment"][];
            author_display_name: string;
            author_id: string;
            body: string;
            conversation_id: string;
            /** Format: date-time */
            created_at: string;
            /** Format: date-time */
            edited_at?: string | null;
            id: string;
            /** Format: date-time */
            last_reply_at?: string | null;
            reactions: components["schemas"]["Reaction"][];
            reply_count: number;
            reply_to?: components["schemas"]["ReplyTo"] | null;
        };
        MessageListResponse: {
            has_more: boolean;
            messages: components["schemas"]["Message"][];
        };
        NotificationPrefs: {
            comment_on_yours: boolean;
            direct_message: boolean;
            document_amended: boolean;
            mention: boolean;
            proposal_closed: boolean;
            push_enabled: boolean;
            reply: boolean;
        };
        Ok: {
            ok: boolean;
        };
        PostMessageBody: {
            attachments?: components["schemas"]["AttachmentInput"][];
            body: string;
            reply_to_id?: string | null;
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
        Proposal: {
            author_id: string;
            body: string;
            /** @description Project-scoped category (topic) id. */
            category_id: string;
            /** Format: date-time */
            closed_at?: string | null;
            /** Format: date-time */
            created_at: string;
            /** @description Set on Document-kind proposals — the document this is a version of. */
            document_name?: string | null;
            /** Format: date-time */
            ends_at: string;
            id: string;
            /** @description True on a multi-option decision's question root — not itself votable. */
            is_question: boolean;
            /** @description Parent proposal id for a fork; null for a root. */
            parent_id?: string | null;
            project_id: string;
            proposal_kind: components["schemas"]["ProposalKind"];
            quorum?: number | null;
            /** @description Root of this proposal's deliberation; equals `id` for a root. */
            root_id: string;
            status: components["schemas"]["ProposalStatus"];
            tally_abstain: number;
            /** @description proposalId → votes. For a plain decision the only key is the root id. */
            tally_by_choice: {
                [key: string]: number;
            };
            /** @description Picks + none; abstain excluded. */
            tally_decisive: number;
            /** @description "None of these" votes. */
            tally_none: number;
            /** @description All voters */
            tally_total: number;
            title: string;
            voting_rule: components["schemas"]["VotingRule"];
            your_choice?: components["schemas"]["Choice"];
        };
        /** @enum {string} */
        ProposalKind: "decision" | "document";
        ProposalListResponse: {
            proposals: components["schemas"]["Proposal"][];
        };
        ProposalSearchHit: {
            id: string;
            /** @enum {string} */
            proposal_kind: "decision" | "document";
            snippet: string;
            /** @enum {string} */
            status: "voting" | "passed" | "rejected" | "quorum_failed" | "withdrawn";
            title: string;
        };
        /** @enum {string} */
        ProposalStatus: "voting" | "passed" | "rejected" | "quorum_failed" | "withdrawn";
        PushSubscribeBody: {
            endpoint: string;
            keys: {
                auth: string;
                p256dh: string;
            };
        };
        PushUnsubscribeBody: {
            endpoint: string;
        };
        Reaction: {
            count: number;
            emoji: string;
            me: boolean;
        };
        ReactionBody: {
            active: boolean;
            emoji: string;
        };
        ReactionResponse: {
            reactions: components["schemas"]["Reaction"][];
        };
        ReadBody: {
            message_id: string;
        };
        /** @description An immutable snapshot of the quoted message (decision 0031). */
        ReplyTo: {
            author_display_name: string;
            id: string;
            /** @enum {string} */
            kind: "text" | "image" | "doc" | "voice";
            preview: string;
        };
        /** @enum {string} */
        Role: "owner" | "admin" | "moderator" | "member" | "observer";
        SearchResponse: {
            query: string;
            sections: {
                channels: {
                    has_more: boolean;
                    hits: components["schemas"]["ChannelSearchHit"][];
                };
                documents: {
                    has_more: boolean;
                    hits: components["schemas"]["DocumentSearchHit"][];
                };
                members: {
                    has_more: boolean;
                    hits: components["schemas"]["MemberSearchHit"][];
                };
                proposals: {
                    has_more: boolean;
                    hits: components["schemas"]["ProposalSearchHit"][];
                };
            };
        };
        SetHandleBody: {
            handle: string;
        };
        SetHandleResponse: {
            handle: string;
        };
        StartDmBody: {
            user_id: string;
        };
        ThreadResponse: {
            parent: components["schemas"]["Message"];
            replies: components["schemas"]["Message"][];
        };
        UpdateCommentBody: {
            body: string;
        };
        UpdateProfileBody: {
            display_name: string;
        };
        UploadRequest: {
            content_type: string;
            ext: string;
        };
        UploadResponse: {
            key: string;
            /** @description Presigned S3 PUT URL (short-lived). */
            put_url: string;
            /** @description Public CDN URL once uploaded. */
            url: string;
        };
        UserProfile: {
            avatar_url?: string | null;
            /** Format: date-time */
            created_at: string;
            display_name: string;
            handle?: string | null;
            /** @enum {string} */
            locale: "en" | "pt";
            /** @enum {string} */
            theme: "system" | "light" | "dark";
            user_id: string;
        };
        /** @enum {string} */
        VotingRule: "plurality" | "simple_majority" | "two_thirds" | "consensus";
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
        CategoryId: string;
        ConversationId: string;
        /** @description Document name (percent-encoded). */
        DocumentName: string;
        MessageId: string;
        ProposalId: string;
        Slug: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getConversation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ConversationId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Conversation — a channel or a DM, discriminated by `kind`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Channel"] | components["schemas"]["DmConversation"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listMessages: {
        parameters: {
            query?: {
                /** @description Return messages older than this message id. */
                before?: string;
            };
            header?: never;
            path: {
                id: components["parameters"]["ConversationId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Messages page. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MessageListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    postMessage: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ConversationId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PostMessageBody"];
            };
        };
        responses: {
            /** @description Message posted. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Message"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    setReaction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ConversationId"];
                mid: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReactionBody"];
            };
        };
        responses: {
            /** @description Updated reactions for the message. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReactionResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    markConversationRead: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ConversationId"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReadBody"];
            };
        };
        responses: {
            /** @description Marker advanced. */
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
    listDms: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The caller's DMs across all projects. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DmListResponse"];
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
    startDm: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StartDmBody"];
            };
        };
        responses: {
            /** @description The (new or existing) DM conversation. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DmConversation"];
                };
            };
            /** @description Cannot DM yourself. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
            /** @description Peer user does not exist. */
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
    getHandleAvailability: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                handle: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Availability of the handle. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HandleAvailability"];
                };
            };
            /** @description Malformed or reserved handle. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
                };
            };
        };
    };
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
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description User profile (created on first call). */
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
    updateMe: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProfileBody"];
            };
        };
        responses: {
            /** @description Updated user profile. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserProfile"];
                };
            };
            /** @description Invalid display name. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
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
    setAvatar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AvatarUploadBody"];
            };
        };
        responses: {
            /** @description Avatar stored. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AvatarResponse"];
                };
            };
            /** @description Not a valid image, too large, or bad base64. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
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
    deleteAvatar: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Avatar removed (falls back to initials). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
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
    setHandle: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetHandleBody"];
            };
        };
        responses: {
            /** @description Handle claimed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SetHandleResponse"];
                };
            };
            /** @description Malformed or reserved handle. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
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
            /** @description Handle already taken by another user. */
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
    listInbox: {
        parameters: {
            query?: {
                /** @description Item id cursor — returns items older than it. */
                before?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Inbox items, newest-first, with the unread count. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InboxListResponse"];
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
    markInboxItemRead: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Marked read. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            /** @description No such item for this user. */
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
    markAllInboxRead: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All marked read. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
        };
    };
    getNotificationPrefs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The caller's notification preferences. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPrefs"];
                };
            };
        };
    };
    putNotificationPrefs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["NotificationPrefs"];
            };
        };
        responses: {
            /** @description Updated preferences. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NotificationPrefs"];
                };
            };
        };
    };
    addPushSubscription: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PushSubscribeBody"];
            };
        };
        responses: {
            /** @description Subscribed. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
        };
    };
    removePushSubscription: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PushUnsubscribeBody"];
            };
        };
        responses: {
            /** @description Removed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
        };
    };
    getThread: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["MessageId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Thread. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ThreadResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
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
    listCategories: {
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
            /** @description Categories, ordered by position. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createCategory: {
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
                "application/json": components["schemas"]["CategoryNameBody"];
            };
        };
        responses: {
            /** @description Category created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Category"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            /** @description A category with that name already exists. */
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
    deleteCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["CategoryId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Category deleted. */
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
            /** @description Category still has proposals, or is the project's last. */
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
    renameCategory: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["CategoryId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryNameBody"];
            };
        };
        responses: {
            /** @description Category renamed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Category"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description A category with that name already exists. */
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
    listChannels: {
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
            /** @description Channels with unread counts + last-message previews. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChannelListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listDocuments: {
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
            /** @description Documents with their current version + active amendment. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    getDocumentByName: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Document name (percent-encoded). */
                name: components["parameters"]["DocumentName"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Document detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentDetail"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
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
    listProposals: {
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
            /** @description Proposals. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
        };
    };
    createProposal: {
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
                "application/json": components["schemas"]["CreateProposalBody"];
            };
        };
        responses: {
            /** @description Proposal (or fork) created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Proposal"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            /** @description Cannot fork a closed deliberation, or a document already has an active deliberation. */
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
    getProposal: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Proposal detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Proposal"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    listComments: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Comments (chronological, including soft-deleted with body omitted). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CommentListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateCommentBody"];
            };
        };
        responses: {
            /** @description Comment created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Comment"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    deleteComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Comment soft-deleted (idempotent). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Comment"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    updateComment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCommentBody"];
            };
        };
        responses: {
            /** @description Comment updated. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Comment"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description Comment was deleted or changed. */
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
    setCommentReaction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                commentId: string;
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReactionBody"];
            };
        };
        responses: {
            /** @description Updated reactions for the comment. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReactionResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    getProposalTree: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Flat deliberation tree, created-ordered. Each node carries the deliberation (root) tally; the client rebuilds nesting from `parent_id`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProposalListResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    castVote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CastVoteBody"];
            };
        };
        responses: {
            /** @description Vote recorded. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            403: components["responses"]["Forbidden"];
            /** @description Voting is closed or your previous vote changed. */
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
    retractVote: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Vote retracted. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Ok"];
                };
            };
            403: components["responses"]["Forbidden"];
            /** @description No current vote to retract. */
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
    withdrawProposal: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["ProposalId"];
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Proposal withdrawn. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Proposal"];
                };
            };
            403: components["responses"]["Forbidden"];
            /** @description Proposal is already closed. */
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
    searchProject: {
        parameters: {
            query?: {
                /** @description Query string; under 2 chars returns empty sections. */
                q?: string;
            };
            header?: never;
            path: {
                slug: components["parameters"]["Slug"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Grouped search hits. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SearchResponse"];
                };
            };
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
        };
    };
    createUpload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UploadRequest"];
            };
        };
        responses: {
            /** @description Presigned upload URL. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UploadResponse"];
                };
            };
            /** @description Unsupported content type. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiError"];
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
