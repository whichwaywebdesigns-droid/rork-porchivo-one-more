//
//  DeliveryCountdownView.swift
//  Porchivo
//
//  Live-ticking countdown pill for active package cards.
//  Uses TimelineView for battery-efficient per-second updates.
//  Colour: blue (>24h) → amber (<24h) → red (<1h or overdue).
//  Pulses (scale) when under 1 hour or overdue.
//

import SwiftUI

struct DeliveryCountdownView: View {
    let expectedDeliveryDate: Date
    let isDelivered: Bool
    @Environment(\.porchivo) private var c

    /// Target = end of the expected delivery day (23:59:59).
    private var target: Date {
        Calendar.current.startOfDay(for: expectedDeliveryDate)
            .addingTimeInterval(86_399)
    }

    var body: some View {
        if !isDelivered {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                CountdownPill(
                    remaining: target.timeIntervalSince(context.date),
                    palette: c
                )
            }
        }
    }
}

// MARK: - Pill

private struct CountdownPill: View {
    let remaining: TimeInterval
    let palette: PorchivoPalette
    @State private var pulseScale: CGFloat = 1

    private var state: CountdownState {
        if remaining <= 0 {
            return CountdownState(
                text: "Overdue",
                tone: .danger,
                pulse: true,
                icon: "exclamationmark.triangle.fill"
            )
        }
        let totalSec = Int(remaining)
        let days = totalSec / 86_400
        let hours = (totalSec % 86_400) / 3_600
        let minutes = (totalSec % 3_600) / 60
        let seconds = totalSec % 60

        if days > 0 {
            return CountdownState(text: "\(days)d \(hours)h", tone: .neutral, pulse: false, icon: "timer")
        } else if hours > 0 {
            return CountdownState(text: "\(hours)h \(minutes)m", tone: .amber, pulse: false, icon: "timer")
        } else if minutes > 0 {
            return CountdownState(text: "\(minutes)m \(seconds)s", tone: .danger, pulse: true, icon: "timer")
        } else {
            return CountdownState(text: "\(seconds)s", tone: .danger, pulse: true, icon: "timer")
        }
    }

    private var shouldPulse: Bool { remaining < 3_600 }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: state.icon)
                .font(.system(size: 10, weight: .bold))
            Text(state.text)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .monospacedDigit()
        }
        .foregroundStyle(toneColor)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(toneSoftColor, in: .rect(cornerRadius: Radius.pill))
        .scaleEffect(pulseScale)
        .onAppear { startPulseIfNeeded() }
        .onChange(of: shouldPulse) { _, _ in startPulseIfNeeded() }
    }

    private func startPulseIfNeeded() {
        if shouldPulse {
            withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) {
                pulseScale = 1.12
            }
        } else {
            withAnimation(.easeInOut(duration: 0.2)) {
                pulseScale = 1
            }
        }
    }

    private var toneColor: Color {
        switch state.tone {
        case .neutral: palette.accent
        case .amber: palette.warmOrange
        case .danger: palette.danger
        }
    }

    private var toneSoftColor: Color {
        switch state.tone {
        case .neutral: palette.accentSoft
        case .amber: palette.warmOrangeSoft
        case .danger: palette.dangerSoft
        }
    }
}

// MARK: - Model

private struct CountdownState: Equatable {
    let text: String
    let tone: Tone
    let pulse: Bool
    let icon: String

    enum Tone { case neutral, amber, danger }
}
