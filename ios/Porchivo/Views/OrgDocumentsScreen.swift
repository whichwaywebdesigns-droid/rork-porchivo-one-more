//
//  OrgDocumentsScreen.swift
//  Porchivo
//
//  Document Library — org-scoped (every community plan, Starter and up).
//  All active members browse; staff add external links or upload photos to
//  the private `org-documents` bucket and remove entries. Mirrors the Expo
//  `app/org-documents.tsx` screen against the same tables/RLS/storage bucket.
//

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct OrgDocumentsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var showAdd = false
    @State private var name = ""
    @State private var url = ""
    @State private var addError: String?
    @State private var adding = false
    @State private var uploading = false
    @State private var photoItem: PhotosPickerItem?
    @State private var pendingDelete: OrgDocument?
    @State private var openError: String?

    private var isStaff: Bool { appState.isOrgAdmin }

    var body: some View {
        Group {
            if !appState.isOrgMember {
                EmptyState(
                    symbol: "folder",
                    title: "Join a community",
                    message: "The document library holds your HOA's bylaws, budgets, and notices. Ask your board for an invite to unlock it."
                )
            } else {
                content
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Document Library")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isStaff {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.selection()
                        showAdd = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .task {
            if let orgId = appState.orgMembership?.orgId {
                await appState.loadOrgDocuments(orgId: orgId)
            }
        }
        .sheet(isPresented: $showAdd) { addSheet }
        .confirmationDialog(
            "Remove \"\(pendingDelete?.name ?? "")\" from the library?",
            isPresented: Binding(
                get: { pendingDelete != nil },
                set: { if !$0 { pendingDelete = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                if let doc = pendingDelete {
                    Task {
                        if let msg = await appState.removeOrgDocument(doc) {
                            openError = msg
                        }
                    }
                }
                pendingDelete = nil
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        }
        .alert("Could not open document", isPresented: Binding(
            get: { openError != nil },
            set: { if !$0 { openError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(openError ?? "")
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch appState.orgDocumentsLoadState {
        case .loading:
            VStack { Spacer(); ProgressView(); Spacer() }
        case .error(let message):
            EmptyState(symbol: "exclamationmark.triangle", title: "Could not load", message: message)
        default:
            if appState.orgDocuments.isEmpty {
                EmptyState(
                    symbol: "folder",
                    title: "No documents yet",
                    message: isStaff
                        ? "Add your bylaws, budgets, meeting minutes, and community notices."
                        : "Your board will post bylaws, budgets, and notices here."
                )
            } else {
                ScrollView {
                    VStack(spacing: 10) {
                        ForEach(appState.orgDocuments, id: \.id) { doc in
                            documentRow(doc)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
            }
        }
    }

    private func documentRow(_ doc: OrgDocument) -> some View {
        Button {
            Haptics.light()
            openDocument(doc)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: doc.externalUrl != nil ? "link" : "doc.text")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.success)
                    .frame(width: 42, height: 42)
                    .background(c.successSoft, in: .rect(cornerRadius: Radius.md))
                VStack(alignment: .leading, spacing: 2) {
                    Text(doc.name)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                        .lineLimit(1)
                    Text(metaText(doc))
                        .font(.system(size: 12))
                        .foregroundStyle(c.textMuted)
                }
                Spacer()
                if isStaff {
                    Button {
                        Haptics.light()
                        pendingDelete = doc
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                            .foregroundStyle(c.danger)
                    }
                    .buttonStyle(.plain)
                } else {
                    Image(systemName: "arrow.up.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(c.textMuted)
                }
            }
            .padding(14)
            .background(c.surface, in: .rect(cornerRadius: Radius.md))
        }
        .buttonStyle(.plain)
    }

    private func metaText(_ doc: OrgDocument) -> String {
        var parts = [doc.externalUrl != nil ? "External link" : "File"]
        if let created = doc.createdAt, let date = parseSupabaseDate(created) {
            parts.append(date.formatted(date: .abbreviated, time: .omitted))
        }
        return parts.joined(separator: " · ")
    }

    private func openDocument(_ doc: OrgDocument) {
        if let external = doc.externalUrl, let url = URL(string: external) {
            UIApplication.shared.open(url)
            return
        }
        guard doc.filePath != nil else { return }
        Task {
            let result = await appState.openOrgDocument(doc)
            switch result {
            case .success(let url):
                _ = await UIApplication.shared.open(url)
            case .failure:
                openError = "The link expired — try again."
            }
        }
    }

    // MARK: - Add sheet (staff)

    private var addSheet: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Add Document")
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(c.textPrimary)
                .frame(maxWidth: .infinity)
            TextField("Document name (e.g. 2026 Budget)", text: $name)
                .textFieldStyle(.roundedBorder)
            TextField("Link (https://…)", text: $url)
                .textFieldStyle(.roundedBorder)
                .keyboardType(.URL)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
            PhotosPicker(selection: $photoItem, matching: .images) {
                HStack(spacing: 8) {
                    if uploading {
                        ProgressView()
                    } else {
                        Image(systemName: "photo.badge.plus")
                    }
                    Text(uploading ? "Uploading…" : "Upload a photo instead")
                        .font(.system(size: 14, weight: .semibold))
                }
                .foregroundStyle(c.accent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border))
            }
            .disabled(uploading)
            if let addError {
                Text(addError)
                    .font(.system(size: 12))
                    .foregroundStyle(c.danger)
            }
            HStack(spacing: 10) {
                Button {
                    showAdd = false
                    resetAdd()
                } label: {
                    Text("Cancel")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(c.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(c.surface, in: .rect(cornerRadius: Radius.md))
                        .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border))
                }
                .disabled(adding || uploading)
                Button {
                    addLink()
                } label: {
                    if adding {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    } else {
                        Text("Add Link")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                    }
                }
                .background(c.accent, in: .rect(cornerRadius: Radius.md))
                .disabled(!canAddLink || adding || uploading)
            }
        }
        .padding(20)
        .presentationDetents([.medium])
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            photoItem = nil
            uploadPhoto(item)
        }
    }

    private var canAddLink: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !url.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func resetAdd() {
        name = ""
        url = ""
        addError = nil
        photoItem = nil
    }

    private func addLink() {
        let trimmedUrl = url.trimmingCharacters(in: .whitespaces)
        guard trimmedUrl.lowercased().hasPrefix("http://") || trimmedUrl.lowercased().hasPrefix("https://") else {
            addError = "Link must start with http:// or https://"
            return
        }
        adding = true
        Task {
            let msg = await appState.addOrgDocumentLink(
                name: name.trimmingCharacters(in: .whitespaces),
                url: trimmedUrl
            )
            adding = false
            if let msg {
                addError = msg
            } else {
                Haptics.success()
                showAdd = false
                resetAdd()
            }
        }
    }

    /// Photo-library upload → private `org-documents` bucket under `{orgId}/…`.
    private func uploadPhoto(_ item: PhotosPickerItem) {
        uploading = true
        Task {
            defer { uploading = false }
            guard let data = try? await item.loadTransferable(type: Data.self) else {
                openError = "Could not read the selected photo."
                return
            }
            if data.count > 25 * 1024 * 1024 {
                openError = "File is too large — the limit is 25 MB."
                return
            }
            let ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
            let mime = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            let fallback = "Photo \(Date().formatted(date: .abbreviated, time: .omitted))"
            let docName = name.trimmingCharacters(in: .whitespaces).isEmpty ? fallback : name
            let msg = await appState.uploadOrgDocument(
                name: String(docName.prefix(120)),
                data: data,
                ext: ext,
                mime: mime
            )
            if let msg {
                openError = msg
            } else {
                Haptics.success()
                showAdd = false
                resetAdd()
            }
        }
    }
}

/// Parses PostgREST timestamps, with and without fractional seconds.
func parseSupabaseDate(_ value: String) -> Date? {
    if let date = ISO8601DateFormatter().date(from: value) { return date }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value)
}

#Preview {
    OrgDocumentsScreen().environment(AppState())
}
