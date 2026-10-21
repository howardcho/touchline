import SwiftUI

@main
struct TouchlineApp: App {
    var body: some Scene {
        WindowGroup { TouchlineWebView().ignoresSafeArea() }
    }
}

struct TouchlineWebView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> TouchlineViewController { TouchlineViewController() }
    func updateUIViewController(_ controller: TouchlineViewController, context: Context) {}
}
