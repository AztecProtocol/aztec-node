import type { NoirCompiledCircuitWithName } from '@aztec-labs/stdlib/noir';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { NativeACVMSimulator } from './acvm_native.js';

describe('NativeACVMSimulator', () => {
  // The bytecode is what makes the artifact large enough for two writes of it to overlap; the real
  // ones run to tens of megabytes.
  const artifact = {
    name: 'TestCircuit',
    hash: 1234,
    bytecode: 'A'.repeat(4_000_000),
  } as unknown as NoirCompiledCircuitWithName;
  const artifactFilename = `${artifact.name}-${artifact.hash}-${artifact.bytecode.length}.json`;

  let root: string;
  let workingDirectory: string;
  let noirExecute: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(tmpdir(), 'acvm-native-'));
    workingDirectory = path.join(root, 'working');
    await fs.mkdir(workingDirectory);
    // The simulator only needs the binary to exit cleanly: with no `--output-dir` it reads the
    // circuit's return value back out of the prover file, and this one leaves it as written.
    noirExecute = path.join(root, 'noir-execute');
    await fs.writeFile(noirExecute, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('prepares one artifact for simulators sharing a working directory', async () => {
    const simulators = Array.from({ length: 4 }, () => new NativeACVMSimulator(workingDirectory, noirExecute));

    await Promise.all(simulators.map(simulator => simulator.executeProtocolCircuit({}, artifact, undefined)));

    const artifacts = path.join(workingDirectory, 'artifacts');
    expect(await fs.readdir(artifacts)).toEqual([artifactFilename]);
    const written = JSON.parse(await fs.readFile(path.join(artifacts, artifactFilename), 'utf-8'));
    expect(written.bytecode).toEqual(artifact.bytecode);
  });
});
