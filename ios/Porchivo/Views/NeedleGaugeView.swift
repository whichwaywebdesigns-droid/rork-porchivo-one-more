//
//  NeedleGaugeView.swift
//  Porchivo
//
//  Animated needle gauge for safety scores (higher = safer).
//  240° arc; zones run red → orange → green left to right, so a safe
//  score always lands the needle in the green zone on the right.
//  Soft glow is faked with layered strokes — no blur filters.
//  Sweeps for 1.4s with an eased count-up on appear; Reduce Motion
//  jumps straight to the final position and skips the badge pulse.
//

import SwiftUI

private let gaugeStart: Double = 150
private let gaugeSweep: Double = 240
private let gaugeRadiusInset: CGFloat = 26

// MARK: - Shapes

private struct ArcShape: Shape {
    let start: Angle
    let end: Angle

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addArc(
            center: CGPoint(x: rect.midX, y: rect.midY),
            radius: min(rect.width, rect.height) / 2 - gaugeRadiusInset,
            startAngle: start,
            endAngle: end,
            clockwise: false
        )
        return path
    }
}

private struct GaugeTicksShape: Shape {
    let major: Bool

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2 - gaugeRadiusInset
        for i in 0...10 {
            guard (i % 5 == 0) == major else { continue }
            let radians = (gaugeStart + Double(i) * gaugeSweep / 10) * .pi / 180
            let inner = radius + (major ? 9 : 11)
            let outer = radius + (major ? 21 : 17)
            path.move(to: CGPoint(
                x: center.x + CGFloat(cos(radians)) * inner,
                y: center.y + CGFloat(sin(radians)) * inner
            ))
            path.addLine(to: CGPoint(
                x: center.x + CGFloat(cos(radians)) * outer,
                y: center.y + CGFloat(sin(radians)) * outer
            ))
        }
        return path
    }
}

private struct NeedleShape: Shape {
    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let length = min(rect.width, rect.height) / 2 - gaugeRadiusInset - 18
        var path = Path()
        path.move(to: CGPoint(x: center.x, y: center.y - length))
        path.addLine(to: CGPoint(x: center.x - 3, y: center.y + 6))
        path.addLine(to: CGPoint(x: center.x, y: center.y + 12))
        path.addLine(to: CGPoint(x: center.x + 3, y: center.y + 6))
        path.closeSubpath()
        return path
    }
}

// MARK: - View

struct NeedleGaugeView: View {
    let score: Int
    let riskLabel: String
    var scoreColor: Color
    var size: CGFloat = 250

    @Environment(\.porchivo) private var c
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animatedScore: Double = 0
    @State private var isPulsing = false
    @State private var animationTask: Task<Void, Never>?

    private var clamped: Double { Double(max(0, min(100, score))) }
    // Needle artwork points straight up (270°); rotate to land on 150° + progress × 240°.
    private var needleRotation: Double { gaugeStart + animatedScore * gaugeSweep / 100 - 270 }
    private var needleLength: CGFloat { size / 2 - gaugeRadiusInset - 18 }

    private static let zoneColors: [Color] = [
        Color(hex: 0xEF4444),
        Color(hex: 0xE8611A),
        Color(hex: 0x4ADE80),
    ]
    private static let arcGlow: [(width: CGFloat, opacity: Double)] = [
        (22, 0.15), (30, 0.06),
    ]
    private static let needleGlow: [(width: CGFloat, opacity: Double)] = [
        (9, 0.15), (17, 0.06),
    ]

    var body: some View {
        VStack(spacing: -12) {
            gauge
                .frame(width: size, height: size)
                .accessibilityElement()
                .accessibilityLabel("Safety score \(max(0, min(100, score))) out of 100, \(riskLabel)")
            badge
        }
        .onAppear {
            startAnimation()
            startPulse()
        }
        .onChange(of: score) { _, _ in startAnimation() }
        .onDisappear { animationTask?.cancel() }
    }

