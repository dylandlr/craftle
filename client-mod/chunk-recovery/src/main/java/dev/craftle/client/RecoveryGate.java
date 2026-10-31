package dev.craftle.client;
/** Pure state machine. Signals must come from the client, never from server commands. */
public final class RecoveryGate {
    private final long cooldownMs, persistentMs;
    private long suspectSince = -1, lastRecovery = Long.MIN_VALUE / 2;
    private int attempts = 0;
    public RecoveryGate(long persistentMs, long cooldownMs) {
        if (persistentMs < 1000 || cooldownMs < 1000) throw new IllegalArgumentException("bad timing");
        this.persistentMs = persistentMs; this.cooldownMs = cooldownMs;
    }
    public boolean sample(long now, boolean suspect) {
        if (!suspect) { suspectSince = -1; attempts = 0; return false; }
        if (suspectSince < 0) suspectSince = now;
        if (now - suspectSince < persistentMs || now - lastRecovery < cooldownMs || attempts >= 3) return false;
        attempts++; lastRecovery = now;
        return true;
    }
    public void reset() { suspectSince = -1; attempts = 0; lastRecovery = Long.MIN_VALUE / 2; }
}
