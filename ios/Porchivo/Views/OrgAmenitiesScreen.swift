//
//  OrgAmenitiesScreen.swift
//  Porchivo
//
//  Amenity Reservations — Community / Professional / Property Manager plans.
//  Members book hourly slots (8 AM–8 PM); staff manage the amenity list and
//  can cancel any booking. Double-booking is blocked by a DB-level GiST
//  exclusion constraint (surfaces as SlotTakenError). Mirrors the Expo
//  `app/amenity-reservations.tsx` screen against the same tables/RLS.
//

import SwiftUI

private let firstBookableHour = 8
private let lastStartHour = 19

/// Keyword → emoji mapping, ported from the Expo amenity-reservations screen.
func amenityEmoji(_ name: String) -> String {
    let n = name.lowercased()
    if n.contains("pool") { return "🏊" }
    if n.contains("gym") || n.contains("fitness") { return "💪" }
    if n.contains("club") { return "🏛️" }
    if n.contains("tennis") || n.contains("court") || n.contains("pickle") { return "🎾" }
    if n.contains("bbq") || n.contains("grill") { return "🔥" }
    if n.contains("park") || n.contains("garden") { return "🌳" }
    if n.contains("lounge") || n.contains("library") { return "🛋️" }
    if n.contains("dog") || n.contains("pet") { return "🐕" }
    return "🏷️"
}

struct OrgAmenitiesScreen: View {
    @Environment(AppState.self) private var appState
    @Environment(\.porchivo) private var c

    @State private var showReserve = false
    @State private var showAddAmenity = false
    @State private var newAmenityName = ""
    @State private var addAmenityError: String?
    @State private var addingAmenity = false
    @State private var pendingRemoveAmenity: OrgAmenity?
    @State private var justBooked = false
    @State private var reserveError: String?

    private var isStaff: Bool { appState.isOrgAdmin }
    private var currentUserId: String? {
        if case .authenticated(let id) = appState.authState { return id }
        return nil
    }

    private var amenityNameById: [String: String] {
        Dictionary(uniqueKeysWithValues: appState.orgAmenities.map { ($0.id, $0.name) })
    }