    private var gauge: some View {
        ZStack {
            // Track
            ArcShape(start: .degrees(gaugeStart), end: .degrees(gaugeStart + gaugeSweep))
                .stroke(Color(hex: 0x1B3A6B).opacity(0.4), style: StrokeStyle(lineWidth: 14, lineCap: .round))

            // Soft glow behind the zones (layered strokes)
            ForEach(0..<2, id: \.self) { layer in
                ForEach(0..<3, id: \.self) { zone in
                    ArcShape(
                        start: .degrees(gaugeStart + Double(zone) * 80),
                        end: .degrees(gaugeStart + Double(zone + 1) * 80)
                    )
                    .stroke(
                        Self.zoneColors[zone].opacity(Self.arcGlow[layer].opacity),
                        style: StrokeStyle(lineWidth: Self.arcGlow[layer].width, lineCap: .butt)
                    )
                }
            }

            // Zones (red left → green right)
            ForEach(0..<3, id: \.self) { zone in
                ArcShape(
                    start: .degrees(gaugeStart + Double(zone) * 80),
                    end: .degrees(gaugeStart + Double(zone + 1) * 80)
                )
                .stroke(Self.zoneColors[zone], style: StrokeStyle(lineWidth: 14, lineCap: .butt))
            }

            // Ticks — longer at 0 / 50 / 100
            GaugeTicksShape(major: false)
                .stroke(Color(hex: 0x1B3A6B).opacity(0.28), lineWidth: 1.5)
            GaugeTicksShape(major: true)
                .stroke(Color(hex: 0x1B3A6B).opacity(0.5), lineWidth: 2.5)

            // Needle + its glow, rotating around the hub
            ZStack {
                ForEach(0..<2, id: \.self) { layer in
                    Capsule()
                        .fill(Color.white.opacity(Self.needleGlow[layer].opacity))
                        .frame(width: Self.needleGlow[layer].width, height: needleLength)
                        .offset(y: -needleLength / 2)
                }
                NeedleShape()
                    .fill(Color.white)
                    .overlay(NeedleShape().stroke(Color(hex: 0x1B3A6B), lineWidth: 1.2))
            }
            .rotationEffect(.degrees(needleRotation))

            // Hub: navy dot with thin orange ring
            ZStack {
                Circle()
                    .stroke(Color(hex: 0xE8611A), lineWidth: 2)
                    .frame(width: 26, height: 26)
                Circle()
                    .fill(Color(hex: 0x1B3A6B))
                    .frame(width: 20, height: 20)
            }
        }
        .overlay(alignment: .bottom) {
            VStack(spacing: 0) {
                Text("\(Int(animatedScore.rounded()))")
                    .font(.system(size: 40, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(scoreColor)
                    .shadow(color: scoreColor.opacity(0.35), radius: 8)
                Text("out of 100")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(c.textMuted)
            }
            .padding(.bottom, size * 0.10)
        }
    }

    private var badge: some View {
        Text(riskLabel.uppercased())
            .font(.system(size: 12, weight: .heavy))
            .tracking(1.2)
            .foregroundStyle(scoreColor)
            .padding(.horizontal, 16)
            .padding(.vertical, 7)
            .background(c.surface, in: Capsule())
            .overlay(Capsule().stroke(scoreColor, lineWidth: 1.5))
            .shadow(color: scoreColor.opacity(isPulsing ? 0.4 : 0.12), radius: 8)
    }

    private func startAnimation() {
        animationTask?.cancel()
        guard !reduceMotion else {
            animatedScore = clamped
            return
        }
        animatedScore = 0
        let target = clamped
        animationTask = Task { @MainActor in
            let start = Date()
            let duration: TimeInterval = 1.4
            while !Task.isCancelled {
                let t = min(Date().timeIntervalSince(start) / duration, 1)
                let eased = 1 - pow(1 - t, 3) // ease-out cubic
                animatedScore = target * eased
                if t >= 1 { break }
                try? await Task.sleep(for: .milliseconds(16))
            }
        }
    }

    private func startPulse() {
        guard !reduceMotion else { return }
        withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
            isPulsing = true
        }
    }
}
