import SwiftUI
import WidgetKit

/// "Calls waiting" on the Home Screen, on the app's paper: the signed-in conference's week as the app last kept it
/// (WeekFigures, shared through the app group), counts only. Small: the help line's calls waiting and how long the
/// oldest has waited. Medium: that, beside visits planned and requests awaiting a yes. The sample conference's
/// figures are marked as the sample's; with nothing kept (signed out, or not allowed to see them) it asks to open the
/// app. Tapping it opens the help line. In the tinted and clear modes the paper is let go and the figures are accented.
struct CallsWaitingEntry: TimelineEntry {
    let date: Date
    let figures: WeekFigures?
}

struct CallsWaitingProvider: TimelineProvider {
    func placeholder(in context: Context) -> CallsWaitingEntry {
        CallsWaitingEntry(date: .now, figures: WeekFigures(callsWaiting: 5, oldestWaitingDays: 2, visitsPlanned: 4, requestsOpen: 5, sample: true))
    }
    func getSnapshot(in context: Context, completion: @escaping (CallsWaitingEntry) -> Void) {
        completion(context.isPreview && WeekFigures.read() == nil ? placeholder(in: context) : CallsWaitingEntry(date: .now, figures: WeekFigures.read()))
    }
    /// The app reloads the timeline whenever it keeps new figures or lets them go; nothing is asked of the backend here.
    func getTimeline(in context: Context, completion: @escaping (Timeline<CallsWaitingEntry>) -> Void) {
        completion(Timeline(entries: [CallsWaitingEntry(date: .now, figures: WeekFigures.read())], policy: .never))
    }
}

private let paper = Color(red: 0xf5 / 255, green: 0xf3 / 255, blue: 0xec / 255)
private let ink = Color(red: 0x28 / 255, green: 0x3c / 255, blue: 0x32 / 255)
private let ochre = Color(red: 0x8d / 255, green: 0x63 / 255, blue: 0x1b / 255)

struct CallsWaitingView: View {
    let entry: CallsWaitingEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var mode

    private var full: Bool { mode == .fullColor }
    private var words: NativeWords { .current }

    var body: some View {
        Group {
            if let figures = entry.figures {
                if family == .systemMedium { medium(figures) } else { small(figures) }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    caption(words.callsWaiting)
                    Spacer(minLength: 0)
                    Text(words.openToSee)
                        .font(.system(size: 15, design: .serif))
                        .foregroundStyle(full ? ink : .primary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .containerBackground(for: .widget) { paper }
        .widgetURL(URL(string: "kindhelps://help-line"))
        .accessibilityElement(children: .combine)
    }

    private func caption(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .kerning(1.1)
            .lineLimit(2)
            .foregroundStyle(full ? ink.opacity(0.75) : .primary)
    }

    private func figure(_ value: Int, size: CGFloat) -> some View {
        Text("\(value)")
            .font(.system(size: size, weight: .regular, design: .serif))
            .foregroundStyle(full ? ink : .primary)
            .widgetAccentable()
    }

    private func sampleMark(_ figures: WeekFigures) -> some View {
        Text(figures.sample ? words.sample : " ")
            .font(.system(size: 10, weight: .semibold))
            .kerning(0.8)
            .foregroundStyle(full ? ink.opacity(0.55) : .secondary)
    }

    private func oldest(_ figures: WeekFigures) -> some View {
        HStack(spacing: 6) {
            Circle().strokeBorder(full ? ochre : .primary, lineWidth: 2).frame(width: 9, height: 9)
            Text(words.oldest(figures.oldestWaitingDays))
                .font(.system(size: 13))
                .foregroundStyle(full ? ink : .primary)
        }
        .opacity(figures.callsWaiting > 0 ? 1 : 0)
    }

    private func small(_ figures: WeekFigures) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            caption(words.callsWaiting)
            Spacer(minLength: 0)
            figure(figures.callsWaiting, size: 54)
            oldest(figures)
            sampleMark(figures)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    /// Three columns of the week's paper, the help line's first, ruled apart as the room's own figures are.
    private func medium(_ figures: WeekFigures) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top, spacing: 0) {
                column(words.callsWaiting, figures.callsWaiting)
                rule
                column(words.visitsPlanned, figures.visitsPlanned)
                rule
                column(words.requestsWaiting, figures.requestsOpen)
            }
            Spacer(minLength: 0)
            HStack {
                oldest(figures)
                Spacer(minLength: 8)
                sampleMark(figures)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var rule: some View {
        Rectangle().fill(full ? ink.opacity(0.15) : Color.primary.opacity(0.3)).frame(width: 1).padding(.horizontal, 10)
    }

    private func column(_ title: String, _ value: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            caption(title)
                .frame(height: 30, alignment: .topLeading)
            figure(value, size: 44)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
