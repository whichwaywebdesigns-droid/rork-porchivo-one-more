//
//  ContentFilter.swift
//  Porchivo
//
//  Client-side objectionable-content screening for user-posted text
//  (App Store Guideline 1.2). Matching text is blocked before upload.
//

enum ContentFilter {
    /// Substrings that always block submission (case-insensitive match).
    private static let blockedWords: [String] = [
        "fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nigga",
        "faggot", "whore", "slut", "rape", "porn", "nazi",
        "kill yourself", "kys",
    ]

    /// Returns a user-facing reason when the text contains objectionable
    /// content, or nil when the text is acceptable.
    static func objectionableReason(in text: String) -> String? {
        let lowered = text.lowercased()
        if blockedWords.contains(where: lowered.contains) {
            return "Your announcement contains language that isn't allowed on Porchivo. Please revise it and try again."
        }
        return nil
    }
}