    var body: some View {
        Group {
            if !appState.isOrgMember {
                EmptyState(
                    symbol: "calendar.badge.clock",
                    title: "Join a community",
                    message: "Reserve the pool, clubhouse, and more once your HOA or property joins Porchivo."
                )
            } else if !appState.isAmenityPlanAllowed {
                EmptyState(
                    symbol: "calendar.badge.clock",
                    title: "Community feature",
                    message: "Amenity reservations are available on the Community plan and up. Ask your board to upgrade your community's plan."
                )
            } else {
                content
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(c.background.ignoresSafeArea())
        .navigationTitle("Amenity Reservations")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isStaff, appState.isAmenityPlanAllowed {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.selection()
                        showAddAmenity = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
        }
        .task {
            if let orgId = appState.orgMembership?.orgId {
                await appState.loadOrgAmenitiesSection(orgId: orgId)
            }
        }
        .sheet(isPresented: $showReserve) { reserveSheet }
        .alert("Add Amenity", isPresented: $showAddAmenity) {
            TextField("Name (e.g. Pool, Clubhouse)", text: $newAmenityName)
            Button("Add") { addAmenity() }
            Button("Cancel", role: .cancel) { newAmenityName = ""; addAmenityError = nil }
        } message: {
            if let addAmenityError {
                Text(addAmenityError)
            }
        }
        .confirmationDialog(
            "Remove \(pendingRemoveAmenity?.name ?? "") and its reservations?",
            isPresented: Binding(
                get: { pendingRemoveAmenity != nil },
                set: { if !$0 { pendingRemoveAmenity = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Remove", role: .destructive) {
                if let amenity = pendingRemoveAmenity {
                    Task { await appState.removeOrgAmenity(amenity) }
                }
                pendingRemoveAmenity = nil
            }
            Button("Cancel", role: .cancel) { pendingRemoveAmenity = nil }
        }
        .alert("Just booked", isPresented: $justBooked) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Someone grabbed that slot first. Pick another time.")
        }
        .alert("Could not reserve", isPresented: Binding(
            get: { reserveError != nil },
            set: { if !$0 { reserveError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(reserveError ?? "")
        }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if appState.orgAmenitiesLoadState == .loading || appState.orgReservationsLoadState == .loading {
            VStack { Spacer(); ProgressView(); Spacer() }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    amenitiesSection
                    upcomingSection
                    if !appState.orgAmenities.isEmpty {
                        Button {
                            Haptics.selection()
                            showReserve = true
                        } label: {
                            Label("Reserve a Slot", systemImage: "figure.pool.swim")
                                .font(.system(size: 15, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(c.accent, in: .rect(cornerRadius: Radius.md))
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 24)
            }
        }
    }

    private var amenitiesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Amenities")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(c.textPrimary)
            if appState.orgAmenities.isEmpty {
                Text(isStaff
                     ? "Add the amenities residents can book — pool, clubhouse, tennis court…"
                     : "No amenities have been added yet.")
                    .font(.system(size: 13))
                    .foregroundStyle(c.textMuted)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(appState.orgAmenities, id: \.id) { amenity in
                            amenityChip(amenity)
                        }
                        if isStaff {
                            Button {
                                Haptics.selection()
                                showAddAmenity = true
                            } label: {
                                HStack(spacing: 5) {
                                    Image(systemName: "plus")
                                        .font(.system(size: 11, weight: .bold))
                                    Text("Add")
                                        .font(.system(size: 13, weight: .semibold))
                                }
                                .foregroundStyle(c.accent)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 7)
                                .background(c.accentSoft, in: Capsule())
                            }
                        }
                    }
                    .padding(.vertical, 1)
                }
            }
        }
    }

    private func amenityChip(_ amenity: OrgAmenity) -> some View {
        HStack(spacing: 6) {
            Text(amenityEmoji(amenity.name))
                .font(.system(size: 13))
            Text(amenity.name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(c.textPrimary)
            if isStaff {
                Button {
                    Haptics.light()
                    pendingRemoveAmenity = amenity
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(c.textMuted)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(c.surface, in: Capsule())
        .overlay(Capsule().stroke(c.border))
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Upcoming")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(c.textPrimary)
            if appState.orgReservations.isEmpty {
                EmptyState(
                    symbol: "calendar.badge.clock",
                    title: "No reservations yet",
                    message: "Book your first time slot below."
                )
            } else {
                ForEach(appState.orgReservations, id: \.id) { reservation in
                    reservationRow(reservation)
                }
                let mineCount = appState.orgReservations
                    .filter { $0.reservedBy == currentUserId }.count
                if mineCount > 0 {
                    Text("You have \(mineCount) upcoming \(mineCount == 1 ? "booking" : "bookings").")
                        .font(.system(size: 12))
                        .foregroundStyle(c.textMuted)
                }
            }
        }
    }

    private func reservationRow(_ reservation: OrgAmenityReservation) -> some View {
        let amenity = amenityNameById[reservation.amenityId] ?? "Amenity"
        let isMine = reservation.reservedBy == currentUserId
        return HStack(spacing: 12) {
            Text(amenityEmoji(amenity))
                .font(.system(size: 18))
                .frame(width: 42, height: 42)
                .background(c.accentSoft, in: .rect(cornerRadius: Radius.md))
            VStack(alignment: .leading, spacing: 2) {
                Text(isMine ? "\(amenity) · You" : amenity)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(c.textPrimary)
                if let start = parseSupabaseDate(reservation.startsAt),
                   let end = parseSupabaseDate(reservation.endsAt) {
                    Text("\(start.formatted(date: .abbreviated, time: .omitted)) · \(start.formatted(date: .omitted, time: .shortened)) – \(end.formatted(date: .omitted, time: .shortened))")
                        .font(.system(size: 12))
                        .foregroundStyle(c.textMuted)
                }
                if !isMine, let booker = reservation.member?.name, !booker.isEmpty {
                    Text("Reserved by \(booker)")
                        .font(.system(size: 12))
                        .foregroundStyle(c.textMuted)
                        .lineLimit(1)
                }
            }
            Spacer()
            if isMine || isStaff {
                Button {
                    Haptics.light()
                    Task {
                        if let orgId = appState.orgMembership?.orgId {
                            _ = await appState.cancelOrgReservation(id: reservation.id)
                            await appState.loadOrgReservations(orgId: orgId)
                        }
                    }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(c.danger)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(c.surface, in: .rect(cornerRadius: Radius.md))
    }

    // MARK: - Reserve sheet

    private var reserveSheet: some View {
        ReserveSlotSheet(
            amenities: appState.orgAmenities,
            reservations: appState.orgReservations
        ) { amenityId, start, end in
            let outcome = await appState.reserveAmenity(amenityId: amenityId, startsAt: start, endsAt: end)
            switch outcome {
            case .success:
                Haptics.success()
                return true
            case .slotTaken:
                justBooked = true
                return false
            case .failure(let message):
                reserveError = message
                return false
            }
        }
        .presentationDetents([.medium, .large])
        .presentationContentInteraction(.scrolls)
    }

    private func addAmenity() {
        let trimmed = newAmenityName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        addingAmenity = true
        Task {
            let msg = await appState.addOrgAmenity(name: trimmed)
            addingAmenity = false
            if let msg {
                addAmenityError = msg
            } else {
                Haptics.success()
                newAmenityName = ""
                addAmenityError = nil
                showAddAmenity = false
            }
        }
    }
}

// MARK: - Reserve slot sheet

/// Amenity chips × 14-day chips × 1-hour slot grid (8 AM–8 PM starts,
/// past/booked slots disabled). Tapping a free slot books it.
private struct ReserveSlotSheet: View {
    @Environment(\.porchivo) private var c
    let amenities: [OrgAmenity]
    let reservations: [OrgAmenityReservation]
    /// Returns true when the booking succeeded (sheet dismisses).
    let onReserve: (String, Date, Date) async -> Bool

    @State private var pickedAmenityId: String?
    @State private var pickedDayOffset = 0
    @State private var isBooking = false

    private var days: [Date] {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: Date())
        return (0..<14).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
    }

    private var pickedAmenity: OrgAmenity? {
        amenities.first { $0.id == pickedAmenityId }
    }

    private var pickedDay: Date? {
        days.indices.contains(pickedDayOffset) ? days[pickedDayOffset] : nil
    }

    private func isSlotTaken(_ hour: Int) -> Bool {
        guard let day = pickedDay else { return false }
        let calendar = Calendar.current
        return reservations.contains { reservation in
            guard reservation.amenityId == pickedAmenityId,
                  let start = parseSupabaseDate(reservation.startsAt) else { return false }
            return calendar.isDate(start, inSameDayAs: day) && calendar.component(.hour, from: start) == hour
        }
    }

    private func slotStart(_ hour: Int) -> Date? {
        guard let day = pickedDay else { return nil }
        return Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: day)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reserve a Slot")
                .font(.system(size: 18, weight: .heavy))
                .foregroundStyle(c.textPrimary)
                .frame(maxWidth: .infinity)

            if amenities.isEmpty {
                EmptyState(
                    symbol: "figure.pool.swim",
                    title: "No amenities",
                    message: "Your board hasn't added any amenities yet."
                )
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(amenities, id: \.id) { amenity in
                            let selected = amenity.id == pickedAmenityId
                            Button {
                                Haptics.selection()
                                pickedAmenityId = amenity.id
                            } label: {
                                Text("\(amenityEmoji(amenity.name)) \(amenity.name)")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(selected ? .white : c.textPrimary)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .background(selected ? c.accent : c.surface, in: Capsule())
                                    .overlay(Capsule().stroke(selected ? Color.clear : c.border))
                            }
                        }
                    }
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(Array(days.enumerated()), id: \.offset) { index, day in
                            let selected = index == pickedDayOffset
                            Button {
                                Haptics.selection()
                                pickedDayOffset = index
                            } label: {
                                VStack(spacing: 1) {
                                    Text(day.formatted(.dateTime.weekday(.abbreviated)))
                                    Text(day.formatted(.dateTime.month().day()))
                                }
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(selected ? .white : c.textSecondary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(selected ? c.accent : c.surface, in: .rect(cornerRadius: Radius.sm))
                                .overlay(RoundedRectangle(cornerRadius: Radius.sm).stroke(selected ? Color.clear : c.border))
                            }
                        }
                    }
                }

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 74), spacing: 8)], spacing: 8) {
                    ForEach(firstBookableHour...lastStartHour, id: \.self) { hour in
                        slotChip(hour)
                    }
                }

                Spacer(minLength: 0)
            }
        }
        .padding(20)
        .onAppear {
            if pickedAmenityId == nil {
                pickedAmenityId = amenities.first?.id
            }
        }
    }

    @ViewBuilder
    private func slotChip(_ hour: Int) -> some View {
        let taken = isSlotTaken(hour)
        let start = slotStart(hour)
        let isPast = (start ?? .distantPast) < Date()
        let enabled = !taken && !isPast && !isBooking && pickedAmenityId != nil
        Button {
            guard let start else { return }
            isBooking = true
            let end = start.addingTimeInterval(3600)
            Task {
                let ok = await onReserve(pickedAmenityId ?? "", start, end)
                isBooking = false
                if ok {
                    // Parent dismisses via sheet binding on success refresh;
                    // stay open so users can book more slots.
                }
            }
        } label: {
            Text(start?.formatted(date: .omitted, time: .shortened) ?? "")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(enabled ? .white : c.textMuted)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 9)
                .background(
                    (taken || isPast) ? c.surface : c.accent,
                    in: .rect(cornerRadius: Radius.sm)
                )
                .overlay(RoundedRectangle(cornerRadius: Radius.sm).stroke((taken || isPast) ? c.border : Color.clear))
        }
        .disabled(!enabled)
    }
}

#Preview {
    OrgAmenitiesScreen().environment(AppState())
}
