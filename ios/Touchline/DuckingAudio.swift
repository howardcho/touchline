import AVFoundation

// Only activate during cues, then release the session so music returns to normal.
final class DuckingAudio: NSObject, AVAudioPlayerDelegate {
    private static let duckLead: TimeInterval = 0.5
    private struct Clip { let url: URL; let duration: TimeInterval }
    private struct Pending { let group: String; let task: DispatchWorkItem }
    private var clips: [String: Clip] = [:]
    private var players: [UUID: AVAudioPlayer] = [:]
    private var groups: [UUID: String] = [:]
    private var pending: [UUID: Pending] = [:]
    private var releaseTask: DispatchWorkItem?
    private var sessionActive = false
    private var primedUntil = Date.distantPast
    private var interruptionObserver: NSObjectProtocol?

    override init() {
        super.init()
        interruptionObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] _ in self?.stop() }
    }

    func handle(_ command: [String: Any]) throws -> Any? {
        switch command["action"] as? String {
        case "prepare":
            if clips.isEmpty { try loadClips() }
            return clips.mapValues(\.duration)
        case "prime": try prime()
        case "play":
            guard let name = command["name"] as? String, let clip = clips[name],
                  let group = command["group"] as? String, ["voice", "whistle", "crowd", "effect"].contains(group),
                  let delay = command["at"] as? Double, delay.isFinite, (0...60).contains(delay),
                  let duration = command["duration"] as? Double, duration.isFinite, duration > 0, duration <= 120,
                  let volume = command["volume"] as? Double, volume.isFinite, (0...1).contains(volume) else { throw AudioError.invalidCommand }
            try schedule(clip, group: group, delay: delay, duration: min(duration, clip.duration), volume: Float(volume))
        case "stopGroup":
            guard let group = command["group"] as? String else { throw AudioError.invalidCommand }
            stopGroup(group)
        case "stop": stop()
        default: throw AudioError.invalidCommand
        }
        return nil
    }

    private func loadClips() throws {
        let root = Bundle.main.resourceURL!.appendingPathComponent("Web/audio")
        let palette = ["Red", "Blue", "Green", "Black", "Yellow", "Orange", "Purple", "Pink", "White", "Gray"]
        var files = ["referee": "referee.mp3", "crowd": "crowd.mp3", "minute": "minute.mp3", "thirty": "thirty.mp3", "ten": "ten.mp3"]
        for n in 1...5 { files["count-\(n)"] = "count-\(n).mp3" }
        for (i, first) in palette.enumerated() {
            for second in palette.dropFirst(i + 1) {
                for role in ["up", "deck"] {
                    files["\(role)-\(first)-\(second)"] = "callouts/\(role)-\(first.lowercased())-\(second.lowercased()).mp3"
                }
            }
        }
        var loaded: [String: Clip] = [:]
        for (name, file) in files {
            let url = root.appendingPathComponent(file)
            loaded[name] = Clip(url: url, duration: try AVAudioPlayer(contentsOf: url).duration)
        }
        clips = loaded
    }

    private func activate() throws {
        releaseTask?.cancel(); releaseTask = nil
        if !sessionActive {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.duckOthers])
            try session.setActive(true)
            sessionActive = true
        }
    }

    private func prime() throws {
        try activate()
        primedUntil = Date().addingTimeInterval(1)
        releaseIfIdle()
    }

    private func schedule(_ clip: Clip, group: String, delay: TimeInterval, duration: TimeInterval, volume: Float) throws {
        // Prepare now to report missing/invalid audio through the bridge before scheduling it.
        let player = try AVAudioPlayer(contentsOf: clip.url)
        player.volume = volume; player.delegate = self
        let lead = Date() < primedUntil ? 0 : Self.duckLead
        try activate()
        let id = UUID()
        let task = DispatchWorkItem { [weak self] in
            guard let self, self.pending[id] != nil else { return }
            self.pending.removeValue(forKey: id)
            do {
                player.prepareToPlay()
                self.players[id] = player; self.groups[id] = group
                guard player.play() else { throw AudioError.playbackFailed }
                if duration < clip.duration - 0.01 {
                    self.enqueue(after: duration, group: group) { [weak self] in self?.finish(id) }
                }
            } catch {
                NSLog("Touchline audio: %@", error.localizedDescription)
                self.finish(id)
            }
        }
        pending[id] = Pending(group: group, task: task)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay + lead, execute: task)
    }

    private func enqueue(after delay: TimeInterval, group: String, work: @escaping () -> Void) {
        let id = UUID()
        let task = DispatchWorkItem { [weak self] in
            self?.pending.removeValue(forKey: id); work(); self?.releaseIfIdle()
        }
        pending[id] = Pending(group: group, task: task)
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: task)
    }

    private func finish(_ id: UUID) {
        players.removeValue(forKey: id)?.stop(); groups.removeValue(forKey: id)
        releaseIfIdle()
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        if let id = players.first(where: { $0.value === player })?.key { finish(id) }
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        if let id = players.first(where: { $0.value === player })?.key { finish(id) }
    }

    private func stopGroup(_ group: String) {
        for id in pending.filter({ $0.value.group == group }).map(\.key) { pending.removeValue(forKey: id)?.task.cancel() }
        for id in groups.filter({ $0.value == group }).map(\.key) { players.removeValue(forKey: id)?.stop(); groups.removeValue(forKey: id) }
        releaseIfIdle()
    }

    private func releaseIfIdle() {
        guard players.isEmpty, pending.isEmpty, sessionActive else { return }
        releaseTask?.cancel()
        let task = DispatchWorkItem { [weak self] in self?.deactivate() }
        releaseTask = task
        // Bridge short gaps so the 5-to-1 countdown doesn't pump the music volume.
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.1, execute: task)
    }

    private func deactivate() {
        guard players.isEmpty, pending.isEmpty, sessionActive else { return }
        do {
            try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            sessionActive = false
        } catch { NSLog("Touchline audio release: %@", error.localizedDescription) }
    }

    func stop() {
        releaseTask?.cancel(); releaseTask = nil
        primedUntil = .distantPast
        pending.values.forEach { $0.task.cancel() }; pending.removeAll()
        players.values.forEach { $0.stop() }; players.removeAll(); groups.removeAll()
        deactivate()
    }

    deinit { if let interruptionObserver { NotificationCenter.default.removeObserver(interruptionObserver) } }
    private enum AudioError: LocalizedError {
        case invalidCommand, playbackFailed
        var errorDescription: String? { "Touchline could not play this audio cue." }
    }
}
