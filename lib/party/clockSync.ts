export interface ClockSample {
    clientSentAtMs: number;
    serverNowMs: number;
    clientReceivedAtMs: number;
}

export interface ClockEstimate {
    offsetMs: number;
    medianRttMs: number;
    samplesUsed: number;
    samplesDiscarded: number;
}

const median = (values: number[]): number => {
    const ordered = [...values].sort((left, right) => left - right);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 === 0
        ? (ordered[middle - 1] + ordered[middle]) / 2
        : ordered[middle];
};

const validSample = (sample: ClockSample): boolean =>
    Number.isFinite(sample.clientSentAtMs)
    && Number.isFinite(sample.serverNowMs)
    && Number.isFinite(sample.clientReceivedAtMs)
    && sample.clientReceivedAtMs >= sample.clientSentAtMs;

export const clockSampleRttMs = (sample: ClockSample): number =>
    sample.clientReceivedAtMs - sample.clientSentAtMs;

export const clockSampleOffsetMs = (sample: ClockSample): number =>
    sample.serverNowMs - (sample.clientSentAtMs + clockSampleRttMs(sample) / 2);

export const estimateClockOffset = (samples: ClockSample[]): ClockEstimate | null => {
    const valid = samples.filter(validSample);
    if (valid.length < 3) return null;

    const rtts = valid.map(clockSampleRttMs);
    const medianRtt = median(rtts);
    const medianAbsoluteDeviation = median(rtts.map((rtt) => Math.abs(rtt - medianRtt)));
    const maximumAcceptedRtt = medianRtt + Math.max(10, medianAbsoluteDeviation * 3);
    const accepted = valid.filter((sample) => clockSampleRttMs(sample) <= maximumAcceptedRtt);
    if (accepted.length < 3) return null;

    return {
        offsetMs: median(accepted.map(clockSampleOffsetMs)),
        medianRttMs: median(accepted.map(clockSampleRttMs)),
        samplesUsed: accepted.length,
        samplesDiscarded: samples.length - accepted.length,
    };
};

export const serverNowFromClientClock = (clientNowMs: number, offsetMs: number): number =>
    clientNowMs + offsetMs;
