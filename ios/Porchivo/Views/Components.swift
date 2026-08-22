//
//  Components.swift
//  Porchivo
//
//  Shared UI primitives used across screens — cards, pills, avatars, buttons,
//  empty states, section headers. Native SwiftUI, Porchivo-themed.
//

import SwiftUI

// MARK: - Card

struct Card<Content: View>: View {
    @Environment(\.porchivo) private var c
    let padding: CGFloat
    let action: (() -> Void)?
    @ViewBuilder let content: Content

    init(padding: CGFloat = Space.lg, action: (() -> Void)? = nil, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.action = action
        self.content = content()
    }

    var body: some View {
        if let action {
            Button(action: action) { inner }
                .buttonStyle(PressableCardStyle())
        } else {
            inner
        }
    }

    private var inner: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(c.surface)
            .clipShape(.rect(cornerRadius: Radius.lg))
            .shadow(color: c.textPrimary.opacity(0.06), radius: 8, y: 3)
    }
}

// MARK: - Pill / Badge

struct Pill: View {
    @Environment(\.porchivo) private var c
    let text: String
    let tint: Color
    let softTint: Color

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(softTint, in: .rect(cornerRadius: Radius.sm))
    }
}

// MARK: - StatusPill for shipment/package statuses

struct StatusPill: View {
    @Environment(\.porchivo) private var c
    let status: ShipmentStatus

    var body: some View {
        let (label, tint): (String, Color) = {
            switch status {
            case .open: return ("Open", c.accent)
            case .accepted: return ("Accepted", c.success)
            case .completed: return ("Completed", c.textMuted)
            case .cancelled: return ("Cancelled", c.danger)
            }
        }()
        Pill(text: label, tint: tint, softTint: tint.opacity(0.12))
    }
}

// MARK: - AvatarBubble

struct AvatarBubble: View {
    @Environment(\.porchivo) private var c
    let name: String
    let avatarUrl: String?
    let size: CGFloat

    init(name: String, avatarUrl: String? = nil, size: CGFloat = 40) {
        self.name = name
        self.avatarUrl = avatarUrl
        self.size = size
    }

    var body: some View {
        let initials = Self.initials(name)
        Color.clear
            .frame(width: size, height: size)
            .overlay {
                if let url = avatarUrl, let parsed = URL(string: url) {
                    AsyncImage(url: parsed) { phase in
                        switch phase {
                        case .empty, .failure:
                            placeholder(initials)
                        case .success(let img):
                            img.resizable().scaledToFill()
                                .frame(width: size, height: size)
                                .clipShape(.circle)
                                .allowsHitTesting(false)
                        @unknown default:
                            placeholder(initials)
                        }
                    }
                } else {
                    placeholder(initials)
                }
            }
            .frame(width: size, height: size)
            .clipShape(.circle)
    }

    private func placeholder(_ initials: String) -> some View {
        ZStack {
            c.accentSoft
            Text(initials)
                .font(.system(size: size * 0.36, weight: .bold))
                .foregroundStyle(c.accent)
        }
    }

    static func initials(_ name: String) -> String {
        let parts = name.split(separator: " ").map { String($0) }
        let first = parts.first?.first.map { String($0) } ?? ""
        let second = parts.count > 1 ? (parts.last?.first.map { String($0) } ?? "") : ""
        return (first + second).uppercased()
    }
}

// MARK: - EmptyState

struct EmptyState: View {
    @Environment(\.porchivo) private var c
    let symbol: String
    let title: String
    let message: String
    let ctaLabel: String?
    let onCta: (() -> Void)?

    init(symbol: String, title: String, message: String, ctaLabel: String? = nil, onCta: (() -> Void)? = nil) {
        self.symbol = symbol
        self.title = title
        self.message = message
        self.ctaLabel = ctaLabel
        self.onCta = onCta
    }

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 36, weight: .semibold))
                .foregroundStyle(c.textMuted)
            Text(title)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(c.textPrimary)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(c.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 240)
            if let ctaLabel, let onCta {
                Button(ctaLabel, action: onCta)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(c.onAccent)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(c.accent, in: .rect(cornerRadius: Radius.md))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

// MARK: - PrimaryButton

struct PrimaryButton: View {
    @Environment(\.porchivo) private var c
    let title: String
    var systemImage: String? = nil
    var isLoading: Bool = false
    var tint: Color? = nil
    let action: () -> Void
    var enabled: Bool = true

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(c.onAccent)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
                    .font(.system(size: 16, weight: .bold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(enabled ? c.onAccent : c.textMuted)
            .background((tint ?? c.accent).opacity(enabled ? 1 : 0.4),
                        in: .rect(cornerRadius: Radius.md))
        }
        .disabled(!enabled || isLoading)
    }
}

// MARK: - SectionHeader

struct SectionHeader: View {
    @Environment(\.porchivo) private var c
    let title: String
    var trailing: String? = nil

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)
            Spacer()
            if let trailing {
                Text(trailing)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(c.accent)
            }
        }
    }
}

// MARK: - Chip (filter / selectable)

struct Chip: View {
    @Environment(\.porchivo) private var c
    let label: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(selected ? c.onAccent : c.textSecondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(selected ? c.accent : c.elevated,
                            in: .capsule)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Haptics

import UIKit

enum Haptics {
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func medium() { UIImpactFeedbackGenerator(style: .medium).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
    static func selection() { UISelectionFeedbackGenerator().selectionChanged() }
}

// MARK: - ShipmentCard

struct ShipmentCard: View {
    @Environment(\.porchivo) private var c
    let shipment: Shipment

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: shipment.carrier.sfSymbol)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(c.accent)
                    .frame(width: 38, height: 38)
                    .background(c.accentSoft, in: .rect(cornerRadius: Radius.md))
                VStack(alignment: .leading, spacing: 2) {
                    Text(shipment.carrier.label)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text(shipment.packagesExpected)
                        .font(.system(size: 12))
                        .foregroundStyle(c.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                StatusPill(status: shipment.status)
            }
            HStack(spacing: 14) {
                Label(shipment.deliveryStatus.label, systemImage: "truck.box.fill")
                Label(shipment.preferredReturnTime, systemImage: "clock.fill")
            }
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(c.textSecondary)
            .lineLimit(1)
        }
        .padding(Space.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(c.surface)
        .clipShape(.rect(cornerRadius: Radius.lg))
        .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
    }
}
