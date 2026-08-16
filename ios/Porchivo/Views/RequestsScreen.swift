//
//  RequestsScreen.swift
//  Porchivo
//
//  Community tier tab — maintenance request submission and tracking.
//  Fetches real data via `get_my_maintenance_requests` RPC and submits
//  via `submit_maintenance_request` RPC.
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
                    myRequestsSection
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

    @ViewBuilder
    private var myRequestsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("My Requests")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(c.textPrimary)

            switch appState.maintenanceLoadState {
            case .loading:
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding(.vertical, 40)

            case .error(let msg):
                EmptyState(
                    symbol: "exclamationmark.triangle.fill",
                    title: "Couldn't load requests",
                    message: msg
                )

            default:
                if appState.maintenanceRequests.isEmpty {
                    EmptyState(
                        symbol: "wrench.and.screwdriver.fill",
                        title: "No active requests",
                        message: "Submit a maintenance or service request to your community management."
                    )
                } else {
                    ForEach(appState.maintenanceRequests) { req in
                        MaintenanceRequestCard(request: req)
                    }
                }
            }
        }
    }
}

private struct MaintenanceRequestCard: View {
    @Environment(\.porchivo) private var c
    let request: MaintenanceRequest

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: request.category.sfSymbol)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(c.accent)
                    .frame(width: 36, height: 36)
                    .background(c.accentSoft, in: .rect(cornerRadius: Radius.md))

                VStack(alignment: .leading, spacing: 2) {
                    Text(request.title)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(c.textPrimary)
                        .lineLimit(2)
                    Text(request.category.label)
                        .font(.system(size: 12))
                        .foregroundStyle(c.textSecondary)
                }

                Spacer()

                statusPill
            }

            if let desc = request.description, !desc.isEmpty {
                Text(desc)
                    .font(.system(size: 12))
                    .foregroundStyle(c.textSecondary)
                    .lineLimit(2)
            }

            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .font(.system(size: 10))
                    .foregroundStyle(c.textMuted)
                Text(request.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.system(size: 11))
                    .foregroundStyle(c.textMuted)
                if request.commentCount > 0 {
                    Text("·")
                        .font(.system(size: 11))
                        .foregroundStyle(c.textMuted)
                    Image(systemName: "bubble.left.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(c.textMuted)
                    Text("\(request.commentCount)")
                        .font(.system(size: 11))
                        .foregroundStyle(c.textMuted)
                }
            }
        }
        .padding(12)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
        .shadow(color: c.textPrimary.opacity(0.04), radius: 4, y: 2)
    }

    private var statusPill: some View {
        let tint: Color = request.status == .completed ? c.success
            : (request.status == .cancelled ? c.danger
            : (request.status == .inProgress ? c.warmOrange : c.accent))
        return Text(request.status.label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12), in: .rect(cornerRadius: Radius.sm))
    }
}

/// Sheet for submitting a new maintenance request via `submit_maintenance_request` RPC.
private struct NewMaintenanceRequestSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var category: MaintenanceCategory = .other
    @State private var priority: MaintenancePriority = .normal
    @State private var description = ""
    @State private var location = ""
    @State private var isSubmitting = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    fieldGroup("Title") {
                        TextField("Brief description of the issue", text: $title)
                            .textFieldStyle(.roundedBorder)
                    }
                    fieldGroup("Category") {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 100)), GridItem(.adaptive(minimum: 100))], spacing: 8) {
                            ForEach(MaintenanceCategory.allCases, id: \.self) { cat in
                                categoryChip(cat)
                            }
                        }
                    }
                    fieldGroup("Priority") {
                        Picker("Priority", selection: $priority) {
                            ForEach(MaintenancePriority.allCases, id: \.self) { p in
                                Text(p.label).tag(p)
                            }
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
                    if let err = errorMsg {
                        Text(err)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(c.danger)
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
                        Task { await submit() }
                    }
                    .disabled(title.isEmpty || isSubmitting)
                    .fontWeight(.bold)
                }
            }
        }
    }

    private func categoryChip(_ cat: MaintenanceCategory) -> some View {
        let isSelected = cat == category
        return Button(action: { Haptics.selection(); category = cat }) {
            HStack(spacing: 6) {
                Image(systemName: cat.sfSymbol)
                    .font(.system(size: 12, weight: .bold))
                Text(cat.label)
                    .font(.system(size: 12, weight: .semibold))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .foregroundStyle(isSelected ? c.onAccent : c.textSecondary)
            .background(isSelected ? c.accent : c.elevated, in: .rect(cornerRadius: Radius.sm))
        }
        .buttonStyle(.plain)
    }

    private func fieldGroup<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(c.textSecondary)
            content()
        }
    }

    @MainActor
    private func submit() async {
        isSubmitting = true
        errorMsg = nil
        let success = await appState.submitMaintenanceRequest(
            category: category,
            priority: priority,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.isEmpty ? nil : description,
            location: location.isEmpty ? nil : location
        )
        isSubmitting = false
        if success {
            Haptics.success()
            dismiss()
        } else {
            errorMsg = "Failed to submit request. Please try again."
            Haptics.error()
        }
    }
}

#Preview {
    RequestsScreen().environment(AppState())
}
