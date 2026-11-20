import Foundation

/// Every word the app says natively, in English and Spanish, in one place: the launch cover, the Home Screen's
/// quick actions, the undo, and the widget. Sentence case; a full stop only where it is a sentence. The rooms'
/// own words come from the page. The language is the device's, as the page's sign-in sheet uses until someone chooses.
struct NativeWords {
    let opening: String
    let slow: String
    let tryAgain: String
    let quickWeek: String
    let quickHelpLine: String
    let quickVisit: String
    let undo: String
    let callsWaiting: String
    let callsWaitingAbout: String
    let oldest: (Int) -> String
    let sample: String
    let visitsPlanned: String
    let requestsWaiting: String
    let openToSee: String

    static let en = NativeWords(
        opening: "Opening…",
        slow: "This is taking longer than usual.",
        tryAgain: "Try again",
        quickWeek: "This week",
        quickHelpLine: "Help line",
        quickVisit: "Home visits",
        undo: "Undo",
        callsWaiting: "Calls waiting",
        callsWaitingAbout: "How many help line calls are waiting for a call back.",
        oldest: { $0 == 0 ? "Oldest, today" : $0 == 1 ? "Oldest, 1 day" : "Oldest, \($0) days" },
        sample: "Sample",
        visitsPlanned: "Visits planned",
        requestsWaiting: "Requests to decide",
        openToSee: "Open Kind Helps to see your week."
    )

    static let es = NativeWords(
        opening: "Abriendo…",
        slow: "Esto está tardando más de lo normal.",
        tryAgain: "Intentar de nuevo",
        quickWeek: "Esta semana",
        quickHelpLine: "Línea de ayuda",
        quickVisit: "Visitas",
        undo: "Deshacer",
        callsWaiting: "Llamadas por devolver",
        callsWaitingAbout: "Cuántas llamadas de la línea de ayuda esperan que les devuelvan la llamada.",
        oldest: { $0 == 0 ? "La más antigua, de hoy" : $0 == 1 ? "La más antigua, 1 día" : "La más antigua, \($0) días" },
        sample: "Muestra",
        visitsPlanned: "Visitas planeadas",
        requestsWaiting: "Peticiones por decidir",
        openToSee: "Abre Kind Helps para ver tu semana."
    )

    /// The device's language: Spanish where it is first, English otherwise.
    static var current: NativeWords { Locale.preferredLanguages.first?.hasPrefix("es") == true ? es : en }
}
