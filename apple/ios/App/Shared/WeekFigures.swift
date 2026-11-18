import Foundation

/// The week's three counts the Home Screen widget shows, shared from the app to its widget through the app group.
/// Counts only: no name, no number, no note. Written when This week is kept on the device (KeptRoom), for someone
/// who may see them; let go with the kept room (sign-out, or another member); the widget then shows none.
struct WeekFigures: Codable, Equatable {
    let callsWaiting: Int
    let oldestWaitingDays: Int
    let visitsPlanned: Int
    let requestsOpen: Int
    /// The sample conference's own figures, marked as the sample's.
    let sample: Bool

    static let group = "group.com.kindhelps.app"
    private static let key = "week-figures"

    static func read() -> WeekFigures? {
        guard let data = UserDefaults(suiteName: group)?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WeekFigures.self, from: data)
    }

    static func write(_ figures: WeekFigures?) {
        let shelf = UserDefaults(suiteName: group)
        if let figures, let data = try? JSONEncoder().encode(figures) { shelf?.set(data, forKey: key) } else { shelf?.removeObject(forKey: key) }
    }
}
