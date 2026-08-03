//
//  SafetyScreen.swift
//  Porchivo
//
//  Porch risk breakdown — gauge, contributing factors, theft stats, tips.
//

import SwiftUI

struct SafetyScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                gaugeCard
                factorsCard
                statsCard
                tipsCard
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Safety Score")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var gaugeCard: some View {
        let score = RiskEngine.score(appState.shipments)
        let level = RiskEngine.level(score)
        let tint: Color = level == .high ? c.danger : (level == .medium ? c.warmOrange : c.success)
        return Card {
            VStack(spacing: 12) {
                ZStack {
                    Circle().stroke(c.elevated, lineWidth: 14)
                    Circle()
                        .trim(from: 0, to: CGFloat(score) / 100)
                        .stroke(tint, style: StrokeStyle(lineWidth: 14, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.spring, value: score)
                    VStack(spacing: 0) {
                        Text("\(score)")
                            .font(.system(size: 40, weight: .black))
                            .foregroundStyle(c.textPrimary)
                        Text("/ 100")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(c.textMuted)
                    }
                }
                .frame(width: 160, height: 160)
                Text(level.label)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(tint)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(tint.opacity(0.12), in: .capsule)
            }
            .frame(maxWidth: .infinity)
        }
    }

    private var factorsCard: some View {
        let factors = RiskEngine.factors(appState.shipments)
        return Card {
            VStack(alignment: .leading, spacing: 12) {
                Text("Contributing factors")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                ForEach(factors) { f in
                    HStack {
                        Image(systemName: f.delta < 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                            .foregroundStyle(f.delta < 0 ? c.success : c.warmOrange)
                        Text(f.label)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(c.textPrimary)
                        Spacer()
                        Text(f.delta > 0 ? "+\(f.delta)" : "\(f.delta)")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(f.delta < 0 ? c.success : c.warmOrange)
                    }
                }
            }
        }
    }

    private var statsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Theft on your block")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                statRow("\(AppConfig.SocialProof.packagesStolenStat)", "packages stolen in the US last year")
                statRow("\(AppConfig.SocialProof.stolenRatio)", "households hit by porch piracy")
                statRow("90%", "drop in theft when a neighbor picks up packages")
            }
        }
    }

    private func statRow(_ value: String, _ label: String) -> some View {
        HStack(spacing: 12) {
            Text(value)
                .font(.system(size: 22, weight: .black))
                .foregroundStyle(c.accent)
                .frame(width: 70, alignment: .leading)
            Text(label)
                .font(.system(size: 12))
                .foregroundStyle(c.textSecondary)
        }
    }

    private var tipsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Lower your risk")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                tip("Assign a Porch Partner for active deliveries", "person.2.fill", c.success)
                tip("Add drop-off instructions for couriers", "text.bubble.fill", c.accent)
                tip("Keep deliveries in daytime windows when possible", "sun.max.fill", c.warmOrange)
                tip("Install a doorbell camera for visible deterrence", "video.fill", c.danger)
            }
        }
    }

    private func tip(_ text: String, _ symbol: String, _ tint: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol).foregroundStyle(tint)
            Text(text).font(.system(size: 13, weight: .medium)).foregroundStyle(c.textPrimary)
            Spacer()
        }
    }
}
