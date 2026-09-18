import { MAX_TX_LIFETIME } from '@aztec-labs/constants';
import { PrivateKernelCircuitPublicInputs } from '@aztec-labs/stdlib/kernel';

import { computeTxExpirationTimestamp } from './compute_tx_expiration_timestamp.js';

describe('computeTxExpirationTimestamp', () => {
  let previousKernel: PrivateKernelCircuitPublicInputs;

  const blockTimestamp = 99999n;
  const maxTxLifetime = BigInt(MAX_TX_LIFETIME);
  const secondsInHour = 3600n;
  const secondsIn30Mins = 60n * 30n;

  const setExpirationTimestamp = (timestamp: bigint) => {
    previousKernel.expirationTimestamp = timestamp;
  };

  beforeEach(() => {
    previousKernel = PrivateKernelCircuitPublicInputs.empty();
    previousKernel.constants.anchorBlockHeader.globalVariables.timestamp = blockTimestamp;
  });

  it('caps at the max allowed duration and rounds it into the top hour bucket', () => {
    const maxTimestamp = blockTimestamp + maxTxLifetime;
    const topBucket = maxTimestamp - secondsInHour;

    setExpirationTimestamp(maxTimestamp + 87654n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(topBucket);

    setExpirationTimestamp(maxTimestamp + 123n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(topBucket);

    setExpirationTimestamp(maxTimestamp);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(topBucket);

    // A tx whose callees all use the default update delay reaches the client with maxTimestamp - 1.
    setExpirationTimestamp(maxTimestamp - 1n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(topBucket);
  });

  it('rounds down to the nearest hour', () => {
    setExpirationTimestamp(blockTimestamp + maxTxLifetime - 1n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + maxTxLifetime - secondsInHour);

    setExpirationTimestamp(blockTimestamp + secondsInHour * 11n + 1n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + secondsInHour * 11n);

    setExpirationTimestamp(blockTimestamp + secondsInHour * 2n + 123n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + secondsInHour * 2n);

    setExpirationTimestamp(blockTimestamp + secondsInHour);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + secondsInHour);
  });

  it('rounds down to 30 mins for duration between 30 mins to 1 hour', () => {
    setExpirationTimestamp(blockTimestamp + secondsInHour - 1n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + secondsIn30Mins);

    setExpirationTimestamp(blockTimestamp + secondsIn30Mins + 123n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + secondsIn30Mins);

    setExpirationTimestamp(blockTimestamp + secondsIn30Mins);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + secondsIn30Mins);
  });

  it('rounds down to the nearest minute for duration under 30 mins', () => {
    setExpirationTimestamp(blockTimestamp + secondsIn30Mins - 1n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + secondsIn30Mins - 60n);

    setExpirationTimestamp(blockTimestamp + 60n * 10n + 59n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + 60n * 10n);
  });

  it('rounds down to 1 second for duration under 1 min', () => {
    setExpirationTimestamp(blockTimestamp + 59n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + 59n);

    setExpirationTimestamp(blockTimestamp + 1n);
    expect(computeTxExpirationTimestamp(previousKernel)).toBe(blockTimestamp + 1n);
  });

  it('throws if the timestamp is equal to or less than the block timestamp', () => {
    setExpirationTimestamp(blockTimestamp);
    expect(() => computeTxExpirationTimestamp(previousKernel)).toThrow();

    setExpirationTimestamp(blockTimestamp - 1n);
    expect(() => computeTxExpirationTimestamp(previousKernel)).toThrow();
  });

  it('allows custom expiration timestamp', () => {
    setExpirationTimestamp(blockTimestamp + maxTxLifetime);
    const customTxLifetime = maxTxLifetime / 2n;
    const expirationTimestamp = computeTxExpirationTimestamp(previousKernel, Number(customTxLifetime));
    expect(expirationTimestamp).toBe(blockTimestamp + customTxLifetime - secondsInHour);
  });

  it('throws if custom tx lifetime is greater than the max allowed', () => {
    const customTxLifetime = maxTxLifetime + 1n;
    expect(() => computeTxExpirationTimestamp(previousKernel, Number(customTxLifetime))).toThrow();
  });
});
