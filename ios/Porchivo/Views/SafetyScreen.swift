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
            .padding(.bottom, 120)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Safety Score")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var gaugeCard: some View {
        let safety = SafetyScore.value(fromRisk: RiskEngine.score(appState.shipments))
        let band = SafetyScore.band(safety)
        let tint: Color = band == .high ? c.danger : (band == .medium ? c.warmOrange : c.success)
        return Card {
            VStack(spacing: 12) {
                NeedleGaugeView(score: safety, riskLabel: band.label, scoreColor: tint)
                Text("Higher is safer — protections add points, risks subtract them.")
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
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
                    let safetyDelta = -f.delta
                    HStack {
                        Image(systemName: safetyDelta > 0 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                            .foregroundStyle(safetyDelta > 0 ? c.success : c.warmOrange)
                        Text(f.label)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(c.textPrimary)
                        Spacer()
                        Text(safetyDelta > 0 ? "+\(safetyDelta)" : "\(safetyDelta)")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(safetyDelta > 0 ? c.success : c.warmOrange)
                    }
                }
            }
        }
    }

    private var statsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Package theft in the U.S.")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                statRow("\(AppConfig.SocialProof.packagesStolenStat)", "packages stolen in the US last year — SafeWise 2025 report")
                statRow("\(AppConfig.SocialProof.stolenRatio)", "Americans have had a package stolen — Security.org 2025 survey")
                statRow("$15B", "lost to porch piracy last year — SafeWise 2025 report")
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
                Text("Raise your score")
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
