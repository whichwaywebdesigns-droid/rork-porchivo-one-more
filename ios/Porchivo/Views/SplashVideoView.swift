//
//  SplashVideoView.swift
//  Porchivo
//
//  Full-screen launch video. Plays the bundled splash video (with its
//  embedded launch chime) once, then holds the final frame so any later
//  loading overlays show a calm static splash.
//

import SwiftUI
import AVKit

struct SplashVideoView: View {
    @State private var player: AVPlayer?

    var body: some View {
        ZStack {
            Color("SplashBackground")
                .ignoresSafeArea()
            if let player {
                SplashVideoLayer(player: player)
                    .ignoresSafeArea()
            } else {
                // Static fallback while the player is being created or if the
                // bundled video is unavailable.
                Image("SplashImage")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .ignoresSafeArea()
            }
        }
        .onAppear {
            guard player == nil else { return }
            guard let url = Bundle.main.url(forResource: "splash_video", withExtension: "mp4") else { return }
            let p = AVPlayer(url: url)
            // Hold the final frame after playback instead of looping
            p.actionAtItemEnd = .pause
            p.isMuted = false
            player = p
            p.play()
        }
        .onDisappear {
            player?.pause()
        }
    }
}

struct SplashVideoLayer: UIViewRepresentable {
    let player: AVPlayer

    final class VideoLayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }
        var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    }

    func makeUIView(context: Context) -> VideoLayerView {
        let view = VideoLayerView()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: VideoLayerView, context: Context) {
        if uiView.playerLayer.player !== player {
            uiView.playerLayer.player = player
        }
    }
}
