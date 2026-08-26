//
//  ChatScreen.swift
//  Porchivo
//
//  Org-scoped chat thread — avatars, message bubbles, send field. Loads
//  `chat_messages` for the thread and appends via SupabaseService.
//

import SwiftUI

struct ChatScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    let threadId: String
    @State private var messages: [ChatMessage] = []
    @State private var draft = ""
    @State private var isSending = false
    @State private var loaded = false
    @State private var blockedIds: Set<String> = []
    @State private var reportTarget: ChatMessage?
    @State private var blockTarget: ChatMessage?
    @State private var showFilterAlert = false

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(visibleMessages) { msg in
                            MessageBubble(message: msg)
                                .id(msg.id)
                                .contextMenu {
                                    if !msg.isMine {
                                        Button {
                                            Haptics.light()
                                            reportTarget = msg
                                        } label: {
                                            Label("Report message", systemImage: "flag")
                                        }
                                        Button {
                                            Haptics.light()
                                            blockTarget = msg
                                        } label: {
                                            Label("Block \(msg.senderName)", systemImage: "person.slash")
                                        }
                                    }
                                }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 12)
                }
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }
            composer
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Chat")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Message not sent", isPresented: $showFilterAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("That message doesn't meet our community guidelines. Please revise it — keep chat respectful for your neighbors.")
        }
        .confirmationDialog("Report \(reportTarget?.senderName ?? "this member")'s message?", isPresented: Binding(
            get: { reportTarget != nil },
            set: { if !$0 { reportTarget = nil } }
        )) {
            ForEach(Self.reportReasons, id: \.self) { reason in
                Button(reason) { submitReport(reason) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Our team reviews reports and can restrict members who violate community rules.")
        }
        .confirmationDialog("Block \(blockTarget?.senderName ?? "this member")?", isPresented: Binding(
            get: { blockTarget != nil },
            set: { if !$0 { blockTarget = nil } }
        ), titleVisibility: .visible) {
            Button("Block", role: .destructive) { submitBlock() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You won't see their messages in this chat. You can unblock them in Settings.")
        }
        .task {
            if !loaded { await load(); loaded = true }
        }
    }

    private static let reportReasons = ["Spam or scam", "Harassment or abuse", "Inappropriate content", "Other"]

    /// Blocked members' messages never render — this is the feed filter
    /// App Store Guideline 1.2 expects.
    private var visibleMessages: [ChatMessage] {
        messages.filter { $0.isMine || !blockedIds.contains($0.senderId) }
    }

    private func submitReport(_ reason: String) {
        guard let msg = reportTarget else { return }
        reportTarget = nil
        Haptics.light()
        guard appState.isSupabaseConfigured else { return }
        Task { @MainActor in
            _ = await SupabaseService.shared.reportChatMessage(messageId: msg.id, reason: reason)
        }
    }

    private func submitBlock() {
        guard let msg = blockTarget else { return }
        blockTarget = nil
        guard let me = appState.currentUserId else { return }
        Haptics.medium()
        blockedIds.insert(msg.senderId)
        withAnimation { messages.removeAll { !$0.isMine && $0.senderId == msg.senderId } }
        guard appState.isSupabaseConfigured else { return }
        Task { @MainActor in
            _ = await SupabaseService.shared.blockUser(
                blockerId: me, userId: msg.senderId, name: msg.senderName)
        }
    }

    private var composer: some View {
        HStack(spacing: 10) {
            TextField("Message…", text: $draft, axis: .vertical)
                .font(.system(size: 15))
                .foregroundStyle(c.textPrimary)
                .lineLimit(1...5)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(c.surface, in: .rect(cornerRadius: Radius.lg))
                .overlay(RoundedRectangle(cornerRadius: Radius.lg).stroke(c.border, lineWidth: 1))
            Button {
                send()
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(draft.isEmpty ? c.textMuted : c.accent)
            }
            .disabled(draft.isEmpty || isSending)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(c.surface.shadow(.drop(color: c.textPrimary.opacity(0.06), radius: 6, y: -2)))
    }

    private func send() {
        guard let user = appState.user, !draft.isEmpty else { return }
        // Pre-publication screen — nothing objectionable ever goes live.
        guard ChatContentFilter.isAcceptable(draft) else {
            Haptics.medium()
            showFilterAlert = true
            return
        }
        let body = draft
        draft = ""
        Haptics.light()
        Task { @MainActor in
            isSending = true
            defer { isSending = false }
            // Optimistic append
            let optimistic = ChatMessage(
                id: UUID().uuidString,
                senderId: user.id,
                senderName: user.name,
                senderAvatarUrl: user.avatarUrl,
                body: body,
                createdAt: Date(),
                isMine: true
            )
            messages.append(optimistic)
            if appState.isSupabaseConfigured {
                _ = await SupabaseService.shared.sendChatMessage(
                    threadId: threadId, body: body, sender: user)
            }
        }
    }

    private func load() async {
        guard appState.isSupabaseConfigured else {
            messages = []
            return
        }
        let result = await SupabaseService.shared.fetchChatMessages(threadId: threadId)
        if case .success(let rows) = result {
            let me = appState.currentUserId ?? ""
            messages = rows.map { Mappers.toChatMessage($0, currentUserId: me) }
        }
        if case .success(let blocked) = await SupabaseService.shared.fetchBlockedUsers() {
            blockedIds = Set(blocked.map(\.blockedId))
        }
    }
}

private struct MessageBubble: View {
    @Environment(\.porchivo) private var c
    let message: ChatMessage

    var body: some View {
        HStack {
            if message.isMine { Spacer(minLength: 60) }
            if !message.isMine {
                AvatarBubble(name: message.senderName, avatarUrl: message.senderAvatarUrl, size: 32)
            }
            VStack(alignment: message.isMine ? .trailing : .leading, spacing: 3) {
                if !message.isMine {
                    Text(message.senderName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(c.textMuted)
                }
                Text(message.body)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(message.isMine ? c.onAccent : c.textPrimary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(message.isMine ? c.accent : c.surface,
                                in: .rect(cornerRadius: Radius.lg))
                    .overlay(
                        !message.isMine
                            ? AnyShapeStyle(c.border.opacity(0.5))
                            : AnyShapeStyle(.clear)
                    )
                Text(timestamp)
                    .font(.system(size: 10))
                    .foregroundStyle(c.textMuted)
            }
            if !message.isMine { Spacer(minLength: 60) }
        }
    }

    private var timestamp: String {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f.string(from: message.createdAt)
    }
}
