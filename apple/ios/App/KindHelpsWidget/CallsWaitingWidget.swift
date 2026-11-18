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

private let paper = Color(red: 0xf5 / 255, green: 0xf3 / 255, blue: 0xec / 255)
private let ink = Color(red: 0x28 / 255, green: 0x3c / 255, blue: 0x32 / 255)
private let ochre = Color(red: 0x8d / 255, green: 0x63 / 255, blue: 0x1b / 255)

struct CallsWaitingView: View {
    let entry: CallsWaitingEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        let words = NativeWords.current
        let full = mode == .fullColor
        VStack(alignment: .leading, spacing: 4) {
            Text(words.callsWaiting.uppercased())
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
        .configurationDisplayName(NativeWords.current.callsWaiting)
        .description(NativeWords.current.callsWaitingAbout)
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct KindHelpsWidgets: WidgetBundle {
    var body: some Widget { CallsWaitingWidget() }
}
