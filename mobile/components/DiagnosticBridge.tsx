/**
 * iOS Bridge Diagnostic Tool
 *
 * Drop this component onto any screen to identify which layer is stalling.
 * It measures: tap→JS latency, JS→native-network latency, and server RTT.
 * A requestAnimationFrame counter detects main-thread / bridge freezes.
 *
 * Usage: add <DiagnosticBridge /> anywhere in your component tree, then tap
 * the button and watch the console log report. Remove before shipping.
 */

import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/auth";

type Phase =
  | "idle"
  | "measuring"
  | "done"
  | "error";

type Report = {
  tapToJsMs: number;
  jsSetupMs: number;
  networkRttMs: number;
  totalMs: number;
  droppedFrames: number;
  frameDropIntervals: number[];
  serverStatus: number | null;
  bridgeFrozeMs: number;
  verdict: string;
};

const RAF_INTERVAL_MS = 100;
const MAX_EXPECTED_FRAME_BUDGET_MS = 200;

export function DiagnosticBridge() {
  const { token } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<Report | null>(null);

  const tapTimeRef = useRef<number>(0);
  const rafFramesRef = useRef<number[]>([]);
  const rafHandleRef = useRef<number | null>(null);
  const rafStartRef = useRef<number>(0);

  const stopRafLoop = useCallback(() => {
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
  }, []);

  const startRafLoop = useCallback((startTime: number) => {
    rafStartRef.current = startTime;
    rafFramesRef.current = [];
    let lastFrame = startTime;

    const tick = (now: number) => {
      const delta = now - lastFrame;
      rafFramesRef.current.push(delta);
      lastFrame = now;
      rafHandleRef.current = requestAnimationFrame(tick);
    };

    rafHandleRef.current = requestAnimationFrame(tick);
  }, []);

  const run = useCallback(async () => {
    // T0: exact millisecond the Pressable fires (JS side)
    const t0 = Date.now();
    tapTimeRef.current = t0;
    setPhase("measuring");
    setReport(null);

    // Start measuring frame budget immediately
    startRafLoop(t0);

    // T1: just before we set up the fetch (any async overhead between tap and network call)
    const t1 = Date.now();

    let serverStatus: number | null = null;
    let networkRttMs = 0;
    let fetchError: unknown = null;

    try {
      const t2 = Date.now();
      const res = await apiFetch("/users/me", { token, timeoutMs: 30_000 });
      const t3 = Date.now();
      serverStatus = res.status;
      networkRttMs = t3 - t2;
    } catch (err) {
      fetchError = err;
      networkRttMs = Date.now() - t1;
    }

    const tEnd = Date.now();
    stopRafLoop();

    // Analyse RAF frames
    const frames = rafFramesRef.current;
    const droppedFrames = frames.filter((f) => f > MAX_EXPECTED_FRAME_BUDGET_MS).length;
    const frameDropIntervals = frames.filter((f) => f > MAX_EXPECTED_FRAME_BUDGET_MS);
    const bridgeFrozeMs = frameDropIntervals.reduce((a, b) => a + b, 0);

    const tapToJsMs = t1 - t0;
    const jsSetupMs = t1 - t0; // time to reach fetch call
    const totalMs = tEnd - t0;

    // Verdict logic
    let verdict = "";

    if (bridgeFrozeMs > 1000) {
      verdict += `🔴 JS/BRIDGE FROZEN: main thread stalled ${bridgeFrozeMs}ms total. `;
    }

    if (tapToJsMs > 300) {
      verdict += `🔴 TAP→JS LATENCY: ${tapToJsMs}ms — React press event queue is backed up (re-render storm or bridge congestion). `;
    }

    if (networkRttMs < 3000 && !fetchError) {
      verdict += `✅ Network RTT OK: ${networkRttMs}ms — server is responsive. `;
    } else if (networkRttMs >= 3000 && networkRttMs < 15000 && !fetchError) {
      verdict += `🟡 SLOW NETWORK: ${networkRttMs}ms — NSURLSession connection pool may be saturated (too many concurrent requests). `;
    } else if (networkRttMs >= 15000 || fetchError) {
      verdict += `🔴 NETWORK TIMEOUT: ${networkRttMs}ms — NSURLSession is blocked. Likely: connection pool exhaustion OR DNS hang. `;
    }

    if (bridgeFrozeMs < 500 && tapToJsMs < 200 && networkRttMs > 5000) {
      verdict += `\n→ DIAGNOSIS: JS bridge is fine, main thread is NOT frozen. The delay is purely in the native network layer (NSURLSession). Root cause is likely concurrent request saturation or a StoreKit/RevenueCat cold-init blocking the networking thread.`;
    } else if (bridgeFrozeMs > 2000 && networkRttMs < 3000) {
      verdict += `\n→ DIAGNOSIS: Network is fast but JS bridge is frozen. Root cause is likely a re-render storm (collapsible-tab-view Reanimated shared values + New Arch) or KeyboardProvider layout thrash.`;
    } else if (bridgeFrozeMs > 1000 && networkRttMs > 5000) {
      verdict += `\n→ DIAGNOSIS: BOTH bridge and network are blocked simultaneously. This points to the New Architecture TurboModule init or RevenueCat StoreKit init blocking the native thread, which starves both JS execution and NSURLSession.`;
    }

    const r: Report = {
      tapToJsMs,
      jsSetupMs,
      networkRttMs,
      totalMs,
      droppedFrames,
      frameDropIntervals,
      serverStatus,
      bridgeFrozeMs,
      verdict: verdict || "No clear verdict — check raw numbers.",
    };

    setReport(r);
    setPhase(fetchError ? "error" : "done");

    // Also log to console for Metro / Xcode log capture
    console.log("=== DIAGNOSTIC BRIDGE REPORT ===");
    console.log("Platform:", Platform.OS, Platform.Version);
    console.log("tap→JS (ms):", tapToJsMs);
    console.log("network RTT (ms):", networkRttMs);
    console.log("total (ms):", totalMs);
    console.log("dropped RAF frames:", droppedFrames, "intervals:", frameDropIntervals);
    console.log("bridge frozen total (ms):", bridgeFrozeMs);
    console.log("server status:", serverStatus);
    console.log("VERDICT:", r.verdict);
    console.log("================================");
  }, [token, startRafLoop, stopRafLoop]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bridge Diagnostics</Text>

      <Pressable
        style={[styles.btn, phase === "measuring" && styles.btnDisabled]}
        onPress={() => {
          if (phase !== "measuring") void run();
        }}
        disabled={phase === "measuring"}
      >
        <Text style={styles.btnText}>
          {phase === "measuring" ? "Measuring…" : "Run Diagnostic Tap"}
        </Text>
      </Pressable>

      {report && (
        <ScrollView style={styles.reportBox} nestedScrollEnabled>
          <Row label="Tap → JS" value={`${report.tapToJsMs}ms`} bad={report.tapToJsMs > 300} />
          <Row label="Network RTT" value={`${report.networkRttMs}ms`} bad={report.networkRttMs > 5000} />
          <Row label="Total time" value={`${report.totalMs}ms`} bad={report.totalMs > 5000} />
          <Row label="Bridge frozen" value={`${report.bridgeFrozeMs}ms`} bad={report.bridgeFrozeMs > 500} />
          <Row label="Dropped frames" value={String(report.droppedFrames)} bad={report.droppedFrames > 3} />
          <Row label="Server status" value={String(report.serverStatus ?? "timeout")} bad={!report.serverStatus} />
          <Text style={styles.verdictLabel}>Verdict:</Text>
          <Text style={styles.verdictText}>{report.verdict}</Text>
        </ScrollView>
      )}
    </View>
  );
}

function Row({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bad && styles.rowValueBad]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    backgroundColor: "#1A1F36",
    borderRadius: 12,
  },
  title: {
    color: "#F9F6F0",
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#F97316",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  reportBox: { maxHeight: 300 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowLabel: { color: "#aaa", fontSize: 12 },
  rowValue: { color: "#4ade80", fontSize: 12, fontWeight: "700" },
  rowValueBad: { color: "#f87171" },
  verdictLabel: { color: "#F97316", fontWeight: "700", fontSize: 12, marginTop: 10 },
  verdictText: { color: "#F9F6F0", fontSize: 11, lineHeight: 16, marginTop: 4 },
});
