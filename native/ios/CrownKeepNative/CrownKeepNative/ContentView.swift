import SwiftUI

struct ContentView: View {
    var body: some View {
        CrownKeepWebView()
            .ignoresSafeArea(.container, edges: .bottom)
    }
}

#Preview {
    ContentView()
}
