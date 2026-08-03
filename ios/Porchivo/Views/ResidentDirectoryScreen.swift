//
//  ResidentDirectoryScreen.swift
//  Porchivo
//
//  Resident directory — org members with avatars (avatar_url) and initials
//  fallback. Tap to open a direct chat thread.
//

import SwiftUI

struct ResidentDirectoryScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()
    @State private var search = ""
    @State private var loaded = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 12) {
                    searchBar
                    if appState.directory.isEmpty {
                        EmptyState(
                            symbol: "person.3.fill",
                            title: "No neighbors yet",
                            message: "Residents in your building or block will appear here once they join Porchivo."
                        )
                    } else {
                        ForEach(filtered) { entry in
                            NavigationLink(value: Route.chat(threadId(entry.id))) {
                                row(entry)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("Directory")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Route.self) { route in
                RouteView(route: route, path: $path)
            }
        }
        .task {
            if !loaded {
                await appState.loadDirectory()
                loaded = true
            }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass.fill").foregroundStyle(c.textMuted)
            TextField("Search residents", text: $search)
                .font(.system(size: 15))
                .foregroundStyle(c.textPrimary)
                .textInputAutocapitalization(.never)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
    }

    private var filtered: [DirectoryEntry] {
        guard !search.isEmpty else { return appState.directory }
        return appState.directory.filter { $0.name.localizedCaseInsensitiveContains(search) }
    }

    private func row(_ e: DirectoryEntry) -> some View {
        HStack(spacing: 12) {
            AvatarBubble(name: e.name, avatarUrl: e.avatarUrl, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(e.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    if e.isPremium {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 10))
                            .foregroundStyle(c.gold)
                    }
                }
                Text(e.role.label)
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
                if !e.address.isEmpty {
                    Text(e.address)
                        .font(.system(size: 11))
                        .foregroundStyle(c.textMuted)
                }
            }
            Spacer()
            Image(systemName: "message.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(c.accent)
        }
        .padding(Space.md)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 4, y: 2)
    }

    /// Derive a thread id from two member ids (sorted) so both sides see the same thread.
    private func threadId(_ otherId: String) -> String {
        let me = appState.currentUserId ?? "me"
        return [me, otherId].sorted().joined(separator: "__")
    }
}
