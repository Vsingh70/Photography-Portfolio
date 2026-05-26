import SwiftUI

/// Visual vocabulary mirroring the web Studio: cream foreground on near-black,
/// Cormorant Garamond italic for display, DM Mono small-caps for captions.
enum Theme {
    enum Colors {
        static let bg          = Color(red: 0.039, green: 0.039, blue: 0.039)   // #0a0a0a
        static let surface     = Color(red: 0.102, green: 0.102, blue: 0.102)   // #1a1a1a
        static let fg          = Color(red: 0.961, green: 0.953, blue: 0.933)   // #f5f3ee
        static let fgDim       = Color(red: 0.961, green: 0.953, blue: 0.933).opacity(0.55)
        static let fgFaint     = Color(red: 0.961, green: 0.953, blue: 0.933).opacity(0.25)
        static let rule        = Color(red: 0.961, green: 0.953, blue: 0.933).opacity(0.08)
        static let danger      = Color(red: 0.906, green: 0.298, blue: 0.235)   // #e74c3c
        static let warning     = Color(red: 0.831, green: 0.663, blue: 0.243)   // #d4a93e
        static let success     = Color(red: 0.463, green: 0.788, blue: 0.573)   // #76c893
    }

    /// Use system fonts as fallback; if the custom OTF/TTF are added to the
    /// project + Info.plist UIAppFonts, swap the names here.
    enum Fonts {
        static func display(_ size: CGFloat) -> Font {
            // Replace "Cormorant Garamond" with the exact PostScript name of your bundled font.
            .custom("CormorantGaramond-LightItalic", size: size).weight(.light)
        }
        static func displayFallback(_ size: CGFloat) -> Font {
            .system(size: size, weight: .light, design: .serif).italic()
        }
        static func mono(_ size: CGFloat) -> Font {
            .custom("DMMono-Regular", size: size)
        }
        static func monoFallback(_ size: CGFloat) -> Font {
            .system(size: size, design: .monospaced)
        }
    }
}

/// Mono small-caps caption — used for labels, counts, section headers.
struct Cap: View {
    let text: String
    var color: Color = Theme.Colors.fgDim
    var size: CGFloat = 10

    var body: some View {
        Text(text.uppercased())
            .font(Theme.Fonts.mono(size))
            .tracking(2.2)
            .foregroundStyle(color)
    }
}

/// Pill button, three kinds: default (outline cream), primary (filled cream),
/// danger (outline red).
struct Pill: View {
    enum Kind { case `default`, primary, danger }

    let title: String
    var icon: String? = nil
    var kind: Kind = .default
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(title.uppercased())
                    .font(Theme.Fonts.mono(10))
                    .tracking(2.2)
                if let icon { Text(icon) }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(background)
            .foregroundStyle(foreground)
            .overlay(
                Capsule().stroke(border, lineWidth: 1)
            )
            .clipShape(Capsule())
            .opacity(disabled ? 0.4 : 1)
        }
        .disabled(disabled)
        .buttonStyle(.plain)
    }

    private var background: Color {
        switch kind {
        case .default: return .clear
        case .primary: return Theme.Colors.fg
        case .danger:  return .clear
        }
    }
    private var foreground: Color {
        switch kind {
        case .default: return Theme.Colors.fg
        case .primary: return Theme.Colors.bg
        case .danger:  return Theme.Colors.danger
        }
    }
    private var border: Color {
        switch kind {
        case .default: return Theme.Colors.fg.opacity(0.25)
        case .primary: return Theme.Colors.fg
        case .danger:  return Theme.Colors.danger
        }
    }
}

struct HairlineRule: View {
    var body: some View {
        Rectangle()
            .fill(Theme.Colors.rule)
            .frame(height: 1)
    }
}
