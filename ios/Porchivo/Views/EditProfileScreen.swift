//
//  EditProfileScreen.swift
//  Porchivo
//
//  Edit profile — avatar upload to Supabase Storage, remove photo, and edit
//  name/phone/address. Uses PhotosPicker (iOS 16+) and the AppState avatar
//  pipeline (upload → profiles.avatar_url).
//

import SwiftUI
import PhotosUI

struct EditProfileScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var phone = ""
    @State private var address = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var isUploading = false
    @State private var showRemoveConfirm = false
    @State private var saved = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                avatarSection
                field("Full name", text: $name, symbol: "person.fill")
                field("Phone", text: $phone, symbol: "phone.fill", keyboard: .phonePad)
                field("Street address", text: $address, symbol: "mappin.and.ellipse")
                PrimaryButton(title: "Save changes", systemImage: "checkmark.circle.fill",
                              isLoading: isUploading, action: save, enabled: !name.isEmpty)
                if saved {
                    Label("Saved", systemImage: "checkmark.seal.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(c.success)
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Edit Profile")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Remove your profile photo?", isPresented: $showRemoveConfirm) {
            Button("Remove photo", role: .destructive) { removePhoto() }
            Button("Cancel", role: .cancel) {}
        }
        .onAppear { populate() }
    }

    private var avatarSection: some View {
        VStack(spacing: 12) {
            AvatarBubble(name: name.isEmpty ? "Porchivo User" : name,
                         avatarUrl: appState.user?.avatarUrl, size: 96)
            HStack(spacing: 10) {
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label("Change Photo", systemImage: "image.plus")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(c.onAccent)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .background(c.accent, in: .rect(cornerRadius: Radius.sm))
                }
                .buttonStyle(.borderless)

                if appState.user?.avatarUrl != nil {
                    Button {
                        Haptics.light()
                        showRemoveConfirm = true
                    } label: {
                        Label("Remove", systemImage: "trash.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(c.danger)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 9)
                            .background(c.dangerSoft, in: .rect(cornerRadius: Radius.sm))
                    }
                    .buttonStyle(.borderless)
                }
            }
            if isUploading {
                ProgressView("Uploading…").tint(c.accent)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .onChange(of: photoItem) { _, _ in uploadPhoto() }
    }

    private func field(_ label: String, text: Binding<String>, symbol: String,
                       keyboard: UIKeyboardType = .default) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            HStack(spacing: 10) {
                Image(systemName: symbol).foregroundStyle(c.textMuted)
                TextField("", text: text)
                    .font(.system(size: 15))
                    .foregroundStyle(c.textPrimary)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(keyboard == .phonePad ? .never : .words)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(c.surface, in: .rect(cornerRadius: Radius.md))
            .overlay(RoundedRectangle(cornerRadius: Radius.md).stroke(c.border, lineWidth: 1))
        }
    }

    private func populate() {
        guard let u = appState.user else { return }
        name = u.name
        phone = u.phone
        address = u.address
    }

    private func uploadPhoto() {
        guard let item = photoItem else { return }
        isUploading = true
        Task { @MainActor in
            defer { isUploading = false }
            guard let data = try? await item.loadTransferable(type: Data.self) else { return }
            let ext = detectExt(from: data)
            let ok = await appState.uploadAvatar(data: data, ext: ext)
            if ok { Haptics.success() } else { Haptics.error() }
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

    private func save() {
        isUploading = true
        let n = name, p = phone, a = address
        Task { @MainActor in
            defer { isUploading = false }
            guard let u = appState.user else { return }
            if appState.isSupabaseConfigured {
                _ = await SupabaseService.shared.updateProfile(userId: u.id, [
                    "name": n, "phone": p, "address": a,
                ])
            }
            appState.user?.name = n
            appState.user?.phone = p
            appState.user?.address = a
            withAnimation { saved = true }
            Haptics.success()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                dismiss()
            }
        }
    }

    /// Detect image format from magic bytes; default to jpeg.
    private func detectExt(from data: Data) -> String {
        if data.count > 12, data[0] == 0x89, data[1] == 0x50, data[2] == 0x4E, data[3] == 0x47 { return "png" }
        if data.count > 12, data[0] == 0x52, data[1] == 0x49, data[2] == 0x46, data[3] == 0x46 { return "webp" }
        return "jpeg"
    }
}
