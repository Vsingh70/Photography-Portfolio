import SwiftUI
import UIKit

struct ThumbView: View {
    let file: UploadFile
    let index: Int
    let setName: String
    let selected: Bool
    let onTap: () -> Void

    var renderedName: String {
        setName.isEmpty ? "(\(index + 1))" : "\(setName) (\(index + 1))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topLeading) {
                Group {
                    if let data = file.imageData, let uiImage = UIImage(data: data) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } else {
                        Theme.Colors.surface
                            .overlay(
                                Cap(text: "Re-attach", color: Theme.Colors.warning, size: 9)
                            )
                    }
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(0.8, contentMode: .fit)
                .clipped()

                if selected {
                    Circle()
                        .fill(Theme.Colors.fg)
                        .frame(width: 22, height: 22)
                        .overlay(Text("\u{2713}").font(.system(size: 12)).foregroundStyle(Theme.Colors.bg))
                        .padding(6)
                }
                if file.duplicate && !file.isMissing {
                    HStack {
                        Spacer()
                        Text("DUP")
                            .font(Theme.Fonts.mono(8))
                            .tracking(1.5)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Theme.Colors.danger.opacity(0.85))
                    }
                    .padding(6)
                }
            }
            HStack {
                Text(renderedName)
                    .font(Theme.Fonts.displayFallback(13))
                    .foregroundStyle(Theme.Colors.fg)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Cap(text: formatBytes(file.size), color: Theme.Colors.fgDim, size: 8)
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
        }
        .background(Theme.Colors.surface)
        .overlay(
            Rectangle().stroke(
                selected ? Theme.Colors.fg : Theme.Colors.fg.opacity(0.08),
                lineWidth: selected ? 2 : 1
            )
        )
        .contentShape(Rectangle())
        .onTapGesture(perform: onTap)
    }
}

func formatBytes(_ b: Int) -> String {
    if b < 1024 { return "\(b) B" }
    if b < 1024 * 1024 { return String(format: "%.1f KB", Double(b) / 1024) }
    return String(format: "%.1f MB", Double(b) / (1024 * 1024))
}
