//
//  UpgradeScreen.swift
//  Porchivo
//
//  Informational screen for HOA-provisioned model.
//  No IAP, no paywall, no pricing. Explains that access is provided
//  by the user's HOA or property manager.
//

import SwiftUI

struct UpgradeScreen: View {
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                Image(systemName: "building.2.fill")
                    .font(.system(size: 40, weight: .black))
                    .foregroundStyle(c.accent)
                    .padding(.top, 20)

                Text("Porchivo Access")
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(c.textPrimary)

                Text("Porchivo access is provided by your homeowners association or property manager. Contact your community administrator for an invitation.")
                    .font(.system(size: 14))
                    .foregroundStyle(c.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)

                Divider()
                    .padding(.vertical, 8)

                Text("If your community is not yet on Porchivo, have your HOA board or property manager visit porchivo.com to get started.")
                    .font(.system(size: 13))
                    .foregroundStyle(c.textMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)

                Button {
                    if let url = URL(string: "mailto:support@porchivo.com") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "envelope.fill")
                        Text("Contact Support")
                    }
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(c.accent, in: .rect(cornerRadius: Radius.lg))
                }
                .padding(.horizontal, 24)
                .padding(.top, 8)

                Button {
                    if let url = URL(string: "https://porchivo.com") {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Text("Visit porchivo.com")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(c.accent)
                }
                .padding(.top, 4)
            }
            .padding(.bottom, 32)
        }
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Access")
        .navigationBarTitleDisplayMode(.inline)
    }
}
