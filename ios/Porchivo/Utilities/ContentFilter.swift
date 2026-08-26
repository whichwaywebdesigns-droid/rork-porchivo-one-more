//
//  ContentFilter.swift
//  Porchivo
//
//  Pre-publication objectionable-content screen for org chat (App Store
//  Guideline 1.2). Flags obvious profanity and abuse before a message is
//  sent, complementing post-publication reporting and member blocking.
//

import Foundation

enum ChatContentFilter {
    /// Returns true when the text passes the community screen and may be sent.
    static func isAcceptable(_ text: String) -> Bool {
        for rawWord in text.lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }) {
            let substituted = rawWord.map { substitutions[$0] ?? $0 }
            let lettersOnly = String(substituted.filter(\.isLetter))
            guard !lettersOnly.isEmpty else { continue }
            let collapsed = collapseRepeats(lettersOnly)
            if blockedTerms.contains(collapsed) || blockedTerms.contains(lettersOnly) {
                return false
            }
            for stem in blockedStems where lettersOnly.contains(stem) || collapsed.contains(stem) {
                return false
            }
        }
        return true
    }

    /// Common leetspeak and separator-substitution characters.
    private static let substitutions: [Character: Character] = [
        "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
        "7": "t", "8": "b", "@": "a", "$": "s", "!": "i",
    ]

    /// Matched as whole normalized words only, so ordinary words that merely
    /// contain a substring (e.g. "class") are never flagged.
    private static let blockedTerms: Set<String> = [
        "fuck", "fuk", "fck", "fcuk", "motherfucker", "motherfuck",
        "shit", "shet", "bs", "bullshit",
        "bitch", "biatch", "bitches",
        "asshole", "arsehole", "bastard", "jackass", "dumbass", "dipshit",
        "cunt", "twat", "wanker", "bollocks",
        "dick", "dickhead", "cock", "cocksucker",
        "whore", "slut", "skank",
        "blowjob", "handjob", "cumshot", "jizz",
        "retard", "retarded", "spastic",
    ]

    /// Matched anywhere in a word — reserved for the most serious slur stems,
    /// where an exact-match-only rule would be trivially evaded.
    private static let blockedStems: [String] = [
        "nigg", "fagg",
    ]

    private static func collapseRepeats(_ word: String) -> String {
        var result = ""
        var last: Character?
        for ch in word {
            if ch != last { result.append(ch) }
            last = ch
        }
        return result
    }
}
