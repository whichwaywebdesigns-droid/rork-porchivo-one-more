//
//  RequestsScreen.swift
//  Porchivo
//
//  Community tier tab — maintenance request submission and tracking.
//  Shown when user has an active org membership.
//

import SwiftUI

struct RequestsScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @State private var path = NavigationPath()
    @State private var showNewRequest = false

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(spacing: 16) {
                    newRequestCard
                    activeRequestsSection
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 24)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("Requests")
            .sheet(isPresented: $showNewRequest) {
                NewMaintenanceRequestSheet()
            }
        }
    }

    private var newRequestCard: some View {
        Button(action: { Haptics.light(); showNewRequest = true }) {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(c.accentSoft)
                    Image(systemName: "plus")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(c.accent)
                }
                .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Submit a Request")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(c.textPrimary)
                    Text("Maintenance, repairs, or general issues")
                        .font(.system(size: 12))
                        .foregroundStyle(c.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(c.textMuted)
            }
            .padding(14)
            .background(c.surface, in: .rect(cornerRadius: Radius.lg))
            .shadow(color: c.textPrimary.opacity(0.05), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
    }

    private var activeRequestsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("My Requests")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            EmptyState(
                symbol: "wrench.and.screwdriver.fill",
                title: "No active requests",
                message: "Submit a maintenance or service request to your community management."
            )
        }
    }
}

/// Sheet for submitting a new maintenance request.
private struct NewMaintenanceRequestSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var category = "General"
    @State private var priority = "Normal"
    @State private var description = ""
    @State private var location = ""

    private let categories = ["General", "Plumbing", "Electrical", "HVAC", "Appliance", "Structural", "Landscaping", "Other"]
    private let priorities = ["Low", "Normal", "High", "Urgent"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    fieldGroup("Title") {
                        TextField("Brief description of the issue", text: $title)
                            .textFieldStyle(.roundedBorder)
                    }
                    fieldGroup("Category") {
                        Picker("Category", selection: $category) {
                            ForEach(categories, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.menu)
                    }
                    fieldGroup("Priority") {
                        Picker("Priority", selection: $priority) {
                            ForEach(priorities, id: \.self) { Text($0).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }
                    fieldGroup("Location (optional)") {
                        TextField("e.g. Kitchen, Unit 2B", text: $location)
                            .textFieldStyle(.roundedBorder)
                    }
                    fieldGroup("Description") {
                        TextEditor(text: $description)
                            .frame(minHeight: 100)
                            .padding(8)
                            .background(c.elevated, in: .rect(cornerRadius: Radius.sm))
                    }
                }
                .padding(16)
            }
            .background(c.background.ignoresSafeArea())
            .navigationTitle("New Request")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Submit") {
                        Haptics.success()
                        dismiss()
                    }
                    .disabled(title.isEmpty)
                    .fontWeight(.bold)
                }
            }
        }
    }

    private func fieldGroup<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            content()
        }
    }
}

#Preview {
    RequestsScreen().environment(AppState())
}
