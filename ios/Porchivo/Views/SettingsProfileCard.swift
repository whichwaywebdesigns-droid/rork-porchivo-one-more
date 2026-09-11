//
//  SettingsProfileCard.swift
//  Porchivo
//
//  Resident profile picture management for dashboard settings — parity with
//  the Expo settings ProfileCard. Uploads immediately on pick (unlike Edit
//  Profile, which stages until Save) through the AppState avatar pipeline
//  (upload → profiles.avatar_url), and best-effort removes the previous
//  Storage object so uploads don't accumulate.
//

import SwiftUI
import PhotosUI

struct SettingsProfileCard: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var photoItem: PhotosPickerItem?
    @State private var isUploading = false
    @State private var showRemoveConfirm = false
    @State private var errorMessage: String?

    private let maxBytes = 5 * 1024 * 1024

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                avatarPicker
                VStack(alignment: .leading, spacing: 3) {
                    Text(displayName)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                        .lineLimit(1)
                    Text(appState.user?.email ?? "")
                        .font(.system(size: 12))
                        .foregroundStyle(c.textMuted)
                        .lineLimit(1)
                    HStack(spacing: 8) {
                        PhotosPicker(selection: $photoItem, matching: .images) {
                            Label(appState.user?.avatarUrl != nil ? "Change photo" : "Upload photo",
                                  systemImage: "photo.badge.plus")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(c.accent)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(c.accentSoft, in: .capsule)
                        }
                        .buttonStyle(.borderless)
                        .disabled(isUploading)

                        if appState.user?.avatarUrl != nil {
                            Button {
                                Haptics.light()
                                showRemoveConfirm = true
                            } label: {
                                Label("Remove", systemImage: "trash")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(c.danger)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(c.dangerSoft, in: .capsule)
                            }
                            .buttonStyle(.borderless)
                            .disabled(isUploading)
                        }
                    }
                    .padding(.top, 4)
                }
                Spacer(minLength: 0)
            }
            .padding(14)

            Divider().overlay(c.border).padding(.leading, 14)

            NavigationLink(value: Route.editProfile) {
                HStack(spacing: 12) {
                    Image(systemName: "person.crop.circle")
                        .foregroundStyle(c.accent)
                        .frame(width: 22)
                    Text("Edit profile")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(c.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundStyle(c.textMuted)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)
        }
        .confirmationDialog("Remove your profile photo?", isPresented: $showRemoveConfirm) {
            Button("Remove photo", role: .destructive) { removePhoto() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your profile picture will be removed and replaced with your initial.")
        }
        .alert("Photo upload failed",
               isPresented: Binding(
                   get: { errorMessage != nil },
                   set: { if !$0 { errorMessage = nil } }
               )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .onChange(of: photoItem) { _, newValue in
            guard newValue != nil else { return }
            Task { await uploadPicked() }
        }
    }

    private var displayName: String {
        let name = appState.user?.name ?? ""
        return name.isEmpty ? "Your profile" : name
    }

    private var avatarPicker: some View {
        PhotosPicker(selection: $photoItem, matching: .images) {
            ZStack(alignment: .bottomTrailing) {
                AvatarBubble(name: appState.user?.name ?? "",
                             avatarUrl: appState.user?.avatarUrl,
                             size: 72)
                if isUploading {
                    ZStack {
                        Circle().fill(Color.black.opacity(0.45))
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.7)
                    }
                    .frame(width: 72, height: 72)
                } else {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(c.accent))
                        .overlay(Circle().stroke(c.surface, lineWidth: 2))
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(isUploading)
        .accessibilityLabel(appState.user?.avatarUrl != nil
                            ? "Change profile picture"
                            : "Upload profile picture")
    }

    private func uploadPicked() async {
        guard let item = photoItem else { return }
        isUploading = true
        defer { isUploading = false; photoItem = nil }
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            errorMessage = "Could not read that photo. Please try again."
            return
        }
        guard data.count <= maxBytes else {
            Haptics.error()
            errorMessage = "That photo is larger than 5 MB. Please choose a smaller image."
            return
        }
        let ok = await appState.uploadAvatar(data: data, ext: detectExt(from: data))
        if ok {
            Haptics.success()
        } else {
            Haptics.error()
            errorMessage = "Could not upload your photo. Please try again."
        }
    }

    private func removePhoto() {
        isUploading = true
        Task { @MainActor in
            defer { isUploading = false }
            await appState.updateAvatarUrl(nil, removeOld: true)
            Haptics.success()
        }
    }

    /// Detect image format from magic bytes; default to jpeg.
    private func detectExt(from data: Data) -> String {
        if data.count > 12, data[0] == 0x89, data[1] == 0x50, data[2] == 0x4E, data[3] == 0x47 { return "png" }
        if data.count > 12, data[0] == 0x52, data[1] == 0x49, data[2] == 0x46, data[3] == 0x46 { return "webp" }
        return "jpeg"
    }
}
