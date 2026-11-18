import SwiftUI
import WidgetKit

/// "Calls waiting" on the Home Screen: the help line's count of calls that wait for a yes, and how long the oldest
/// has waited, on the app's paper. For now it shows the sample conference's figures only, marked as a sample; it
/// reads nothing from the backend. Tapping it opens the help line. In the system's tinted and clear modes the paper
/// is let go and the figure is the accented part.
struct CallsWaitingEntry: TimelineEntry {
    let date: Date
    let waiting: Int
    let oldestDays: Int
}

struct CallsWaitingProvider: TimelineProvider {
    /// The sample conference's help line, as it is laid each night.
    private static let sample = CallsWaitingEntry(date: .now, waiting: 5, oldestDays: 2)

    func placeholder(in context: Context) -> CallsWaitingEntry { Self.sample }
    func getSnapshot(in context: Context, completion: @escaping (CallsWaitingEntry) -> Void) { completion(Self.sample) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<CallsWaitingEntry>) -> Void) {
        completion(Timeline(entries: [Self.sample], policy: .never))
    }
}

/// The widget's words, in the device's language: English or Spanish.
private struct Words {
    let title: String, oldest: (Int) -> String, sample: String, name: String, about: String
    static var current: Words {
        Locale.preferredLanguages.first?.hasPrefix("es") == true
            ? Words(title: "Llamadas por devolver", oldest: { $0 == 1 ? "La más antigua, 1 día" : "La más antigua, \($0) días" }, sample: "Muestra", name: "Llamadas por devolver", about: "Cuántas llamadas de la línea de ayuda esperan un sí.")
            : Words(title: "Calls waiting", oldest: { $0 == 1 ? "Oldest, 1 day" : "Oldest, \($0) days" }, sample: "Sample", name: "Calls waiting", about: "How many help line calls are waiting for a yes.")
    }
}

private let paper = Color(red: 0xf5 / 255, green: 0xf3 / 255, blue: 0xec / 255)
private let ink = Color(red: 0x28 / 255, green: 0x3c / 255, blue: 0x32 / 255)
private let ochre = Color(red: 0x8d / 255, green: 0x63 / 255, blue: 0x1b / 255)

struct CallsWaitingView: View {
    let entry: CallsWaitingEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        let words = Words.current
        let full = mode == .fullColor
        VStack(alignment: .leading, spacing: 4) {
            Text(words.title.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .kerning(1.1)
                .foregroundStyle(full ? ink.opacity(0.75) : .primary)
            Spacer(minLength: 0)
            Text("\(entry.waiting)")
                .font(.system(size: family == .systemSmall ? 54 : 60, weight: .regular, design: .serif))
                .foregroundStyle(full ? ink : .primary)
                .widgetAccentable()
            HStack(spacing: 6) {
                Circle().strokeBorder(full ? ochre : .primary, lineWidth: 2).frame(width: 9, height: 9)
                Text(words.oldest(entry.oldestDays))
                    .font(.system(size: 13))
                    .foregroundStyle(full ? ink : .primary)
            }
            Text(words.sample)
                .font(.system(size: 10, weight: .semibold))
                .kerning(0.8)
                .foregroundStyle(full ? ink.opacity(0.55) : .secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { paper }
        .widgetURL(URL(string: "kindhelps://help-line"))
        .accessibilityElement(children: .combine)
    }
}

struct CallsWaitingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.kindhelps.app.calls-waiting", provider: CallsWaitingProvider()) { entry in
            CallsWaitingView(entry: entry)
        }
        .configurationDisplayName(Words.current.name)
        .description(Words.current.about)
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct KindHelpsWidgets: WidgetBundle {
    var body: some Widget { CallsWaitingWidget() }
}
